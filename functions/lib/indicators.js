// Indikator teknikal murni (tanpa dependency) — cepat, dihitung per request.

export function ema(values, period) {
  const k = 2 / (period + 1);
  const out = [];
  let prev;
  values.forEach((v, i) => {
    prev = i === 0 ? v : v * k + prev * (1 - k);
    out.push(prev);
  });
  return out;
}

export function sma(values, period) {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    let s = 0;
    for (let j = i - period + 1; j <= i; j++) s += values[j];
    return s / period;
  });
}

export function atr(high, low, close, period = 14) {
  const tr = high.map((h, i) =>
    i === 0 ? h - low[i] : Math.max(h - low[i], Math.abs(h - close[i - 1]), Math.abs(low[i] - close[i - 1]))
  );
  return sma(tr, period);
}

// Stochastic %K (smoothed) dan %D
export function stochastic(high, low, close, kPeriod = 14, dPeriod = 3) {
  const rawK = close.map((c, i) => {
    if (i < kPeriod - 1) return null;
    const hh = Math.max(...high.slice(i - kPeriod + 1, i + 1));
    const ll = Math.min(...low.slice(i - kPeriod + 1, i + 1));
    return hh === ll ? 50 : ((c - ll) / (hh - ll)) * 100;
  });
  const filled = rawK.map((v) => (v == null ? 50 : v));
  const k = sma(filled, dPeriod).map((v, i) => (rawK[i] == null ? null : v));
  const kFilled = k.map((v) => (v == null ? 50 : v));
  const d = sma(kFilled, dPeriod).map((v, i) => (k[i] == null ? null : v));
  return { k, d };
}

// VWAP harian sederhana (reset tiap hari)
export function vwap(timestamps, high, low, close, volume) {
  let day = null, pv = 0, vv = 0;
  return close.map((c, i) => {
    const d = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
    if (d !== day) { day = d; pv = 0; vv = 0; }
    const tp = (high[i] + low[i] + c) / 3;
    pv += tp * volume[i];
    vv += volume[i];
    return vv ? pv / vv : c;
  });
}

// ---- indikator tambahan untuk chart ----
export function rsi(close, period = 14) {
  const out = close.map(() => null);
  if (close.length <= period) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = close[i] - close[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  gain /= period; loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = period + 1; i < close.length; i++) {
    const d = close[i] - close[i - 1];
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

export function macd(close, fast = 12, slow = 26, sig = 9) {
  const ef = ema(close, fast), es = ema(close, slow);
  const line = close.map((_, i) => ef[i] - es[i]);
  const signal = ema(line, sig);
  const hist = line.map((v, i) => v - signal[i]);
  return { line, signal, hist };
}

export function bollinger(close, period = 20, mult = 2) {
  const mid = sma(close, period);
  const upper = [], lower = [];
  close.forEach((_, i) => {
    if (mid[i] == null) { upper.push(null); lower.push(null); return; }
    let s = 0;
    for (let j = i - period + 1; j <= i; j++) s += (close[j] - mid[i]) ** 2;
    const sd = Math.sqrt(s / period);
    upper.push(mid[i] + mult * sd);
    lower.push(mid[i] - mult * sd);
  });
  return { mid, upper, lower };
}
