from datetime import date as Date
from datetime import datetime as DateTime
from typing import Any, Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    name: Optional[str] = Field(None, max_length=120)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class UserPublic(BaseModel):
    id: int
    email: EmailStr
    name: Optional[str] = None
    email_verified: bool = False
    created_at: DateTime

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic
    message: Optional[str] = None
    # Only returned when SMTP is not configured (local/dev convenience).
    verification_url: Optional[str] = None


class VerifyEmailRequest(BaseModel):
    token: str = Field(..., min_length=8, max_length=128)


class DeleteAccountRequest(BaseModel):
    password: str = Field(..., min_length=1, max_length=128)


class MessageResponse(BaseModel):
    message: str


class SaveThesisRequest(BaseModel):
    one_pager: "OnePager"


class SavedThesisSummary(BaseModel):
    id: int
    ticker: str
    company_name: str
    generated_at: DateTime
    saved_at: DateTime

    model_config = {"from_attributes": True}


class SavedThesisDetail(BaseModel):
    id: int
    ticker: str
    company_name: str
    saved_at: DateTime
    one_pager: "OnePager"


class AnalyzeRequest(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=10, examples=["AAPL"])

    @field_validator("ticker")
    @classmethod
    def normalize_ticker(cls, value: str) -> str:
        normalized = value.strip().upper()
        if not normalized.isalnum():
            raise ValueError("Ticker must contain only letters and numbers")
        return normalized


class CompanyOverview(BaseModel):
    description: str = Field(..., description="What the company does")
    differentiation: str = Field(..., description="How the company stands out")
    products_services: list[str] = Field(..., min_length=1)
    leadership: str = Field(..., description="CEO and relevant leadership context")


class IndustryCompetitors(BaseModel):
    industry: str
    market_landscape: str
    key_competitors: list[str] = Field(..., min_length=1)
    competitive_position: str = Field(
        ..., description="Where this company sits relative to competitors"
    )


# Metric tiers for the financial data layer (Phase 1 must attempt all required fields).
REQUIRED_FINANCIAL_METRIC_FIELDS: frozenset[str] = frozenset(
    {
        "market_cap",
        "revenue",
        "revenue_growth_yoy",
        "gross_margin",
        "operating_margin",
        "net_margin",
        "total_debt",
        "cash_and_equivalents",
        "free_cash_flow",
        "pe_ratio",
    }
)
OPTIONAL_FINANCIAL_METRIC_FIELDS: frozenset[str] = frozenset(
    {
        "forward_pe",
        "price_to_sales",
        "ev_to_ebitda",
    }
)
FINANCIAL_METADATA_FIELDS: frozenset[str] = frozenset({"currency", "fiscal_period"})


class FinancialMetrics(BaseModel):
    """Raw numbers fetched from the financial data layer (e.g. yfinance).

    Required fields: must be attempted on every fetch; null if unavailable.
    Optional fields: include when the data source provides them; omit otherwise.
    """

    currency: str = Field(default="USD", description="[Metadata] Reporting currency.")
    fiscal_period: Optional[str] = Field(
        None, description="[Metadata] Period label, e.g. FY2025 or TTM."
    )
    market_cap: Optional[float] = Field(None, description="[Required]")
    revenue: Optional[float] = Field(None, description="[Required]")
    revenue_growth_yoy: Optional[float] = Field(
        None,
        description="[Required] Year-over-year revenue growth as a decimal (e.g. 0.12 = 12%).",
    )
    gross_margin: Optional[float] = Field(None, description="[Required]")
    operating_margin: Optional[float] = Field(None, description="[Required]")
    net_margin: Optional[float] = Field(None, description="[Required]")
    total_debt: Optional[float] = Field(None, description="[Required]")
    cash_and_equivalents: Optional[float] = Field(None, description="[Required]")
    free_cash_flow: Optional[float] = Field(None, description="[Required]")
    pe_ratio: Optional[float] = Field(None, description="[Required] Trailing P/E.")
    forward_pe: Optional[float] = Field(None, description="[Optional]")
    price_to_sales: Optional[float] = Field(None, description="[Optional]")
    ev_to_ebitda: Optional[float] = Field(None, description="[Optional]")


class FinancialHealth(BaseModel):
    metrics: FinancialMetrics
    analysis: str = Field(
        ..., description="Narrative assessment of financial soundness and valuation"
    )


class BullBearCase(BaseModel):
    bull: list[str] = Field(..., min_length=3, max_length=3)
    bear: list[str] = Field(..., min_length=3, max_length=3)


class RiskItem(BaseModel):
    category: Literal["regulatory", "competitive", "macro", "execution", "other"]
    description: str


