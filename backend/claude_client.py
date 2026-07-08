import json
import os
import re
from datetime import date, datetime, timedelta, timezone

import anthropic
from anthropic import Anthropic

from backend.models import (
    BullBearArgument,
    BullBearCase,
    CompanyOverview,
    CompetitorItem,
    ExternalSignals,
    FinancialHealth,
    FinancialMetrics,
    IndustryCompetitors,
    OnePager,
    RiskItem,
    SourceBackedPoint,
)

def _get_client() -> Anthropic:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY is not configured")
    return Anthropic(api_key=api_key)


ANALYSIS_PROMPT = """You are a concise equity research analyst writing a one-pager for a busy investor.

Today's date: {today}

Analyze {ticker} ({company_name}).

Use web search for recent news, leadership details, competitors, market sentiment, and qualitative context.
Do NOT invent financial numbers. Use only the provided financial metrics for quantitative facts.

FINANCIAL METRICS (authoritative — do not change these values):
{financial_metrics_json}

Return ONLY a JSON object with this exact structure. No markdown, no code fences, no commentary:

{{
  "company_overview": {{
    "description": "what the company does",
    "differentiation": "how it stands out",
    "products_services": ["product 1", "product 2"],
    "leadership": "CEO name and brief context"
  }},
  "industry_competitors": {{
    "industry": "industry name",
    "market_landscape": "market landscape summary",
    "key_competitors": [
      {{
        "name": "Microsoft",
        "ticker": "MSFT",
        "description": "optional brief context (products, segment, geography)"
      }}
    ],
    "competitive_position": "where this company sits"
  }},
  "financial_health": {{
    "analysis": "narrative on financial soundness and valuation using the provided metrics"
  }},
  "bull_bear": {{
    "bull": [
      {{
        "title": "3-6 word headline",
        "points": ["supporting bullet 1", "supporting bullet 2"]
      }}
    ],
    "bear": [
      {{
        "title": "3-6 word headline",
        "points": ["supporting bullet 1", "supporting bullet 2"]
      }}
    ]
  }},
  "risks": [
    {{"category": "regulatory|competitive|macro|execution|other", "description": "risk description"}}
  ],
  "external_signals": {{
    "sentiment": "bullish|bearish|neutral|mixed",
    "summary": "break this into short point-form statements separated by periods; include analyst buy/hold/sell numbers when available",
    "recent_news": [
      {{"text": "news item 1", "source_url": "https://...", "published_at": "YYYY-MM-DD"}}
    ],
    "notable_endorsements_or_criticism": [
      {{"text": "endorsement or criticism", "source_url": "https://...", "published_at": "YYYY-MM-DD"}}
    ]
  }}
}}

Competitor rules:
- List 5-8 material competitors
- For each competitor, set name to the company name only (not product lines like TPU, AWS, or ASIC)
- Set ticker to the correct US-listed symbol when the company trades on a US exchange (e.g. MSFT, META, GOOGL, AMZN, INTC, AVGO, QCOM, MRVL)
- Use null for ticker only when the company is private or has no US listing
- Put product/context details in description, never in ticker

Bull/bear selection rules:
- Exactly 3 bull and 3 bear items each
- Each item has a title and points array
- title: standalone headline only, 3-6 words, no period, NOT a truncated copy of a point
- points: 1-3 concise supporting bullets that add detail beyond the title
- points must be plain strings in a JSON array (not objects)
- points must NOT repeat or restate the title verbatim
- Each item must be material, distinct, and evidence-based
- Ground in financials, competitive dynamics, or recent events
- Avoid generic statements

External signal sourcing rules:
- Every item in recent_news and notable_endorsements_or_criticism must include source_url when available
- Use reputable and specific URLs (newsrooms, filings, mainstream financial press)
- recent_news: include ONLY items published within the past 30 days from {today}; each item must include published_at (ISO YYYY-MM-DD); maximum 5 items
- notable_endorsements_or_criticism: include ONLY analyst/investor endorsements or criticisms from the past 365 days from {today}; each item must include published_at (ISO YYYY-MM-DD); maximum 5 items

Output constraints (critical):
- Return valid JSON only — no trailing commas, no comments, no markdown
- Escape double quotes inside strings as \\"
- Do not use literal newlines inside JSON string values
- Keep each text field concise (under 200 characters where possible) so the full JSON fits in one response"""


