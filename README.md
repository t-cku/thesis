# Thesis

A stock research one-pager for busy investors who want structured analysis without reading 50-page reports.

**Core interaction:** Type a ticker → get a structured one-pager with six sections.

## Stack (planned)

- **Frontend:** React + shadcn/ui
- **Backend:** Python (FastAPI)
- **AI:** Anthropic API with web search
- **Data:** yfinance (or free REST alternative)

## API contract (Phase 0)

Everything in the pipeline converges on a single response shape: `OnePager`.

### `POST /analyze`

**Request**

```json
{ "ticker": "AAPL" }
```

**Response:** `OnePager` (see `backend/models.py`)

| Section | Model field | Contents |
|---------|-------------|----------|
| 1. Company overview | `company_overview` | What they do, differentiation, products/services, leadership |
| 2. Industry & competitors | `industry_competitors` | Market landscape, key competitors, positioning |
| 3. Financial health | `financial_health` | Raw `metrics` (from data API) + narrative `analysis` (from AI) |
| 4. Bull / bear case | `bull_bear` | Exactly 3 bull and 3 bear arguments each |
| 5. Risks | `risks` | Categorized risks (regulatory, competitive, macro, execution, other) |
| 6. External signals | `external_signals` | Sentiment, recent news, endorsements/criticism |

### Financial metrics: required vs optional

Phase 1 must **attempt every required field** on each fetch. Values may be `null` when unavailable (e.g. pre-revenue companies), but the field must be present. Optional fields are included only when the data source returns them.

| Tier | Fields | Rule |
|------|--------|------|
| **Metadata** | `currency`, `fiscal_period` | Always set; `currency` defaults to `USD` |
| **Required** | `market_cap`, `revenue`, `revenue_growth_yoy`, `gross_margin`, `operating_margin`, `net_margin`, `total_debt`, `cash_and_equivalents`, `free_cash_flow`, `pe_ratio` | Must attempt fetch; UI always renders these rows |
| **Optional** | `forward_pe`, `price_to_sales`, `ev_to_ebitda` | Include when available; omit gracefully |

Constants for programmatic use: `REQUIRED_FINANCIAL_METRIC_FIELDS`, `OPTIONAL_FINANCIAL_METRIC_FIELDS`, `FINANCIAL_METADATA_FIELDS` in `backend/models.py`.

### Design decisions

- **Financial numbers are structured, not prose.** `FinancialMetrics` holds raw data fetched deterministically; Claude only writes the `analysis` narrative.
- **Bull/bear counts are enforced.** Pydantic validates exactly 3 items per side.
- **Risks are categorized** so the UI can group or badge them.
- **Sentiment is an enum** (`bullish` | `bearish` | `neutral` | `mixed`) for consistent rendering.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Add your Anthropic API key to .env
```

## Phase 1: Run the backend

**Goal:** `POST /analyze` with a ticker returns a full `OnePager` JSON.

**Important:** Run from the `Thesis` project root, not from inside `backend/`.

**Note:** Port 8000 may already be used by another project (e.g. WorkoutLogger). Thesis runs on **8001**.

```bash
cd ~/Documents/Personal\ Github\ Projects/Thesis
source .venv/bin/activate
./run.sh
```

Or without the script:

```bash
cd ~/Documents/Personal\ Github\ Projects/Thesis
source .venv/bin/activate
uvicorn backend.main:app --reload --port 8001
```

In another terminal:

```bash
curl -s -X POST http://localhost:8001/analyze \
  -H "Content-Type: application/json" \
  -d '{"ticker":"AAPL"}' | python -m json.tool
```

Health check:

```bash
curl http://localhost:8001/health
```

API docs: [http://localhost:8001/docs](http://localhost:8001/docs)

### Phase 1 pipeline

1. `financial_client.py` — fetches company name + metrics from yfinance
2. `claude_client.py` — web search + synthesis into the 6-section JSON
3. `main.py` — wires `POST /analyze`; injects real metrics (Claude only writes the narrative)

## Validate the contract

```bash
python -c "from backend.models import OnePager; print(OnePager.model_json_schema()['title'])"
```

## Phase 2: Frontend

Run the React app in a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

By default the app calls `http://localhost:8001/analyze`. Override with `VITE_API_BASE_URL` if needed.

## User accounts and saved theses

Users can create an account, verify email, log in, save generated one-pagers, and delete their account.

### Auth endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/auth/register` | POST | No | Create account (`email`, `password`, optional `name`) and start email verification |
| `/auth/login` | POST | No | Log in and receive a JWT |
| `/auth/me` | GET | Bearer token | Return the current user |
| `/auth/verify-email` | POST | No | Verify email with `{ "token": "..." }` |
| `/auth/resend-verification` | POST | Bearer token | Resend verification email/link |
| `/auth/me` | DELETE | Bearer token | Delete account (`{ "password": "..." }`) and cascade-delete saved theses |

Saving theses requires a **verified** email.

### Email verification

- If `SMTP_HOST` + `SMTP_FROM` are set, Thesis emails a verification link.
- If SMTP is not configured (local default), the API returns/logs a local verification URL you can open in the browser (`/?verify=...`).

### Saved thesis endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/theses` | POST | Bearer + verified | Save a `OnePager` to the user's account |
| `/theses` | GET | Bearer + verified | List saved theses (summary) |
| `/theses/{id}` | GET | Bearer + verified | Fetch a full saved thesis |
| `/theses/{id}` | DELETE | Bearer + verified | Delete a saved thesis |

The frontend stores the JWT in `localStorage` and sends it as `Authorization: Bearer <token>`.

### Database

Default: SQLite at `./thesis.db` (`DATABASE_URL`). Existing local DBs are auto-migrated with verification columns on startup.

SQLite is used by default (`thesis.db` in the project root). Configure with `DATABASE_URL` in `.env`. Set a strong `SECRET_KEY` in production.
