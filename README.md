# Thesis

A stock research one-pager for busy investors who want structured analysis without reading 50-page reports.

**Core interaction:** Type a ticker → get a structured one-pager with six sections.

## Stack

- **Frontend:** React + TypeScript + Vite
- **Backend:** Python (FastAPI) + SQLite
- **AI:** Anthropic API (Claude) with optional web search
- **Market data:** yfinance

## Features

- Generate a six-section research one-pager for any ticker
- Sticky section jump nav for fast scanning
- User accounts with email verification
- Save and revisit generated theses
- Structured financial metrics (deterministic numbers + AI narrative)

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Add your Anthropic API key to .env
```

| Variable | Required | Notes |
|----------|----------|-------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `SECRET_KEY` | Yes in prod | JWT signing secret |
| `DATABASE_URL` | No | Defaults to `sqlite:///./thesis.db` |
| `FRONTEND_URL` | No | Defaults to `http://localhost:5173` |
| `SMTP_*` | No | Enable real verification emails; without SMTP the API logs a local verify link |

See `.env.example` for the full list.

## Run

Thesis API runs on **port 8001** (not 8000). Start from the project root.

```bash
# Backend
source .venv/bin/activate
./run.sh
# or: uvicorn backend.main:app --reload --port 8001

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

- App: [http://localhost:5173](http://localhost:5173)
- API docs: [http://localhost:8001/docs](http://localhost:8001/docs)
- Health: `curl http://localhost:8001/health`

Override the API base URL in the frontend with `VITE_API_BASE_URL` if needed.

### Quick API check

```bash
curl -s -X POST http://localhost:8001/analyze \
  -H "Content-Type: application/json" \
  -d '{"ticker":"AAPL"}' | python -m json.tool
```

## One-pager sections

`POST /analyze` with `{ "ticker": "AAPL" }` returns a `OnePager` (`backend/models.py`):

| Section | Field | Contents |
|---------|-------|----------|
| 1. Company overview | `company_overview` | What they do, differentiation, products/services, leadership |
| 2. Industry & competitors | `industry_competitors` | Market landscape, competitors, positioning |
| 3. Financial health | `financial_health` | Raw `metrics` (data API) + narrative `analysis` (AI) |
| 4. Bull / bear case | `bull_bear` | Exactly 3 bull and 3 bear arguments |
| 5. Risks | `risks` | Categorized (regulatory, competitive, macro, execution, other) |
| 6. External signals | `external_signals` | Sentiment, recent news, endorsements/criticism |

### Pipeline

1. `financial_client.py` — company name + metrics from yfinance
2. `claude_client.py` — web search + synthesis into the six-section JSON
3. `main.py` — `POST /analyze`; injects real metrics (Claude writes the narrative only)

### Design choices

- **Financial numbers are structured, not prose.** Metrics are fetched deterministically; Claude only writes the analysis narrative.
- **Bull/bear counts are enforced** (exactly 3 per side via Pydantic).
- **Risks are categorized** for UI badges/grouping.
- **Sentiment is an enum** (`bullish` | `bearish` | `neutral` | `mixed`).

### Financial metrics

| Tier | Fields | Rule |
|------|--------|------|
| **Metadata** | `currency`, `fiscal_period` | Always set; `currency` defaults to `USD` |
| **Required** | `market_cap`, `revenue`, `revenue_growth_yoy`, `gross_margin`, `operating_margin`, `net_margin`, `total_debt`, `cash_and_equivalents`, `free_cash_flow`, `pe_ratio` | Always attempted; may be `null` |
| **Optional** | `forward_pe`, `price_to_sales`, `ev_to_ebitda` | Included when available |

Constants: `REQUIRED_FINANCIAL_METRIC_FIELDS`, `OPTIONAL_FINANCIAL_METRIC_FIELDS`, `FINANCIAL_METADATA_FIELDS` in `backend/models.py`.

## Auth and saved theses

Users can register, verify email, log in, save one-pagers, and delete their account. Saving requires a **verified** email.

### Auth

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/auth/register` | POST | No | Create account; start email verification |
| `/auth/login` | POST | No | Log in; receive JWT |
| `/auth/me` | GET | Bearer | Current user |
| `/auth/verify-email` | POST | No | Verify with `{ "token": "..." }` |
| `/auth/resend-verification` | POST | Bearer | Resend verification |
| `/auth/me` | DELETE | Bearer | Delete account (`{ "password": "..." }`) |

Without SMTP, registration returns/logs a local verification URL (`/?verify=...`).

### Saved theses

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/theses` | POST | Bearer + verified | Save a `OnePager` |
| `/theses` | GET | Bearer + verified | List saved theses |
| `/theses/{id}` | GET | Bearer + verified | Fetch a saved thesis |
| `/theses/{id}` | DELETE | Bearer + verified | Delete a saved thesis |

The frontend stores the JWT in `localStorage` and sends `Authorization: Bearer <token>`.

## Project layout

```
backend/          FastAPI app, auth, Claude + yfinance clients
frontend/         React + Vite UI
scripts/          Helper scripts (setup check, start backend/frontend)
run.sh            Start API on port 8001
requirements.txt  Python deps
.env.example      Env template
```

## Validate the contract

```bash
python -c "from backend.models import OnePager; print(OnePager.model_json_schema()['title'])"
```