def _strip_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    return text.strip()


def _extract_text(message: anthropic.types.Message) -> str:
    parts = [block.text for block in message.content if block.type == "text"]
    if not parts:
        raise ValueError("Claude returned no text content")
    return parts[-1]


def _extract_json_blob(text: str) -> str:
    text = _strip_fences(text)
    start = text.find("{")
    end = text.rfind("}")
    if start == -1:
        raise ValueError("Claude response did not contain a JSON object")
    if end > start:
        return text[start : end + 1]
    return text[start:]


def _close_truncated_json(text: str) -> str:
    """Best-effort repair when model output is cut off mid-string or mid-structure."""
    in_string = False
    escape = False
    stack: list[str] = []

    for ch in text:
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            continue

        if ch == '"':
            in_string = True
        elif ch == "{":
            stack.append("}")
        elif ch == "[":
            stack.append("]")
        elif ch in "}]" and stack and ch == stack[-1]:
            stack.pop()

    repaired = text
    if in_string:
        repaired += '"'
    repaired += "".join(reversed(stack))
    return repaired


def _parse_json_response(text: str) -> dict:
    blob = _extract_json_blob(text)
    try:
        payload = json.loads(blob)
    except json.JSONDecodeError:
        payload = json.loads(_close_truncated_json(blob))
    if not isinstance(payload, dict):
        raise ValueError("Claude response JSON root must be an object")
    return payload


def _request_analysis_payload(
    client: Anthropic,
    prompt: str,
    *,
    max_tokens: int = 8192,
) -> dict:
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=max_tokens,
        tools=[{"type": "web_search_20250305", "name": "web_search", "max_uses": 5}],
        messages=[{"role": "user", "content": prompt}],
    )
    return _parse_json_response(_extract_text(message))


def _parse_published_date(value: object) -> date | None:
    if not value:
        return None
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _coerce_text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, bool)):
        return str(value).strip()
    if isinstance(value, dict):
        for key in (
            "name",
            "company",
            "label",
            "text",
            "title",
            "headline",
            "point",
            "description",
            "body",
            "argument",
        ):
            nested = value.get(key)
            if isinstance(nested, str) and nested.strip():
                return nested.strip()
        return ""
    return str(value).strip()


def _dedupe_points_from_title(title: str, points: list[str]) -> list[str]:
    title_lower = title.lower().strip()
    filtered: list[str] = []
    for point in points:
        point_lower = point.lower().strip()
        if point_lower == title_lower:
            continue
        if point_lower.startswith(title_lower):
            remainder = point[len(title) :].strip().lstrip(":-—. ")
            if remainder:
                filtered.append(remainder)
            continue
        filtered.append(point)
    return filtered or points


def _split_legacy_argument(text: str) -> list[str]:
    return [part.strip() for part in re.split(r"(?<=[.!?])\s+", text) if part.strip()]


def _normalize_bull_bear_items(
    items: list[object], side: str
) -> list[BullBearArgument]:
    normalized: list[BullBearArgument] = []
    for idx, item in enumerate(items):
        fallback_title = f"{side} case {idx + 1}"
        if isinstance(item, dict):
            title = (
                _coerce_text(item.get("title"))
                or _coerce_text(item.get("headline"))
                or fallback_title
            )
            raw_points = item.get("points") or item.get("bullets") or []
            if isinstance(raw_points, str):
                points = _split_legacy_argument(raw_points)
            elif isinstance(raw_points, list):
                points = [_coerce_text(point) for point in raw_points]
            else:
                points = [_coerce_text(raw_points)]
            points = [point for point in points if point]
            if not points:
                body = _coerce_text(item.get("body"))
                points = _split_legacy_argument(body) if body else []
        else:
            title = fallback_title
            points = _split_legacy_argument(_coerce_text(item))

        points = _dedupe_points_from_title(title, points)
        if not points:
            points = ["Details unavailable for this argument."]

        normalized.append(BullBearArgument(title=title, points=points))
    return normalized


