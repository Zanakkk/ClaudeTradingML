import { ema, atr, stochastic } from "./indicators.js";

const last = (a) => a[a.length - 1];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const feeSide = (usd, s) => Math.max(s.minFeeUsd, (usd * s.feePctPerSide) / 100) + s.fixedFeeUsd;

// Sinyal masuk (aturan yang sama dengan halaman Sinyal, di timeframe 1 jam):
// tren naik + stochastic K menyilang naik di atas D dari zona bawah.
function entrySignals(h) {
  const e50 = ema(h.close, 50);
  const a = atr(h.high, h.low, h.close, 14);
  const { k, d } = stochastic(h.high, h.low, h.close);
  const sig = new Array(h.close.length).fill(false);
  for (let i = 55; i < h.close.length; i++) {
    const up = h.close[i] > e50[i] && e50[i] > e50[i - 3];
    const cross = k[i] != null && d[i] != null && k[i - 1] != null && d[i - 1] != null &&
      k[i - 1] <= d[i - 1] && k[i] > d[i] && Math.min(k[i - 1], d[i - 1]) < 35;
    sig[i] = up && cross && a[i] > 0;
  }
  return { sig, a, e50, k };
}

function backtest(h, ind, s, rtFeePct) {
  const trades = [];
  const n = h.close.length;
  for (let i = 55; i < n - 1; i++) {
    if (!ind.sig[i]) continue;
    const entry = h.close[i];
    const A = ind.a[i];
    const sl = entry - s.slAtr * A;
    const tp = entry + s.tpAtr * A;
    let exit = null, j = i + 1;
    for (; j <= Math.min(i + 12, n - 1); j++) {
      if (h.low[j] <= sl) { exit = sl; break; }        // pesimis: SL dicek lebih dulu
      if (h.high[j] >= tp) { exit = tp; break; }
    }
    if (exit == null) { j = Math.min(i + 12, n - 1); exit = h.close[j]; }
    trades.push(((exit - entry) / entry) * 100 - rtFeePct);
    i = j; // tidak boleh tumpang tindih
  }
  return trades;
}

export function analyze(symbol, h1, d1, s) {
  if (h1.close.length < 150 || d1.close.length < 30) return { symbol, status: "no_data" };

  const n = h1.close.length;
  const price = last(h1.close);
  const ind = entrySignals(h1);
  const atrPct = (last(ind.a) / price) * 100;

  // likuiditas & risiko gap dari data harian
  const dn = d1.close.length;
  const w = Math.min(20, dn);
  let dv = 0, rng = 0;
  for (let i = dn - w; i < dn; i++) {
    dv += d1.close[i] * d1.volume[i];
    rng += ((d1.high[i] - d1.low[i]) / d1.close[i]) * 100;
  }
  const dollarVol = dv / w;
  const dailyRangePct = rng / w;
  let worstDay = 0;
  for (let i = Math.max(1, dn - 60); i < dn; i++) worstDay = Math.min(worstDay, ((d1.close[i] - d1.close[i - 1]) / d1.close[i - 1]) * 100);
  const d20 = ema(d1.close, 20);
  const dailyUp = last(d1.close) > last(d20);
  const hourlyUp = last(h1.close) > last(ind.e50) && last(ind.e50) > ind.e50[n - 4];
  const chg5d = dn > 5 ? ((d1.close[dn - 1] - d1.close[dn - 6]) / d1.close[dn - 6]) * 100 : null;

  // fee bolak-balik sebagai % dari nilai posisi (modal penuh)
  const pos = s.capitalUsd;
  const rtFeePct = ((feeSide(pos, s) * 2) / pos) * 100;
  const tpPct = s.tpAtr * atrPct;
  const slPct = s.slAtr * atrPct;

  // backtest aturan yang sama pada riwayat saham ini
  const tr = backtest(h1, ind, s, rtFeePct);
  const nT = tr.length;
  const wins = tr.filter((x) => x > 0).length;
  const winRate = nT ? wins / nT : null;
  const winShr = (wins + 4 * 0.4) / (nT + 4); // dikecilkan ke 40% bila sampel sedikit
  const avgNet = nT ? tr.reduce((a, b) => a + b, 0) / nT : 0;
  const gp = tr.filter((x) => x > 0).reduce((a, b) => a + b, 0);
  const gl = -tr.filter((x) => x < 0).reduce((a, b) => a + b, 0);
  const profitFactor = gl > 0 ? gp / gl : nT ? 99 : null;

  // setup aktif sekarang (3 candle terakhir)
  const setupNow = ind.sig[n - 1] || ind.sig[n - 2] || ind.sig[n - 3];
  const A = last(ind.a);

  const liquid = dollarVol >= s.minDollarVol;
  const feeOk = tpPct >= rtFeePct * 1.5;

  let score =
    100 *
    (0.4 * winShr +
      0.3 * clamp((avgNet + 1) / 3, 0, 1) +
      0.15 * ((hourlyUp ? 0.6 : 0) + (dailyUp ? 0.4 : 0)) +
      0.15 * clamp(Math.log10(Math.max(dollarVol, 1) / s.minDollarVol) / 1.5, 0, 1));
  if (setupNow && hourlyUp) score += 8;
  if (worstDay < -20) score -= 10;
  if (!feeOk) score -= 12;
  if (!liquid) score -= 25;
  if (nT < 6) score = Math.min(score, 55);
  score = clamp(score, 0, 100);

  let verdict = "HINDARI";
  if (liquid && feeOk && nT >= 8 && avgNet > 0 && score >= 62) verdict = "KANDIDAT";
  else if (liquid && avgNet > 0 && score >= 48) verdict = "PANTAU";

  const reasons = [];
  if (hourlyUp) reasons.push("tren 1 jam naik"); else reasons.push("tren 1 jam belum naik");
  if (setupNow) reasons.push("sinyal masuk baru muncul");
  if (!feeOk) reasons.push("target profit tipis dibanding fee");
  if (!liquid) reasons.push("volume transaksi kecil");
  if (nT < 8) reasons.push(`sampel backtest hanya ${nT} trade`);
  if (worstDay < -20) reasons.push(`pernah anjlok ${worstDay.toFixed(0)}% dalam sehari`);
  if (avgNet <= 0 && nT >= 8) reasons.push("rata-rata hasil bersih negatif");

  return {
    symbol, status: "ok", price, chg5d, atrPct, dailyRangePct, dollarVol, worstDay,
    hourlyUp, dailyUp, setupNow,
    rtFeePct, tpPct, slPct,
    bt: { trades: nT, winRate, winShr, avgNet, profitFactor },
    entry: setupNow ? { price, sl: price - s.slAtr * A, tp: price + s.tpAtr * A } : null,
    score: Math.round(score), verdict, reasons,
  };
}
