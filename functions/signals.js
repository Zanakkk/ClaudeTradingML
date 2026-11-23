import { computeSignal } from "./lib/signal.js";

async function candles(symbol, interval, range) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error(`Yahoo ${r.status}`);
  const j = await r.json();
  const res = j.chart?.result?.[0];
  if (!res) throw new Error("no data");
  const q = res.indicators.quote[0];
  const out = { t: [], open: [], high: [], low: [], close: [], volume: [] };
  res.timestamp.forEach((t, i) => {
    if (q.close[i] == null || q.high[i] == null || q.low[i] == null) return;
    out.t.push(t);
    out.open.push(q.open[i]);
    out.high.push(q.high[i]);
    out.low.push(q.low[i]);
    out.close.push(q.close[i]);
    out.volume.push(q.volume[i] ?? 0);
  });
  return out;
}

// Semua ticker & timeframe diambil paralel.
export async function scanSymbols(symbols, settings) {
  return Promise.all(
    symbols.map(async (symbol) => {
      try {
        const [h1, m15] = await Promise.all([candles(symbol, "1h", "1mo"), candles(symbol, "15m", "5d")]);
        return { symbol, ...computeSignal(h1, m15, settings), updated: m15.t[m15.t.length - 1] };
      } catch (e) {
        return { symbol, action: "ERROR", error: e.message };
      }
    })
  );
}
