export async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export const fmt = (n, d = 2) => (n == null || !isFinite(n) ? "–" : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }));
export const pct = (n) => (n == null || !isFinite(n) ? "–" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`);
export const usd = (n) => (n == null ? "–" : `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`);

export const GROUPS = {
  "Indeks & ETF": ["SPY", "QQQ", "DIA", "IWM", "VTI", "XLK", "XLF", "XLE"],
  "Big Tech": ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA", "NFLX"],
  "Semikonduktor": ["AMD", "AVGO", "TSM", "INTC", "MU", "QCOM"],
  "Keuangan": ["JPM", "BAC", "V", "MA", "GS"],
  "Konsumen & Industri": ["XOM", "CVX", "KO", "DIS", "WMT", "BA"],
  "Crypto & Komoditas": ["BTC-USD", "ETH-USD", "GC=F", "CL=F"],
};
