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
