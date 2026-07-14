import json
import os
import re
from datetime import datetime, timezone

import anthropic
from anthropic import Anthropic

from backend.models import (
    BullBearCase,
    CompanyOverview,
    ExternalSignals,
    FinancialHealth,
    FinancialMetrics,
    IndustryCompetitors,
    OnePager,
    RiskItem,
)

def _get_client() -> Anthropic:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY is not configured")
    return Anthropic(api_key=api_key)


ANALYSIS_PROMPT = """You are a concise equity research analyst writing a one-pager for a busy investor.

Analyze {ticker} ({company_name}).

{search_instructions}
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
    "key_competitors": ["competitor 1", "competitor 2"],
    "competitive_position": "where this company sits"
  }},
  "financial_health": {{
    "analysis": "narrative on financial soundness and valuation using the provided metrics"
  }},
  "bull_bear": {{
    "bull": ["argument 1", "argument 2", "argument 3"],
    "bear": ["argument 1", "argument 2", "argument 3"]
  }},
  "risks": [
    {{"category": "regulatory|competitive|macro|execution|other", "description": "risk description"}}
  ],
  "external_signals": {{
    "sentiment": "bullish|bearish|neutral|mixed",
    "summary": "sentiment summary",
    "recent_news": [
      {{
        "text": "news headline",
        "source": "Bloomberg",
        "date": "2026-07-13"
      }}
    ],
    "notable_endorsements_or_criticism": ["endorsement or criticism"]
  }}
}}

Recent news rules:
- Include at least 1 recent item
- EVERY item MUST include text, source (publisher name), and date (ISO YYYY-MM-DD)
- Source and date are required — never omit them
{news_source_rule}

Bull/bear selection rules:
- Exactly 3 bull and 3 bear arguments each
- Each must be material, distinct, and evidence-based
- Ground in financials, competitive dynamics, or recent events
- Avoid generic statements"""


WEB_SEARCH_INSTRUCTIONS = (
    "Use web search for recent news, leadership details, competitors, market "
    "sentiment, and qualitative context."
)

NO_WEB_SEARCH_INSTRUCTIONS = (
    "Web search is unavailable for this request. Use well-established public "
    "knowledge about the company for qualitative context. Be explicit when "
    "information may be incomplete or not current."
)

WEB_SEARCH_NEWS_RULE = (
    "- Prefer real publisher names and publication dates from search results"
)

NO_WEB_SEARCH_NEWS_RULE = (
    "- If you cannot cite a specific recent article, still provide best-known "
    "recent themes with a realistic source label (e.g. company filings / major "
    "outlets) and an approximate ISO date; do not leave source/date blank"
)


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


def _build_prompt(ticker: str, company_name: str, metrics: FinancialMetrics, *, use_web_search: bool) -> str:
    return ANALYSIS_PROMPT.format(
        ticker=ticker,
        company_name=company_name,
        financial_metrics_json=metrics.model_dump_json(indent=2),
        search_instructions=(
            WEB_SEARCH_INSTRUCTIONS if use_web_search else NO_WEB_SEARCH_INSTRUCTIONS
        ),
        news_source_rule=(
            WEB_SEARCH_NEWS_RULE if use_web_search else NO_WEB_SEARCH_NEWS_RULE
        ),
    )


def _call_claude(prompt: str, *, use_web_search: bool) -> anthropic.types.Message:
    kwargs: dict = {
        "model": os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
        "max_tokens": 4096,
        "messages": [{"role": "user", "content": prompt}],
    }
    if use_web_search:
        kwargs["tools"] = [
            {"type": "web_search_20250305", "name": "web_search", "max_uses": 5}
        ]
    return _get_client().messages.create(**kwargs)


def _is_forbidden(exc: Exception) -> bool:
    if isinstance(exc, anthropic.PermissionDeniedError):
        return True
    message = str(exc).lower()
    return "403" in message or "forbidden" in message or "request not allowed" in message


def generate_one_pager(
    ticker: str,
    company_name: str,
    metrics: FinancialMetrics,
) -> OnePager:
    use_web_search = os.getenv("ANTHROPIC_DISABLE_WEB_SEARCH", "").lower() not in {
        "1",
        "true",
        "yes",
    }

    try:
        message = _call_claude(
            _build_prompt(ticker, company_name, metrics, use_web_search=use_web_search),
            use_web_search=use_web_search,
        )
    except Exception as exc:
        if use_web_search and _is_forbidden(exc):
            print(
                "Warning: Anthropic rejected web-search request (403). "
                "Retrying analysis without web search."
            )
            message = _call_claude(
                _build_prompt(ticker, company_name, metrics, use_web_search=False),
                use_web_search=False,
            )
        else:
            raise

    payload = json.loads(_strip_fences(_extract_text(message)))

    return OnePager(
        ticker=ticker,
        company_name=company_name,
        generated_at=datetime.now(timezone.utc),
        company_overview=CompanyOverview(**payload["company_overview"]),
        industry_competitors=IndustryCompetitors(**payload["industry_competitors"]),
        financial_health=FinancialHealth(
            metrics=metrics,
            analysis=payload["financial_health"]["analysis"],
        ),
        bull_bear=BullBearCase(**payload["bull_bear"]),
        risks=[RiskItem(**risk) for risk in payload["risks"]],
        external_signals=ExternalSignals(**payload["external_signals"]),
    )
