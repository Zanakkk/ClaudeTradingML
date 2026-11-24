export class ApiError extends Error {
  constructor(kind) { super(kind); this.kind = kind; }
}

// Tidak pernah memunculkan kode HTTP ke pengguna: hanya jenis masalahnya.
export async function getJSON(url) {
  let r;
  try { r = await fetch(url); } catch { throw new ApiError("offline"); }
  if (r.status === 404) throw new ApiError("notfound");
  if (!r.ok) throw new ApiError("unavailable");
  return r.json();
}

// Panggilan yang butuh akun: mengirim ID token Firebase.
export async function authed(path, body) {
  const { getToken } = await import("./firebase.js");
  let token;
  try { token = await getToken(); } catch { throw new ApiError("unavailable"); }
  if (!token) throw new ApiError("auth");
  let r;
  try { r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) }); }
  catch { throw new ApiError("offline"); }
  if (r.status === 401) throw new ApiError("auth");
  if (r.status === 400) throw new ApiError("bad");
  if (!r.ok) throw new ApiError("unavailable");
  return r.json();
}

export const errText = (e, what = "ticker ini") =>
  e?.kind === "notfound" ? `Tidak ada data untuk ${what}.`
  : e?.kind === "offline" ? "Tidak ada koneksi internet."
  : e?.kind === "auth" ? "Sesi habis. Masuk lagi untuk melanjutkan."
  : e?.kind === "bad" ? "Data yang dikirim belum valid. Periksa isiannya."
  : "Data belum bisa dimuat. Coba lagi sebentar lagi.";

export const fmt = (n, d = 2) => (n == null || !isFinite(n) ? "–" : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }));
export const pct = (n, d = 2) => (n == null || !isFinite(n) ? "–" : `${n >= 0 ? "+" : ""}${n.toFixed(d)}%`);
export const usd = (n) => (n == null ? "–" : `${n < 0 ? "−" : ""}$${Math.abs(n).toFixed(2)}`);

export const GROUPS = {
  "Indeks & ETF": ["SPY", "QQQ", "DIA", "IWM", "VTI", "XLK", "XLF", "XLE"],
  "Big Tech": ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA", "NFLX"],
  "Semikonduktor": ["AMD", "AVGO", "TSM", "INTC", "MU", "QCOM"],
  "Keuangan": ["JPM", "BAC", "V", "MA", "GS"],
  "Konsumen & Industri": ["XOM", "CVX", "KO", "DIS", "WMT", "BA"],
  "Crypto & Komoditas": ["BTC-USD", "ETH-USD", "GC=F", "CL=F"],
};
