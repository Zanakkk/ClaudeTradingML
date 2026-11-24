import { ema, atr, rsi, macd, stochastic } from "./indicators.js";

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const std = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
const quant = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function crossUpAt(st, i) {
  for (let q = i; q > i - 3; q--) {
    const k = st.k[q], d = st.d[q], k0 = st.k[q - 1], d0 = st.d[q - 1];
    if (k != null && d != null && k0 != null && d0 != null && k0 <= d0 && k > d && Math.min(k0, d0) < 30) return true;
  }
  return false;
}

/**
 * Bukan ramalan harga. Tiga hal yang dihitung dari riwayat harga simbol itu sendiri:
 *  1) skor kondisi saat ini (tren, momentum, dll)
 *  2) analog historis: dulu, saat kondisinya mirip, harga bergerak apa setelah `horizon` candle
 *  3) uji mundur aturan sinyal pada simbol ini, sudah dikurangi fee
 */
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Monte Carlo 1.000 jalur harga: tiap candle simulasi = candle riwayat yang diambil acak (bentuk high/low/close
// terhadap penutupan sebelumnya), tren masa lalu dibuang supaya tidak menebak arah. Berjalan di request yang sama,
// jadi tidak menambah query ke Yahoo.
function simulate(c, s, horizon, atrNow, price, iters = 1000) {
  const n = c.close.length, start = Math.max(1, n - 750);
  let ml = 0;
  for (let i = start; i < n; i++) ml += Math.log(c.close[i] / c.close[i - 1]);
  const adj = Math.exp(-ml / (n - start));
  const shapes = [];
  for (let i = start; i < n; i++) {
    const b = c.close[i - 1];
    shapes.push([(c.high[i] / b) * adj, (c.low[i] / b) * adj, (c.close[i] / b) * adj]);
  }
  const rnd = mulberry32(n * 131 + Math.round(price * 1000));
  const slF = (s.slAtr * atrNow) / price, tpF = (s.tpAtr * atrNow) / price;
  const ends = [], steps = Array.from({ length: horizon }, () => []);
  let tp = 0, sl = 0;
  for (let it = 0; it < iters; it++) {
    let p = 1, done = false;
    for (let k = 0; k < horizon; k++) {
      const sh = shapes[Math.floor(rnd() * shapes.length)];
      if (!done) {
        if (p * sh[1] <= 1 - slF) { done = true; sl++; }       // pesimis: SL dicek lebih dulu
        else if (p * sh[0] >= 1 + tpF) { done = true; tp++; }
      }
      p *= sh[2];
      steps[k].push((p - 1) * 100);
    }
    ends.push((p - 1) * 100);
  }
  const num = (a, b) => a - b;
  ends.sort(num);
  const q = (arr, pr) => arr[Math.min(arr.length - 1, Math.floor(pr * arr.length))];
  return {
    iters, tpPct: tpF * 100, slPct: slF * 100,
    pTP: (tp / iters) * 100, pSL: (sl / iters) * 100, pNone: ((iters - tp - sl) / iters) * 100,
    pUp: (ends.filter((x) => x > 0).length / iters) * 100,
    q: Array.from({ length: 21 }, (_, i) => ends[Math.min(iters - 1, Math.round((i / 20) * (iters - 1)))]),
    bands: steps.map((v) => { v.sort(num); return { p5: q(v, 0.05), p25: q(v, 0.25), p50: q(v, 0.5), p75: q(v, 0.75), p95: q(v, 0.95) }; }),
  };
}

export function predict(c, s, horizon) {
  const n = c.close.length;
  if (n < 150) return { error: "not_enough_data" };
  const { close, high, low } = c;
  const e20 = ema(close, 20), e50 = ema(close, 50);
  const r = rsi(close, 14), m = macd(close), a = atr(high, low, close, 14), st = stochastic(high, low, close);
  const warm = 60;

  const trendAt = (i) => (close[i] > e50[i] && e50[i] > e50[i - 3] ? 1 : close[i] < e50[i] && e50[i] < e50[i - 3] ? -1 : 0);
  const rb = (v) => (v < 35 ? 0 : v < 50 ? 1 : v < 65 ? 2 : 3);
  const keyAt = (i) => `${trendAt(i)}|${rb(r[i])}|${m.hist[i] > 0 ? 1 : 0}`;

  // --- analog historis ---
  const fwd = [];
  for (let i = warm; i < n - horizon; i++) {
    fwd.push({ key: keyAt(i), trend: trendAt(i), ret: ((close[i + horizon] - close[i]) / close[i]) * 100 });
  }
  const now = n - 1;
  const kNow = keyAt(now), tNow = trendAt(now);
  let sample = fwd.filter((x) => x.key === kNow), level = "exact";
  if (sample.length < 25) { sample = fwd.filter((x) => x.trend === tNow); level = "trend"; }
  if (sample.length < 25) { sample = fwd; level = "all"; }
  const rets = sample.map((x) => x.ret).sort((x, y) => x - y);
  const basePUp = (fwd.filter((x) => x.ret > 0).length / fwd.length) * 100;
  const analog = {
    n: rets.length, level,
    pUp: (rets.filter((x) => x > 0).length / rets.length) * 100,
    avg: mean(rets), median: quant(rets, 0.5), p10: quant(rets, 0.1), p90: quant(rets, 0.9),
  };

  // --- skor kondisi ---
  const factors = [];
  const add = (label, text, pts) => factors.push({ label, text, pts: Math.round(pts) });
  add("Tren (EMA 50)", tNow === 1 ? "Naik" : tNow === -1 ? "Turun" : "Datar", tNow * 30);
  const rv = r[now];
  add("RSI 14", rv.toFixed(0) + (rv > 70 ? " · jenuh beli" : rv < 30 ? " · jenuh jual" : ""), rv > 75 ? 5 : rv < 25 ? -5 : clamp((rv - 50) * 0.6, -15, 15));
  const hNow = m.hist[now], hPrev = m.hist[now - 1];
  add("MACD", hNow > 0 ? (hNow > hPrev ? "Positif, menguat" : "Positif, melemah") : hNow > hPrev ? "Negatif, membaik" : "Negatif, memburuk",
    hNow > 0 ? (hNow > hPrev ? 15 : 5) : hNow > hPrev ? -5 : -15);
  const kv = st.k[now] ?? 50;
  add("Stochastic", kv.toFixed(0) + (kv < 20 ? " · zona bawah" : kv > 80 ? " · zona atas" : ""), kv < 20 ? 8 : kv > 80 ? -8 : 0);
  add("Harga vs EMA 20", close[now] > e20[now] ? "Di atas" : "Di bawah", close[now] > e20[now] ? 10 : -10);
  add("Analog historis", `${analog.pUp.toFixed(0)}% naik vs ${basePUp.toFixed(0)}% biasa`, clamp(analog.pUp - basePUp, -20, 20));
  const score = clamp(Math.round(factors.reduce((t, f) => t + f.pts, 0)), -100, 100);
  const outlook = score >= 40 ? "Bullish" : score >= 15 ? "Condong naik" : score > -15 ? "Netral" : score > -40 ? "Condong turun" : "Bearish";
  const confidence = level === "exact" && analog.n >= 60 ? "Sedang" : analog.n >= 25 ? "Rendah" : "Sangat rendah";

  // --- rentang kemungkinan (bukan arah) ---
  const price = close[now];
  const lr = [];
  for (let i = Math.max(1, n - 120); i < n; i++) lr.push((close[i] - close[i - 1]) / close[i - 1]);
  const sigma = std(lr);
  const cone = Array.from({ length: horizon }, (_, k) => {
    const sd = price * sigma * Math.sqrt(k + 1);
    return { k: k + 1, s1: sd, s2: sd * 2 };
  });

  // --- uji mundur aturan sinyal di simbol ini ---
  const feeSide = (usd) => Math.max(s.minFeeUsd, (usd * s.feePctPerSide) / 100) + s.fixedFeeUsd;
  const rtFeePct = ((2 * feeSide(s.capitalUsd)) / s.capitalUsd) * 100;
  const trades = [];
  for (let i = warm + 5; i < n - 1; ) {
    if (trendAt(i) === 1 && a[i] > 0 && crossUpAt(st, i) && Math.abs(close[i] - e20[i]) <= a[i]) {
      const entry = close[i], sl = entry - s.slAtr * a[i], tp = entry + s.tpAtr * a[i];
      const end = Math.min(n - 1, i + horizon * 2);
      let exit = null, j = i + 1;
      for (; j <= end; j++) {
        if (low[j] <= sl) { exit = sl; break; }
        if (high[j] >= tp) { exit = tp; break; }
      }
      if (exit == null) { exit = close[end]; j = end; }
      const gross = ((exit - entry) / entry) * 100;
      trades.push({ gross, net: gross - rtFeePct });
      i = j + 1;
    } else i++;
  }
  const wins = trades.filter((t) => t.net > 0);
  const lossSum = Math.abs(trades.filter((t) => t.net <= 0).reduce((t, x) => t + x.net, 0));
  const backtest = {
    trades: trades.length,
    winRate: trades.length ? (wins.length / trades.length) * 100 : null,
    avgGross: trades.length ? mean(trades.map((t) => t.gross)) : null,
    avgNet: trades.length ? mean(trades.map((t) => t.net)) : null,
    totalNet: trades.reduce((t, x) => t + x.net, 0),
    profitFactor: lossSum ? wins.reduce((t, x) => t + x.net, 0) / lossSum : null,
    rtFeePct,
    tpPct: ((a[now] * s.tpAtr) / price) * 100,
  };

  const mc = simulate(c, s, horizon, a[now], price);

  return { price, atrPct: (a[now] / price) * 100, horizon, score, outlook, confidence, factors, analog, basePUp, cone, backtest, mc };
}
