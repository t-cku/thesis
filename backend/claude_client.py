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
    "recent_news": ["news item 1"],
    "notable_endorsements_or_criticism": ["endorsement or criticism"]
  }}
}}

Bull/bear selection rules:
- Exactly 3 bull and 3 bear arguments each
- Each must be material, distinct, and evidence-based
- Ground in financials, competitive dynamics, or recent events
- Avoid generic statements"""


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


def generate_one_pager(
    ticker: str,
    company_name: str,
    metrics: FinancialMetrics,
) -> OnePager:
    prompt = ANALYSIS_PROMPT.format(
        ticker=ticker,
        company_name=company_name,
        financial_metrics_json=metrics.model_dump_json(indent=2),
    )

    message = _get_client().messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        tools=[{"type": "web_search_20250305", "name": "web_search", "max_uses": 5}],
        messages=[{"role": "user", "content": prompt}],
    )

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
