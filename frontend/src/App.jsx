import { useMemo, useState } from "react";

const API_BASE = "http://localhost:8001";
const STORAGE_KEY = "thesis_saved_analyses_v1";

const KNOWN_TICKERS = {
  apple: "AAPL",
  microsoft: "MSFT",
  google: "GOOGL",
  alphabet: "GOOGL",
  amazon: "AMZN",
  nvidia: "NVDA",
  tesla: "TSLA",
  meta: "META",
  netflix: "NFLX",
  amd: "AMD",
  intel: "INTC",
  salesforce: "CRM",
  oracle: "ORCL",
  ibm: "IBM",
  qualcomm: "QCOM",
  broadcom: "AVGO",
  adobe: "ADBE",
};

function formatCurrencyNumber(value) {
  if (value == null || Number.isNaN(value)) return "N/A";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  return `${sign}$${abs.toFixed(2)}`;
}

function formatPercent(value) {
  if (value == null || Number.isNaN(value)) return "N/A";
  return `${(value * 100).toFixed(1)}%`;
}

function formatRatio(value) {
  if (value == null || Number.isNaN(value)) return "N/A";
  return value.toFixed(2);
}

function splitToBullets(paragraph) {
  return String(paragraph || "")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function extractTickerFromText(text) {
  const str = String(text || "");
  const bracket = str.match(/\(([A-Z]{1,5})\)/);
  if (bracket) return bracket[1];
  const bareTicker = str.match(/\b[A-Z]{1,5}\b/);
  if (bareTicker) return bareTicker[0];
  const lower = str.toLowerCase();
  for (const [name, ticker] of Object.entries(KNOWN_TICKERS)) {
    if (lower.includes(name)) return ticker;
  }
  return null;
}

function oneLineMetricAnalysis(key, value) {
  if (value == null) return "Data not available for this metric yet.";
  const checks = {
    market_cap:
      value > 2e11
        ? "Large-cap scale usually lowers financing risk."
        : "Smaller market cap can imply higher volatility.",
    revenue:
      value > 5e10
        ? "Revenue base is sizable and supports operating leverage."
        : "Revenue base is still modest relative to mega-cap peers.",
    revenue_growth_yoy:
      value > 0.1
        ? "Growth trend is healthy and supports valuation upside."
        : "Growth pace is moderate; rerating may require acceleration.",
    gross_margin:
      value > 0.45
        ? "High gross margin suggests strong pricing power or mix."
        : "Lower gross margin can limit flexibility under competition.",
    operating_margin:
      value > 0.2
        ? "Operating discipline appears strong at current scale."
        : "Operating margin leaves less buffer in a downturn.",
    net_margin:
      value > 0.15
        ? "Net profitability is robust after all costs."
        : "Net margin is thin; earnings are more sensitive to shocks.",
    total_debt:
      value < 5e10
        ? "Debt load appears manageable for most large issuers."
        : "Debt burden is material and worth tracking vs cash flow.",
    cash_and_equivalents:
      value > 2e10
        ? "Cash cushion improves strategic and defensive flexibility."
        : "Cash reserve is limited relative to larger peers.",
    free_cash_flow:
      value > 1e10
        ? "Free cash flow supports buybacks, reinvestment, and resilience."
        : "Lower free cash flow may constrain optionality.",
    pe_ratio:
      value < 25
        ? "Valuation multiple is comparatively reasonable."
        : "Premium multiple implies higher execution expectations.",
    forward_pe:
      value < 25
        ? "Forward valuation looks less stretched on next-year earnings."
        : "Forward valuation still prices in strong execution.",
    price_to_sales:
      value < 6
        ? "Revenue multiple is within a moderate range for quality growth."
        : "High sales multiple requires durable growth to hold.",
    ev_to_ebitda:
      value < 18
        ? "EV/EBITDA suggests more balanced valuation risk."
        : "Elevated EV/EBITDA signals rich expectations.",
  };
  return checks[key] || "This metric should be assessed with peers and trend history.";
}

function parseAnalystMix(summary) {
  const text = String(summary || "");
  const buy = Number((text.match(/(\d+)\s+Buy/i) || [])[1] || 0);
  const hold = Number((text.match(/(\d+)\s+Hold/i) || [])[1] || 0);
  const sell = Number((text.match(/(\d+)\s+Sell/i) || [])[1] || 0);
  const total = buy + hold + sell;
  if (!total) return null;
  const b = (buy / total) * 100;
  const h = (hold / total) * 100;
  return {
    buy,
    hold,
    sell,
    pie: `conic-gradient(#16a34a 0 ${b}%, #eab308 ${b}% ${b + h}%, #dc2626 ${b + h}% 100%)`,
  };
}

function getSavedAnalyses() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAnalyses(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

const metricRows = [
  ["market_cap", "Market Cap", formatCurrencyNumber],
  ["revenue", "Revenue", formatCurrencyNumber],
  ["revenue_growth_yoy", "Revenue Growth YoY", formatPercent],
  ["gross_margin", "Gross Margin", formatPercent],
  ["operating_margin", "Operating Margin", formatPercent],
  ["net_margin", "Net Margin", formatPercent],
  ["total_debt", "Total Debt", formatCurrencyNumber],
  ["cash_and_equivalents", "Cash & Equivalents", formatCurrencyNumber],
  ["free_cash_flow", "Free Cash Flow", formatCurrencyNumber],
  ["pe_ratio", "P/E Ratio", formatRatio],
  ["forward_pe", "Forward P/E", formatRatio],
  ["price_to_sales", "Price/Sales", formatRatio],
  ["ev_to_ebitda", "EV/EBITDA", formatRatio],
];

function History({ historyQuery, setHistoryQuery, onLoad }) {
  const rows = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();
    return getSavedAnalyses()
      .filter((item) => {
        if (!query) return true;
        const date = String(item.generated_at || "").toLowerCase();
        const ticker = String(item.ticker || "").toLowerCase();
        const name = String(item.company_name || "").toLowerCase();
        return date.includes(query) || ticker.includes(query) || name.includes(query);
      })
      .sort((a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime());
  }, [historyQuery]);

  return (
    <section className="card">
      <h3>Saved analyses</h3>
      <input
        placeholder="Search by date, company, ticker"
        value={historyQuery}
        onChange={(e) => setHistoryQuery(e.target.value)}
      />
      <div className="historyList">
        {rows.length === 0 ? (
          <p>No saved analyses yet.</p>
        ) : (
          rows.map((item) => (
            <button
              key={`${item.ticker}-${item.generated_at}`}
              className="historyItem"
              onClick={() => onLoad(item)}
            >
              <strong>
                {item.ticker} - {item.company_name}
              </strong>
              <span>{new Date(item.generated_at).toLocaleString()}</span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

export default function App() {
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [metricToggleKey, setMetricToggleKey] = useState(null);
  const [historyQuery, setHistoryQuery] = useState("");

  async function analyzeTicker(symbol) {
    if (!symbol) return;
    setLoading(true);
    setError("");
    setMetricToggleKey(null);
    try {
      const res = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: symbol }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.detail || "Analysis request failed");
      setAnalysis(payload);
      setTicker(payload.ticker);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function saveCurrentAnalysis() {
    if (!analysis) return;
    const existing = getSavedAnalyses().filter(
      (item) => !(item.ticker === analysis.ticker && item.generated_at === analysis.generated_at)
    );
    existing.push(analysis);
    saveAnalyses(existing);
    setHistoryQuery((x) => x);
  }

  const analystMix = analysis ? parseAnalystMix(analysis.external_signals?.summary) : null;

  return (
    <main className="page">
      <header className="header">
        <h1>Thesis</h1>
        <p>Structured stock one-pager for fast decision-making.</p>
      </header>

      <section className="card">
        <label htmlFor="tickerInput">Ticker</label>
        <div className="searchRow">
          <input
            id="tickerInput"
            value={ticker}
            placeholder="e.g. AAPL"
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && analyzeTicker(ticker.trim())}
          />
          <button disabled={loading} onClick={() => analyzeTicker(ticker.trim())}>
            {loading ? "Analyzing..." : "Analyze"}
          </button>
        </div>
      </section>

      {error ? <p className="error">{error}</p> : null}

      <History
        historyQuery={historyQuery}
        setHistoryQuery={setHistoryQuery}
        onLoad={(item) => {
          setAnalysis(item);
          setTicker(item.ticker);
        }}
      />

      {!analysis ? null : (
        <section className="content">
          <div className="titleBlock">
            <h2>
              {analysis.company_name} ({analysis.ticker})
            </h2>
            <p>Generated {new Date(analysis.generated_at).toLocaleString()}</p>
            <div className="actionRow">
              <button onClick={saveCurrentAnalysis}>Save analysis</button>
              <button onClick={() => window.print()}>Export PDF</button>
            </div>
          </div>

          <section className="card">
            <h3>1. Company overview</h3>
            <p>{analysis.company_overview?.description}</p>
            <p>
              <strong>Differentiation:</strong> {analysis.company_overview?.differentiation}
            </p>
            <p>
              <strong>Products/services:</strong>{" "}
              {(analysis.company_overview?.products_services || []).join(", ")}
            </p>
            <p>
              <strong>Leadership:</strong> {analysis.company_overview?.leadership}
            </p>
          </section>

          <section className="card">
            <h3>2. Financials / valuation</h3>
            <p className="hint">Click any number to toggle one-line analysis.</p>
            <table className="metricsTable">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {metricRows.map(([key, label, formatter]) => {
                  const value = analysis.financial_health?.metrics?.[key];
                  const active = metricToggleKey === key;
                  return (
                    <tr key={key}>
                      <td>{label}</td>
                      <td>
                        <button
                          className={`metricValue ${active ? "active" : ""}`}
                          onClick={() => setMetricToggleKey(active ? null : key)}
                        >
                          {formatter(value)}
                        </button>
                        {active ? (
                          <div className="inlineNote">{oneLineMetricAnalysis(key, value)}</div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p>{analysis.financial_health?.analysis}</p>
          </section>

          <section className="card">
            <h3>3. Industry & competitors</h3>
            <p>
              <strong>Industry:</strong> {analysis.industry_competitors?.industry}
            </p>
            <p>{analysis.industry_competitors?.market_landscape}</p>
            <ul>
              {(analysis.industry_competitors?.key_competitors || []).map((name) => {
                const competitorTicker = extractTickerFromText(name);
                if (!competitorTicker) return <li key={name}>{name}</li>;
                return (
                  <li key={name}>
                    <button
                      className="linkButton"
                      onClick={() => {
                        setTicker(competitorTicker);
                        analyzeTicker(competitorTicker);
                      }}
                    >
                      {name}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p>
              <strong>Position:</strong> {analysis.industry_competitors?.competitive_position}
            </p>
          </section>

          <section className="card">
            <h3>4. Bull / bear case</h3>
            <div className="split">
              <div>
                {(analysis.bull_bear?.bull || []).map((text, idx) => (
                  <div className="subCard positive" key={`bull-${idx}`}>
                    <h4>Bull {idx + 1}</h4>
                    <ul>
                      {splitToBullets(text).map((bullet, i) => (
                        <li key={`bull-${idx}-${i}`}>{bullet}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div>
                {(analysis.bull_bear?.bear || []).map((text, idx) => (
                  <div className="subCard negative" key={`bear-${idx}`}>
                    <h4>Bear {idx + 1}</h4>
                    <ul>
                      {splitToBullets(text).map((bullet, i) => (
                        <li key={`bear-${idx}-${i}`}>{bullet}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="card">
            <h3>5. Risks</h3>
            <ul>
              {(analysis.risks || []).map((risk, idx) => (
                <li key={`risk-${idx}`}>
                  <strong>{risk.category}:</strong> {risk.description}
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h3>6. External signals</h3>
            <p>
              <strong>Overall sentiment:</strong> {analysis.external_signals?.sentiment}
            </p>
            <ul>
              {splitToBullets(analysis.external_signals?.summary || "").map((point, idx) => (
                <li key={`summary-${idx}`}>{point}</li>
              ))}
            </ul>
            {!analystMix ? null : (
              <div className="analystMix">
                <div className="pie" style={{ background: analystMix.pie }} />
                <ul>
                  <li>Buy: {analystMix.buy}</li>
                  <li>Hold: {analystMix.hold}</li>
                  <li>Sell: {analystMix.sell}</li>
                </ul>
              </div>
            )}
            <h4>Recent news</h4>
            <ul>
              {(analysis.external_signals?.recent_news || []).map((item, idx) => {
                const isObj = typeof item === "object" && item !== null;
                const text = isObj ? item.text : item;
                const source = isObj ? item.source_url : null;
                return (
                  <li key={`news-${idx}`}>
                    {text}{" "}
                    {source ? (
                      <a href={source} target="_blank" rel="noreferrer noopener">
                        source
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <h4>Endorsements / criticism</h4>
            <ul>
              {(analysis.external_signals?.notable_endorsements_or_criticism || []).map(
                (item, idx) => {
                  const isObj = typeof item === "object" && item !== null;
                  const text = isObj ? item.text : item;
                  const source = isObj ? item.source_url : null;
                  return (
                    <li key={`end-${idx}`}>
                      {text}{" "}
                      {source ? (
                        <a href={source} target="_blank" rel="noreferrer noopener">
                          source
                        </a>
                      ) : null}
                    </li>
                  );
                }
              )}
            </ul>
          </section>
        </section>
      )}
    </main>
  );
}
