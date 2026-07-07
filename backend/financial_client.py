import math
from typing import Any

import yfinance as yf

from backend.models import FinancialMetrics, OPTIONAL_FINANCIAL_METRIC_FIELDS


class TickerNotFoundError(ValueError):
    pass


def _safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(number) or math.isinf(number):
        return None
    return number


def fetch_financial_data(ticker: str) -> tuple[str, FinancialMetrics]:
    """Fetch company name and financial metrics for a ticker via yfinance."""
    stock = yf.Ticker(ticker)
    info = stock.info or {}

    company_name = info.get("longName") or info.get("shortName")
    if not company_name:
        raise TickerNotFoundError(f"Ticker not found: {ticker}")

    metrics_data: dict[str, Any] = {
        "currency": info.get("currency") or "USD",
        "fiscal_period": "TTM",
        "market_cap": _safe_float(info.get("marketCap")),
        "revenue": _safe_float(info.get("totalRevenue")),
        "revenue_growth_yoy": _safe_float(info.get("revenueGrowth")),
        "gross_margin": _safe_float(info.get("grossMargins")),
        "operating_margin": _safe_float(info.get("operatingMargins")),
        "net_margin": _safe_float(info.get("profitMargins")),
        "total_debt": _safe_float(info.get("totalDebt")),
        "cash_and_equivalents": _safe_float(info.get("totalCash")),
        "free_cash_flow": _safe_float(info.get("freeCashflow")),
        "pe_ratio": _safe_float(info.get("trailingPE")),
    }

    optional_sources = {
        "forward_pe": info.get("forwardPE"),
        "price_to_sales": info.get("priceToSalesTrailing12Months"),
        "ev_to_ebitda": info.get("enterpriseToEbitda"),
    }
    for field in OPTIONAL_FINANCIAL_METRIC_FIELDS:
        value = _safe_float(optional_sources[field])
        if value is not None:
            metrics_data[field] = value

    return company_name, FinancialMetrics(**metrics_data)
