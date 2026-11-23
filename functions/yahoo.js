// Pembungkus Yahoo Finance (tidak resmi). Semua fetch lewat sini.
const HEADERS = { "User-Agent": "Mozilla/5.0" };
const BASE = "https://query1.finance.yahoo.com";

export async function candles(symbol, interval, range) {
  const r = await fetch(`${BASE}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`, { headers: HEADERS });
  if (!r.ok) throw new Error(`Yahoo ${r.status}`);
  const j = await r.json();
  const res = j.chart?.result?.[0];
  if (!res?.timestamp) throw new Error("no data");
  const q = res.indicators.quote[0];
  const out = { meta: res.meta, t: [], open: [], high: [], low: [], close: [], volume: [] };
  res.timestamp.forEach((t, i) => {
    if (q.close[i] == null || q.high[i] == null || q.low[i] == null || q.open[i] == null) return;
    out.t.push(t);
    out.open.push(q.open[i]);
    out.high.push(q.high[i]);
    out.low.push(q.low[i]);
    out.close.push(q.close[i]);
    out.volume.push(q.volume[i] ?? 0);
  });
  return out;
}

export async function search(q) {
  const r = await fetch(`${BASE}/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0&listsCount=0`, { headers: HEADERS });
  if (!r.ok) throw new Error(`Yahoo ${r.status}`);
  const j = await r.json();
  const ok = ["EQUITY", "ETF", "INDEX", "CRYPTOCURRENCY", "CURRENCY", "FUTURE", "MUTUALFUND"];
  return (j.quotes || [])
    .filter((x) => x.symbol && ok.includes(x.quoteType))
    .map((x) => ({ symbol: x.symbol, name: x.shortname || x.longname || "", exchange: x.exchDisp || "", type: x.quoteType }));
}

// Harga terakhir + perubahan harian dari candle harian.
export async function quotes(symbols) {
  return Promise.all(
    symbols.map(async (symbol) => {
      try {
        const c = await candles(symbol, "1d", "5d");
        const n = c.close.length;
        const price = c.meta.regularMarketPrice ?? c.close[n - 1];
        const prev = n >= 2 ? c.close[n - 2] : c.meta.chartPreviousClose;
        return {
          symbol,
          name: c.meta.shortName || c.meta.longName || "",
          currency: c.meta.currency,
          price,
          prev,
          changePct: prev ? ((price - prev) / prev) * 100 : null,
        };
      } catch (e) {
        return { symbol, error: e.message };
      }
    })
  );
}
