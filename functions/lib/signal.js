import { ema, atr, stochastic } from "./indicators.js";

const last = (a) => a[a.length - 1];
const feeSide = (usd, s) => Math.max(s.minFeeUsd, (usd * s.feePctPerSide) / 100) + s.fixedFeeUsd;

/**
 * Sinyal multi-timeframe (baseline rule-based) + hitungan fee Gotrade.
 *  - 1 jam  : arah tren (close > EMA50 dan EMA50 naik)
 *  - 15 men : timing masuk (pullback ke EMA20 + stochastic cross naik dari zona bawah)
 *  - Exit   : SL/TP berbasis ATR; sinyal dilewati kalau fee memakan terlalu banyak profit
 * Gotrade = long-only, jadi hanya BUY atau WAIT.
 */
export function computeSignal(h1, m15, s) {
  if (h1.close.length < 55 || m15.close.length < 30) return { action: "NO_DATA" };

  const e50 = ema(h1.close, 50);
  const trendUp = last(h1.close) > last(e50) && last(e50) > e50[e50.length - 4];

  const e20 = ema(m15.close, 20);
  const { k, d } = stochastic(m15.high, m15.low, m15.close);
  const a = atr(m15.high, m15.low, m15.close, 14);

  const n = m15.close.length - 1;
  const price = m15.close[n];
  const atrNow = a[n];

  let crossUp = false;
  for (let i = n; i > n - 3; i--) {
    if (k[i] != null && d[i] != null && k[i - 1] != null && d[i - 1] != null) {
      if (k[i - 1] <= d[i - 1] && k[i] > d[i] && Math.min(k[i - 1], d[i - 1]) < 30) crossUp = true;
    }
  }
  const nearEma = Math.abs(price - e20[n]) <= atrNow;
  const base = { price, trend: trendUp ? "UP" : "DOWN/SIDEWAYS", stochK: k[n], atr: atrNow };

  if (!(trendUp && crossUp && nearEma && atrNow > 0)) return { action: "WAIT", ...base };

  const slDist = atrNow * s.slAtr;
  const tpDist = atrNow * s.tpAtr;
  // ukuran posisi: risiko s.riskPct% modal di jarak SL, maksimal seluruh modal
  const positionUsd = Math.min(s.capitalUsd, (s.capitalUsd * s.riskPct) / 100 / (slDist / price));
  const fee = feeSide(positionUsd, s) * 2; // beli + jual
  const grossTp = (positionUsd * tpDist) / price;
  const netTp = grossTp - fee;
  const netSl = -((positionUsd * slDist) / price) - fee;
  const result = {
    ...base,
    sl: price - slDist,
    tp: price + tpDist,
    positionUsd,
    fee,
    netTp,
    netSl,
  };
  if (grossTp < fee * s.minRewardToFee) return { action: "SKIP_FEE", ...result };
  return { action: "BUY", ...result };
}
