import { ema, atr, stochastic } from "./indicators.js";

const last = (a) => a[a.length - 1];

/**
 * Sinyal multi-timeframe (baseline rule-based, lapisan ML menyusul).
 *  - 1 jam  : arah tren (close > EMA50 dan EMA50 naik)
 *  - 15 men : timing masuk (pullback ke EMA20 + stochastic cross naik dari zona bawah)
 *  - Exit   : SL = 1x ATR, TP = 1.5x ATR (15 menit)
 * Gotrade = spot/long-only, jadi hanya BUY atau WAIT.
 */
export function computeSignal(h1, m15) {
  if (h1.close.length < 55 || m15.close.length < 30) return { action: "NO_DATA" };

  const e50 = ema(h1.close, 50);
  const trendUp = last(h1.close) > last(e50) && last(e50) > e50[e50.length - 4];

  const e20 = ema(m15.close, 20);
  const { k, d } = stochastic(m15.high, m15.low, m15.close);
  const a = atr(m15.high, m15.low, m15.close, 14);

  const n = m15.close.length - 1;
  const price = m15.close[n];
  const atrNow = a[n];

  // cross naik K di atas D dalam 3 candle terakhir, berasal dari zona < 30
  let crossUp = false;
  for (let i = n; i > n - 3; i--) {
    if (k[i] != null && d[i] != null && k[i - 1] != null && d[i - 1] != null) {
      if (k[i - 1] <= d[i - 1] && k[i] > d[i] && Math.min(k[i - 1], d[i - 1]) < 30) crossUp = true;
    }
  }
  const nearEma = Math.abs(price - e20[n]) <= atrNow * 1.0;

  const buy = trendUp && crossUp && nearEma && atrNow > 0;
  return {
    action: buy ? "BUY" : "WAIT",
    price,
    sl: buy ? price - atrNow : null,
    tp: buy ? price + atrNow * 1.5 : null,
    trend: trendUp ? "UP" : "DOWN/SIDEWAYS",
    stochK: k[n],
    atr: atrNow,
  };
}
