# Thesis

Stock research one-pager: type a ticker, get a structured six-section brief.

**Stack:** React + Vite frontend, FastAPI backend, Claude (Anthropic) + yfinance.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Add your `ANTHROPIC_API_KEY` to `.env`. Optional vars (SMTP, `SECRET_KEY`, etc.) are listed in `.env.example`.

## Run

From the project root:

```bash
# Backend (port 8001)
./run.sh

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

- App: http://localhost:5173
- API docs: http://localhost:8001/docs

## What you get

Six sections: company overview, industry & competitors, financial health, bull/bear case, risks, and external signals.

Create an account to save theses. Without SMTP configured, verification links are printed locally.