def _normalize_competitors(items: list[object]) -> list[CompetitorItem]:
    normalized: list[CompetitorItem] = []
    for item in items:
        if isinstance(item, dict):
            ticker = item.get("ticker")
            normalized.append(
                CompetitorItem(
                    name=_coerce_text(item.get("name")),
                    ticker=str(ticker).strip().upper() if ticker else None,
                    description=(
                        _coerce_text(item.get("description")) or None
                    ),
                )
            )
        else:
            normalized.append(CompetitorItem(name=_coerce_text(item)))
    return [entry for entry in normalized if entry.name]


def _normalize_signal_items(items: list[object]) -> list[SourceBackedPoint]:
    normalized: list[SourceBackedPoint] = []
    for item in items:
        if isinstance(item, dict):
            normalized.append(
                SourceBackedPoint(
                    text=str(item.get("text", "")).strip(),
                    source_url=item.get("source_url"),
                    published_at=_parse_published_date(item.get("published_at")),
                )
            )
        else:
            normalized.append(SourceBackedPoint(text=str(item)))
    return [entry for entry in normalized if entry.text]


def _filter_recent_news(
    items: list[SourceBackedPoint], today: date
) -> list[SourceBackedPoint]:
    cutoff = today - timedelta(days=30)
    filtered = [
        item
        for item in items
        if item.published_at is None or item.published_at >= cutoff
    ]
    return filtered or items


def _filter_and_sort_endorsements(
    items: list[SourceBackedPoint], today: date
) -> list[SourceBackedPoint]:
    cutoff = today - timedelta(days=365)
    filtered = [
        item
        for item in items
        if item.published_at is None or item.published_at >= cutoff
    ]
    filtered.sort(key=lambda item: item.published_at or date.min)
    return filtered


def generate_one_pager(
    ticker: str,
    company_name: str,
    metrics: FinancialMetrics,
) -> OnePager:
    today = datetime.now(timezone.utc).date()
    prompt = ANALYSIS_PROMPT.format(
        ticker=ticker,
        company_name=company_name,
        today=today.isoformat(),
        financial_metrics_json=metrics.model_dump_json(indent=2),
    )

    client = _get_client()
    try:
        payload = _request_analysis_payload(client, prompt)
    except (json.JSONDecodeError, ValueError) as first_error:
        retry_prompt = (
            f"{prompt}\n\n"
            "Your previous response was invalid or truncated JSON. "
            "Return the same analysis again as a single complete, valid JSON object only. "
            "Keep all text fields shorter and ensure every string is properly closed."
        )
        try:
            payload = _request_analysis_payload(client, retry_prompt, max_tokens=8192)
        except (json.JSONDecodeError, ValueError) as second_error:
            raise ValueError(
                f"Could not parse analysis JSON after retry: {second_error}"
            ) from first_error

    recent_news = _filter_recent_news(
        _normalize_signal_items(payload["external_signals"].get("recent_news", [])),
        today,
    )
    endorsements = _filter_and_sort_endorsements(
        _normalize_signal_items(
            payload["external_signals"].get("notable_endorsements_or_criticism", [])
        ),
        today,
    )

    return OnePager(
        ticker=ticker,
        company_name=company_name,
        generated_at=datetime.now(timezone.utc),
        company_overview=CompanyOverview(**payload["company_overview"]),
        industry_competitors=IndustryCompetitors(
            industry=payload["industry_competitors"]["industry"],
            market_landscape=payload["industry_competitors"]["market_landscape"],
            key_competitors=_normalize_competitors(
                payload["industry_competitors"].get("key_competitors", [])
            ),
            competitive_position=payload["industry_competitors"]["competitive_position"],
        ),
        financial_health=FinancialHealth(
            metrics=metrics,
            analysis=payload["financial_health"]["analysis"],
        ),
        bull_bear=BullBearCase(
            bull=_normalize_bull_bear_items(payload["bull_bear"].get("bull", []), "Bull"),
            bear=_normalize_bull_bear_items(payload["bull_bear"].get("bear", []), "Bear"),
        ),
        risks=[RiskItem(**risk) for risk in payload["risks"]],
        external_signals=ExternalSignals(
            sentiment=payload["external_signals"]["sentiment"],
            summary=payload["external_signals"]["summary"],
            recent_news=recent_news,
            notable_endorsements_or_criticism=endorsements,
        ),
    )
