import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from backend.auth import (
    assign_verification_token,
    build_verification_url,
    create_access_token,
    get_current_user,
    hash_password,
    require_verified_user,
    send_verification_email,
    smtp_configured,
    verify_password,
)
from backend.claude_client import generate_one_pager
from backend.database import get_db, init_db
from backend.db_models import SavedThesis, User
from backend.financial_client import TickerNotFoundError, fetch_financial_data
from backend.models import (
    AnalyzeRequest,
    AuthResponse,
    DeleteAccountRequest,
    LoginRequest,
    MessageResponse,
    OnePager,
    RegisterRequest,
    SaveThesisRequest,
    SavedThesisDetail,
    SavedThesisSummary,
    UserPublic,
    VerifyEmailRequest,
)

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("Warning: ANTHROPIC_API_KEY is not set")
    init_db()
    print("Thesis API running")
    yield


app = FastAPI(title="Thesis", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _auth_response(user: User, *, message: str | None = None, include_dev_link: bool = False) -> AuthResponse:
    verification_url = None
    if include_dev_link and not user.email_verified and user.verification_token and not smtp_configured():
        verification_url = build_verification_url(user.verification_token)

    return AuthResponse(
        access_token=create_access_token(user.id),
        user=UserPublic.model_validate(user),
        message=message,
        verification_url=verification_url,
    )


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/auth/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest, db: Session = Depends(get_db)) -> AuthResponse:
    existing = db.query(User).filter(User.email == request.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    user = User(
        email=request.email.lower(),
        hashed_password=hash_password(request.password),
        name=request.name,
        email_verified=False,
    )
    token = assign_verification_token(user)
    db.add(user)
    db.commit()
    db.refresh(user)

    emailed = send_verification_email(user.email, token)
    message = (
        "Account created. Check your email for a verification link."
        if emailed
        else "Account created. Verify your email using the link shown below (SMTP not configured)."
    )
    return _auth_response(user, message=message, include_dev_link=True)


@app.post("/auth/login", response_model=AuthResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    user = db.query(User).filter(User.email == request.email.lower()).first()
    if user is None or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    message = None
    if not user.email_verified:
        message = "Logged in. Please verify your email to save theses."

    return _auth_response(user, message=message, include_dev_link=True)


@app.get("/auth/me", response_model=UserPublic)
async def me(current_user: User = Depends(get_current_user)) -> UserPublic:
    return UserPublic.model_validate(current_user)


@app.post("/auth/verify-email", response_model=AuthResponse)
async def verify_email(request: VerifyEmailRequest, db: Session = Depends(get_db)) -> AuthResponse:
    user = (
        db.query(User)
        .filter(User.verification_token == request.token)
        .first()
    )
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification link")

    expires = user.verification_token_expires
    if expires is not None:
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification link expired. Request a new one.",
            )

    user.email_verified = True
    user.verification_token = None
    user.verification_token_expires = None
    db.commit()
    db.refresh(user)

    return _auth_response(user, message="Email verified. You can save theses now.")


@app.post("/auth/resend-verification", response_model=MessageResponse)
async def resend_verification(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    if current_user.email_verified:
        return MessageResponse(message="Email is already verified.")

    token = assign_verification_token(current_user)
    db.commit()
    emailed = send_verification_email(current_user.email, token)

    if emailed:
        return MessageResponse(message="Verification email sent. Check your inbox.")

    # Local/dev path when SMTP is absent.
    return MessageResponse(
        message=f"SMTP not configured. Use this link to verify: {build_verification_url(token)}"
    )


@app.delete("/auth/me", response_model=MessageResponse)
async def delete_account(
    request: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    if not verify_password(request.password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password",
        )

    db.delete(current_user)
    db.commit()
    return MessageResponse(message="Account deleted.")


@app.post("/analyze", response_model=OnePager)
async def analyze(request: AnalyzeRequest) -> OnePager:
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise HTTPException(
            status_code=500,
            detail="ANTHROPIC_API_KEY is not configured",
        )

    try:
        company_name, metrics = fetch_financial_data(request.ticker)
    except TickerNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    try:
        return generate_one_pager(request.ticker, company_name, metrics)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Analysis failed: {exc}",
        ) from exc


@app.post("/theses", response_model=SavedThesisSummary, status_code=status.HTTP_201_CREATED)
async def save_thesis(
    request: SaveThesisRequest,
    current_user: User = Depends(require_verified_user),
    db: Session = Depends(get_db),
) -> SavedThesisSummary:
    one_pager = request.one_pager
    saved = SavedThesis(
        user_id=current_user.id,
        ticker=one_pager.ticker,
        company_name=one_pager.company_name,
        data=one_pager.model_dump_json(),
    )
    db.add(saved)
    db.commit()
    db.refresh(saved)

    return SavedThesisSummary(
        id=saved.id,
        ticker=saved.ticker,
        company_name=saved.company_name,
        generated_at=one_pager.generated_at,
        saved_at=saved.created_at,
    )


@app.get("/theses", response_model=list[SavedThesisSummary])
async def list_theses(
    current_user: User = Depends(require_verified_user),
    db: Session = Depends(get_db),
) -> list[SavedThesisSummary]:
    rows = (
        db.query(SavedThesis)
        .filter(SavedThesis.user_id == current_user.id)
        .order_by(SavedThesis.created_at.desc())
        .all()
    )

    summaries: list[SavedThesisSummary] = []
    for row in rows:
        one_pager = OnePager.model_validate_json(row.data)
        summaries.append(
            SavedThesisSummary(
                id=row.id,
                ticker=row.ticker,
                company_name=row.company_name,
                generated_at=one_pager.generated_at,
                saved_at=row.created_at,
            )
        )
    return summaries


@app.get("/theses/{thesis_id}", response_model=SavedThesisDetail)
async def get_thesis(
    thesis_id: int,
    current_user: User = Depends(require_verified_user),
    db: Session = Depends(get_db),
) -> SavedThesisDetail:
    row = (
        db.query(SavedThesis)
        .filter(SavedThesis.id == thesis_id, SavedThesis.user_id == current_user.id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thesis not found")

    one_pager = OnePager.model_validate_json(row.data)
    return SavedThesisDetail(
        id=row.id,
        ticker=row.ticker,
        company_name=row.company_name,
        saved_at=row.created_at,
        one_pager=one_pager,
    )


@app.delete("/theses/{thesis_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_thesis(
    thesis_id: int,
    current_user: User = Depends(require_verified_user),
    db: Session = Depends(get_db),
) -> None:
    row = (
        db.query(SavedThesis)
        .filter(SavedThesis.id == thesis_id, SavedThesis.user_id == current_user.id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thesis not found")

    db.delete(row)
    db.commit()