class NewsItem(BaseModel):
    """A recent news headline with required attribution."""

    text: str = Field(..., min_length=1, description="News headline or summary")
    source: str = Field(..., min_length=1, description="Publisher name, e.g. Bloomberg")
    date: Date = Field(..., description="Publication date (ISO YYYY-MM-DD)")

    @model_validator(mode="before")
    @classmethod
    def coerce_legacy_string(cls, value: Any) -> Any:
        """Accept legacy plain-string news items from older saved theses."""
        if isinstance(value, str):
            return {
                "text": value,
                "source": "Unknown",
                "date": Date.today().isoformat(),
            }
        return value

    @field_validator("date", mode="before")
    @classmethod
    def parse_date(cls, value: Any) -> Any:
        if isinstance(value, DateTime):
            return value.date()
        if isinstance(value, Date):
            return value
        if isinstance(value, str):
            cleaned = value.strip()
            try:
                return Date.fromisoformat(cleaned[:10])
            except ValueError:
                pass
            for fmt in (
                "%d %B %Y",
                "%B %d, %Y",
                "%d %b %Y",
                "%b %d, %Y",
                "%Y/%m/%d",
                "%m/%d/%Y",
            ):
                try:
                    return DateTime.strptime(cleaned, fmt).date()
                except ValueError:
                    continue
        raise ValueError(f"Invalid news date: {value}")

    @field_validator("source")
    @classmethod
    def require_source(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("News source is required")
        return cleaned


class ExternalSignals(BaseModel):
    sentiment: Literal["bullish", "bearish", "neutral", "mixed"]
    summary: str
    recent_news: list[NewsItem] = Field(..., min_length=1)
    notable_endorsements_or_criticism: list[str] = Field(default_factory=list)


class OnePager(BaseModel):
    """Structured stock research one-pager returned by POST /analyze."""

    ticker: str
    company_name: str
    generated_at: DateTime
    company_overview: CompanyOverview
    industry_competitors: IndustryCompetitors
    financial_health: FinancialHealth
    bull_bear: BullBearCase
    risks: list[RiskItem] = Field(..., min_length=1)
    external_signals: ExternalSignals

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "ticker": "AAPL",
                    "company_name": "Apple Inc.",
                    "generated_at": "2026-07-07T12:00:00Z",
                    "company_overview": {
                        "description": "Designs and sells consumer electronics, software, and services.",
                        "differentiation": "Integrated hardware-software ecosystem with strong brand loyalty.",
                        "products_services": ["iPhone", "Mac", "Services", "Wearables"],
                        "leadership": "Tim Cook, CEO since 2011.",
                    },
                    "industry_competitors": {
                        "industry": "Consumer Electronics & Technology",
                        "market_landscape": "Mature, highly competitive market with platform ecosystems.",
                        "key_competitors": ["Samsung", "Microsoft", "Google"],
                        "competitive_position": "Premium market leader with recurring services revenue.",
                    },
                    "financial_health": {
                        "metrics": {
                            "currency": "USD",
                            "fiscal_period": "FY2025",
                            "market_cap": 3000000000000,
                            "revenue": 400000000000,
                            "revenue_growth_yoy": 0.05,
                            "gross_margin": 0.46,
                            "operating_margin": 0.30,
                            "net_margin": 0.25,
                            "total_debt": 95000000000,
                            "cash_and_equivalents": 65000000000,
                            "free_cash_flow": 110000000000,
                            "pe_ratio": 28.5,
                            "forward_pe": 26.0,
                        },
                        "analysis": "Strong balance sheet, high margins, and robust cash generation.",
                    },
                    "bull_bear": {
                        "bull": [
                            "Services revenue provides high-margin recurring income.",
                            "Ecosystem lock-in drives customer retention and upsell.",
                            "Massive cash reserves enable buybacks and strategic investment.",
                        ],
                        "bear": [
                            "iPhone revenue concentration creates cyclical risk.",
                            "Regulatory pressure on App Store fees may compress margins.",
                            "China exposure adds geopolitical and demand uncertainty.",
                        ],
                    },
                    "risks": [
                        {
                            "category": "regulatory",
                            "description": "Antitrust scrutiny of App Store policies.",
                        },
                        {
                            "category": "competitive",
                            "description": "AI features from rivals could erode differentiation.",
                        },
                    ],
                    "external_signals": {
                        "sentiment": "neutral",
                        "summary": "Mixed sentiment around AI roadmap and China demand.",
                        "recent_news": [
                            {
                                "text": "Apple announces new AI features for upcoming iOS release.",
                                "source": "Bloomberg",
                                "date": "2026-07-13",
                            }
                        ],
                        "notable_endorsements_or_criticism": [
                            "Analysts debate pace of AI feature rollout vs. peers."
                        ],
                    },
                }
            ]
        }
    }


SaveThesisRequest.model_rebuild()
SavedThesisDetail.model_rebuild()
