// Mata uang tampilan. Semua hitungan internal memakai USD; angka diubah hanya saat ditampilkan / diketik.
let S = { cur: "USD", rate: 16000 };
export const setMoney = (cur, rate) => { S = { cur: cur === "IDR" ? "IDR" : "USD", rate: rate > 1000 && rate < 100000 ? rate : 16000 }; };
export const cur = () => S.cur;
export const rate = () => S.rate;
export const sym = () => (S.cur === "IDR" ? "Rp" : "$");
const idn = (n) => Math.round(n).toLocaleString("id-ID");

// jumlah (dalam USD) → teks di mata uang tampilan, tanpa tanda
export const money = (usd, dUsd = 2) => (S.cur === "IDR" ? `Rp ${idn(Math.abs(usd) * S.rate)}` : `$${Math.abs(usd).toFixed(dUsd)}`);
export const moneyS = (usd) => `${usd < 0 ? "−" : "+"}${money(usd)}`;
// nilai USD ⇄ angka di kolom input
export const toDisp = (usd) => (S.cur === "IDR" ? Math.round(usd * S.rate) : usd);
export const fromDisp = (v) => (S.cur === "IDR" ? v / S.rate : v);
// harga satu lembar dalam mata uang aslinya (saham .JK = rupiah)
export const px = (c, p) => (p == null || !isFinite(p) ? "–" : c === "IDR" ? `Rp ${p >= 1000 ? idn(p) : p.toLocaleString("id-ID", { maximumFractionDigits: 2 })}` : `$${Number(p).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
export const pxSym = (c) => (c === "IDR" ? "Rp" : "$");
// jumlah dalam mata uang suatu trade ⇄ USD
export const natToUsd = (amt, c) => (c === "IDR" ? amt / S.rate : amt);
export const usdToNat = (usd, c) => (c === "IDR" ? usd * S.rate : usd);
export const isIdx = (s) => /\.JK$/i.test(s || "");
// pilihan nominal cepat (dalam USD) mengikuti mata uang tampilan
export const chipsEnter = () => (S.cur === "IDR" ? [100e3, 250e3, 500e3, 1e6, 2e6].map((d) => ({ usd: d / S.rate, label: d >= 1e6 ? `${d / 1e6}jt` : `${d / 1e3}rb` })) : [10, 25, 50, 100, 200].map((u) => ({ usd: u, label: `$${u}` })));
export const chipsProfit = () => (S.cur === "IDR" ? [[0, "Semua"], [10e3 / S.rate, "≥ Rp 10rb"], [25e3 / S.rate, "≥ Rp 25rb"], [50e3 / S.rate, "≥ Rp 50rb"], [100e3 / S.rate, "≥ Rp 100rb"]] : [[0, "Semua"], [1, "≥ $1"], [2, "≥ $2"], [3, "≥ $3"], [5, "≥ $5"]]);
export const sameAmt = (a, b) => Math.round(toDisp(a) * 100) === Math.round(toDisp(b) * 100);
