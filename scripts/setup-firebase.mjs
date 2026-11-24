// Dijalankan di CI sebelum build: menyalakan Firebase Auth (email+sandi) dan menulis public/fb.json
// (konfigurasi web app, kunci API Firebase memang publik). Tidak pernah menggagalkan deploy.
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const P = "claudetradingml";
const note = (t, m) => console.log(`::notice title=${t}::${String(m).replace(/\n/g, " ").slice(0, 400)}`);
let H;
try {
  const tok = execSync("gcloud auth print-access-token", { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
  H = { Authorization: `Bearer ${tok}`, "Content-Type": "application/json", "x-goog-user-project": P };
} catch (e) { note("Auth setup dilewati", "gcloud token gagal: " + e.message); process.exit(0); }

async function call(method, url, body) {
  try {
    const r = await fetch(url, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = { raw: t }; }
    return { ok: r.ok, status: r.status, j };
  } catch (e) { return { ok: false, status: 0, j: { error: e.message } }; }
}
const err = (r) => `${r.status} ${JSON.stringify(r.j?.error?.message || r.j?.raw || r.j).slice(0, 200)}`;

// 1) API yang dibutuhkan
let r = await call("POST", `https://serviceusage.googleapis.com/v1/projects/${P}/services:batchEnable`, {
  serviceIds: ["identitytoolkit.googleapis.com", "firebase.googleapis.com", "securetoken.googleapis.com"],
});
note("API", r.ok ? "diaktifkan/sudah aktif" : err(r));

// 2) Inisialisasi Auth + nyalakan email/sandi
r = await call("POST", `https://identitytoolkit.googleapis.com/v2/projects/${P}/identityPlatform:initializeAuth`, {});
note("initializeAuth", r.ok ? "ok" : err(r));
r = await call("PATCH", `https://identitytoolkit.googleapis.com/v2/projects/${P}/config?updateMask=signIn.email`, {
  signIn: { email: { enabled: true, passwordRequired: true } },
});
note("Email/sandi", r.ok ? "aktif" : err(r));
const cfg = await call("GET", `https://identitytoolkit.googleapis.com/v2/projects/${P}/config`);
note("Provider", cfg.ok ? `email=${cfg.j?.signIn?.email?.enabled} domains=${(cfg.j?.authorizedDomains || []).join(",")}` : err(cfg));

// 3) Web app + konfigurasi
let apps = await call("GET", `https://firebase.googleapis.com/v1beta1/projects/${P}/webApps`);
if (apps.ok && !(apps.j.apps || []).length) {
  const c = await call("POST", `https://firebase.googleapis.com/v1beta1/projects/${P}/webApps`, { displayName: "TradingML Web" });
  note("Buat web app", c.ok ? "dibuat" : err(c));
  for (let i = 0; i < 15 && c.ok && !c.j.done; i++) {
    await new Promise((ok) => setTimeout(ok, 2000));
    const o = await call("GET", `https://firebase.googleapis.com/v1/${c.j.name}`);
    if (o.ok && o.j.done) break;
  }
  apps = await call("GET", `https://firebase.googleapis.com/v1beta1/projects/${P}/webApps`);
}
const app = apps.ok ? (apps.j.apps || [])[0] : null;
if (!app) { note("Web app", "tidak ada: " + (apps.ok ? "kosong" : err(apps))); process.exit(0); }
const conf = await call("GET", `https://firebase.googleapis.com/v1beta1/${app.name}/config`);
if (conf.ok && conf.j.apiKey) {
  writeFileSync("public/fb.json", JSON.stringify(conf.j));
  note("fb.json", "ditulis untuk app " + app.appId);
} else note("Config web app", err(conf));
