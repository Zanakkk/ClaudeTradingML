import { computeSignal } from "./lib/signal.js";

const DEFAULT = "SPY,QQQ,NVDA,AAPL,MSFT,TSLA,AMD,AMZN,META,GOOGL";

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

export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const symbols = (url.searchParams.get("symbols") || DEFAULT)
    .split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 20);

  // semua ticker & timeframe diambil paralel -> respons ~1 detik
  const results = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const [h1, m15] = await Promise.all([candles(symbol, "1h", "1mo"), candles(symbol, "15m", "5d")]);
        return { symbol, ...computeSignal(h1, m15), updated: m15.t[m15.t.length - 1] };
      } catch (e) {
        return { symbol, action: "ERROR", error: e.message };
      }
    })
  );

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  // cache CDN 60 detik: banyak user tidak membebani Yahoo
  res.setHeader("Cache-Control", "public, max-age=30, s-maxage=60, stale-while-revalidate=120");
  res.end(JSON.stringify({ generatedAt: Date.now(), results }));
}
