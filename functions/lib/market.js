// Pasar: saham Indonesia (akhiran .JK, harga dalam rupiah) vs saham AS (dolar).
export const isIdx = (symbol) => /\.JK$/i.test(symbol || "");
export const curOf = (symbol) => (isIdx(symbol) ? "IDR" : "USD");
// Pengaturan fee per pasar. IDX: hanya persentase, tanpa minimum/biaya tetap dolar.
export const feeSettings = (symbol, s) =>
  isIdx(symbol) ? { ...s, feePctPerSide: s.feePctIdx ?? 0.2, minFeeUsd: 0, fixedFeeUsd: 0 } : s;
