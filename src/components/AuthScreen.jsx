import { useState } from "react";
import { register, login, loginGoogle, resetPassword, authErr } from "../lib/firebase.js";

export default function AuthScreen({ initial = "signup", reason, onClose, onGuest }) {
  const [mode, setMode] = useState(initial); // signup | login | reset
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  async function run(fn) {
    setBusy(true); setErr(""); setInfo("");
    try { await fn(); } catch (e) { setErr(authErr(e)); }
    setBusy(false);
  }
  const submit = (e) => {
    e.preventDefault();
    if (!email.trim()) return setErr("Isi email dulu.");
    if (mode === "reset") return run(async () => { await resetPassword(email.trim()); setInfo("Tautan atur ulang sudah dikirim. Cek kotak masuk (dan folder spam)."); });
    if (pw.length < 6) return setErr("Kata sandi minimal 6 karakter.");
    run(async () => { if (mode === "signup") await register(email.trim(), pw, name.trim()); else await login(email.trim(), pw); onClose(true); });
  };
  const google = () => run(async () => { await loginGoogle(); onClose(true); });

  const title = mode === "signup" ? "Buat akun" : mode === "login" ? "Masuk" : "Atur ulang kata sandi";
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="auth">
        <button className="x" onClick={() => onClose(false)} aria-label="Tutup">×</button>
        <div className="brand lg">Trading<span>ML</span></div>
        <h1>{title}</h1>
        <p className="muted">{reason || (mode === "signup" ? "Simpan jurnal trade, pengaturan fee, dan track record-mu di satu tempat. Bisa dibuka dari HP mana pun." : mode === "login" ? "Selamat datang kembali." : "Masukkan email akunmu, kami kirim tautan untuk membuat kata sandi baru.")}</p>

        <form onSubmit={submit} className="aform">
          {mode === "signup" && (
            <label>Nama panggilan<input autoComplete="nickname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Daffa" maxLength={40} /></label>
          )}
          <label>Email<input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" /></label>
          {mode !== "reset" && (
            <label>Kata sandi
              <span className="pw">
                <input type={show ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Minimal 6 karakter" />
                <button type="button" onClick={() => setShow(!show)}>{show ? "Sembunyikan" : "Lihat"}</button>
              </span>
            </label>
          )}
          {err && <p className="aerr" role="alert">{err}</p>}
          {info && <p className="ainfo" role="status">{info}</p>}
          <button className="btn wide" disabled={busy}>{busy ? "Memproses…" : mode === "signup" ? "Buat akun" : mode === "login" ? "Masuk" : "Kirim tautan"}</button>
        </form>

        {mode !== "reset" && (
          <>
            <div className="or"><span>atau</span></div>
            <button className="btn ghost wide" onClick={google} disabled={busy}>Lanjut dengan Google</button>
          </>
        )}

        <div className="alinks">
          {mode === "signup" && <button onClick={() => { setMode("login"); setErr(""); }}>Sudah punya akun? Masuk</button>}
          {mode === "login" && (<><button onClick={() => { setMode("signup"); setErr(""); }}>Belum punya akun? Daftar</button><button onClick={() => { setMode("reset"); setErr(""); }}>Lupa kata sandi?</button></>)}
          {mode === "reset" && <button onClick={() => { setMode("login"); setErr(""); setInfo(""); }}>Kembali ke masuk</button>}
          {onGuest && <button onClick={onGuest}>Lanjut sebagai tamu</button>}
        </div>
      </div>
    </div>
  );
}
