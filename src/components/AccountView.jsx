import { useState } from "react";
import { authed, errText } from "../lib/api.js";
import { logout } from "../lib/firebase.js";

export default function AccountView({ user, profile, saveProfile, onLogin, onReplayIntro }) {
  const [p, setP] = useState({ name: profile.name || user?.name || "", capital: profile.capital, feeTier: profile.feeTier, risk: profile.risk });
  const [msg, setMsg] = useState("");
  const [zoom, setZoom] = useState(() => localStorage.getItem("zoom") || "1");
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(false);
  const [word, setWord] = useState("");
  const dirty = p.name !== (profile.name || user?.name || "") || p.capital !== profile.capital || p.feeTier !== profile.feeTier || p.risk !== profile.risk;
  const valid = p.capital >= 10 && p.risk > 0;

  async function save() {
    setBusy(true); setMsg("");
    try { await saveProfile({ ...profile, ...p }); setMsg("Tersimpan."); }
    catch (e) { setMsg(errText(e)); }
    setBusy(false);
  }
  async function exportData() {
    setBusy(true); setMsg("");
    try {
      const d = await authed("/api/journal", { op: "list" });
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), profile, trades: d.trades }, null, 2)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "tradingml-jurnal.json"; a.click();
      setMsg("Jurnal diunduh.");
    } catch (e) { setMsg(errText(e)); }
    setBusy(false);
  }
  async function deleteAccount() {
    setBusy(true); setMsg("");
    try { await authed("/api/account", { op: "delete" }); try { await logout(); } catch { /* akun sudah terhapus */ } localStorage.removeItem("profile"); }
    catch (e) { setMsg(errText(e)); setBusy(false); }
  }

  const initials = (p.name || user?.email || "?").trim().slice(0, 1).toUpperCase();

  return (
    <div className="stack">
      <section className="card prof">
        <div className="avatar lg">{user ? initials : "?"}</div>
        <div>
          <b>{user ? p.name || "Akunmu" : "Tamu"}</b>
          <small>{user ? user.email : "Belum masuk. Pengaturan hanya tersimpan di HP ini."}</small>
        </div>
      </section>

      {!user && (
        <section className="card">
          <h3>Kenapa perlu akun?</h3>
          <ul className="std">
            <li>Jurnal trade tersimpan aman dan bisa dibuka dari HP mana pun</li>
            <li>Track record: untung/rugi nyata, win rate, dan perbandingan dengan prediksi</li>
            <li>Pengaturan modal dan tarif fee ikut ke mana-mana</li>
          </ul>
          <div className="row-btn" style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => onLogin("signup")}>Buat akun</button>
            <button className="btn ghost" onClick={() => onLogin("login")}>Masuk</button>
          </div>
        </section>
      )}

      <section className="card">
        <h3>Pengaturan trading</h3>
        <div className="aform">
          {user && <label>Nama panggilan<input value={p.name} maxLength={40} onChange={(e) => setP({ ...p, name: e.target.value })} /></label>}
          <label>Modal ($)<input type="number" inputMode="decimal" min="10" value={p.capital || ""} onChange={(e) => setP({ ...p, capital: +e.target.value })} /></label>
          <div className="fieldset">
            <span>Tarif Gotrade</span>
            <div className="seg">
              <button type="button" className={p.feeTier === "regular" ? "active" : ""} onClick={() => setP({ ...p, feeTier: "regular" })}>Reguler 0,3%</button>
              <button type="button" className={p.feeTier === "prestige" ? "active" : ""} onClick={() => setP({ ...p, feeTier: "prestige" })}>Prestige 0,2%</button>
            </div>
          </div>
          <label>Batas rugi per trade ($)<input type="number" inputMode="decimal" min="0.5" step="0.5" value={p.risk || ""} onChange={(e) => setP({ ...p, risk: +e.target.value })} /></label>
        </div>
        <div className="row-btn" style={{ marginTop: 12 }}>
          <button className="btn" onClick={save} disabled={busy || !dirty || !valid}>Simpan</button>
          {msg && <span className="muted" role="status">{msg}</span>}
        </div>
      </section>

      <section className="card">
        <h3>Tampilan</h3>
        <div className="seg">
          {[["1", "Normal"], ["1.1", "Besar"], ["1.2", "Lebih besar"]].map(([z, l]) => (
            <button key={z} type="button" className={zoom === z ? "active" : ""} onClick={() => { setZoom(z); localStorage.setItem("zoom", z); document.documentElement.style.zoom = z; }}>{l}</button>
          ))}
        </div>
        <p className="muted" style={{ marginTop: 8 }}>Ukuran teks dan tampilan. Hanya tersimpan di HP ini.</p>
      </section>

      <section className="card">
        <h3>Lainnya</h3>
        <div className="stack" style={{ gap: 8 }}>
          <button className="btn ghost wide" onClick={onReplayIntro}>Lihat pengenalan lagi</button>
          {user && <button className="btn ghost wide" onClick={exportData} disabled={busy}>Unduh jurnal (JSON)</button>}
          {user && <button className="btn ghost wide" onClick={() => logout()}>Keluar</button>}
        </div>
      </section>

      {user && (
        <section className="card danger">
          <h3>Hapus akun</h3>
          {!del ? (
            <button className="btn ghost wide" onClick={() => setDel(true)}>Hapus akun &amp; semua jurnal</button>
          ) : (
            <>
              <p className="muted">Ini permanen: akun, pengaturan, dan seluruh jurnal trade dihapus dan tidak bisa dipulihkan. Ketik <b>HAPUS</b> untuk melanjutkan.</p>
              <input className="ta" value={word} onChange={(e) => setWord(e.target.value)} placeholder="HAPUS" />
              <div className="row-btn">
                <button className="btn dangerbtn" disabled={word !== "HAPUS" || busy} onClick={deleteAccount}>Hapus permanen</button>
                <button className="btn ghost" onClick={() => { setDel(false); setWord(""); }}>Batal</button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
