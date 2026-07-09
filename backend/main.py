import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from backend.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from backend.claude_client import generate_one_pager
from backend.database import get_db, init_db
from backend.db_models import SavedThesis, User
from backend.financial_client import TickerNotFoundError, fetch_financial_data
from backend.models import (
    AnalyzeRequest,
    AuthResponse,
    LoginRequest,
    OnePager,
    RegisterRequest,
    SaveThesisRequest,
    SavedThesisDetail,
    SavedThesisSummary,
    UserPublic,
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
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return AuthResponse(
        access_token=create_access_token(user.id),
        user=UserPublic.model_validate(user),
    )


@app.post("/auth/login", response_model=AuthResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    user = db.query(User).filter(User.email == request.email.lower()).first()
    if user is None or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    return AuthResponse(
        access_token=create_access_token(user.id),
        user=UserPublic.model_validate(user),
    )


@app.get("/auth/me", response_model=UserPublic)
async def me(current_user: User = Depends(get_current_user)) -> UserPublic:
    return UserPublic.model_validate(current_user)


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
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
