import { useState } from "react";
import { toDisp, fromDisp, sym, setMoney, rate, money } from "../lib/money.js";

const SLIDES = [
  { k: "a", title: "Cari peluang, bukan menebak", body: "TradingML memindai puluhan saham Gotrade, mengujinya pada riwayat 2 tahun, lalu menghitung peluang untung dan rugi dengan simulasi Monte Carlo 1.000 jalur.", art: "◎" },
  { k: "b", title: "Fee adalah lawan utamamu", body: "Di modal $100 (≈ Rp 1,6 juta), sekali beli lalu jual memakan sekitar $0,64 (≈ Rp 10 ribu). Trade 15 menit yang untungnya $1–2 habis dimakan fee. Karena itu aplikasi ini mengutamakan target yang jauh lebih besar dari fee, bukan trade sebanyak-banyaknya.", art: "$" },
  { k: "c", title: "Kamu yang memegang kendali", body: "Tidak ada jaminan untung. Selalu pakai batas rugi, jangan taruh seluruh modal di satu saham, dan berhenti kalau rugi mingguan sudah sampai batasmu. Aplikasi ini alat bantu analisa, bukan saran investasi.", art: "◆" },
];

export default function Onboarding({ profile, onSave, onFinish }) {
  const [i, setI] = useState(0);
  const [p, setP] = useState({ capital: profile.capital, feeTier: profile.feeTier, risk: profile.risk, name: profile.name || "", currency: profile.currency || "USD" });
  const last = i === SLIDES.length;
  const s = SLIDES[i];
  const finish = async (wantAccount) => { await onSave({ ...profile, ...p, onboarded: true }); onFinish(wantAccount); };

  return (
    <div className="overlay onb" role="dialog" aria-modal="true" aria-label="Pengenalan">
      <div className="onb-in">
        <div className="dots" aria-hidden="true">{[...SLIDES, 0].map((_, k) => <i key={k} className={k === i ? "on" : k < i ? "done" : ""} />)}</div>
        {!last ? (
          <div className="slide" key={s.k}>
            <div className="art" aria-hidden="true">{s.art}</div>
            <h1>{s.title}</h1>
            <p>{s.body}</p>
          </div>
        ) : (
          <div className="slide" key="set">
            <h1>Atur dasarmu</h1>
            <p>Dipakai untuk menghitung ukuran posisi dan fee. Bisa diubah kapan saja di Akun.</p>
            <div className="aform">
              <div className="fieldset">
                <span>Mata uang</span>
                <div className="seg">
                  <button type="button" className={p.currency === "IDR" ? "active" : ""} onClick={() => { setMoney("IDR", rate()); setP({ ...p, currency: "IDR" }); }}>Rupiah (Rp)</button>
                  <button type="button" className={p.currency !== "IDR" ? "active" : ""} onClick={() => { setMoney("USD", rate()); setP({ ...p, currency: "USD" }); }}>Dollar ($)</button>
                </div>
              </div>
              <label>Modal ({sym()})<input type="number" inputMode="decimal" min="1" value={p.capital ? toDisp(p.capital) : ""} onChange={(e) => setP({ ...p, capital: fromDisp(+e.target.value) })} /></label>
              <div className="fieldset">
                <span>Tarif Gotrade-mu</span>
                <div className="seg">
                  <button type="button" className={p.feeTier === "regular" ? "active" : ""} onClick={() => setP({ ...p, feeTier: "regular" })}>Reguler 0,3%</button>
                  <button type="button" className={p.feeTier === "prestige" ? "active" : ""} onClick={() => setP({ ...p, feeTier: "prestige" })}>Prestige 0,2%</button>
                </div>
              </div>
              <label>Batas rugi yang kamu terima per trade ({sym()})<input type="number" inputMode="decimal" min="0" value={p.risk ? toDisp(p.risk) : ""} onChange={(e) => setP({ ...p, risk: fromDisp(+e.target.value) })} /></label>
            </div>
          </div>
        )}
        <div className="onb-act">
          {!last ? (
            <>
              <button className="btn wide" onClick={() => setI(i + 1)}>Lanjut</button>
              <button className="link" onClick={() => setI(SLIDES.length)}>Lewati pengenalan</button>
            </>
          ) : (
            <>
              <button className="btn wide" onClick={() => finish(true)} disabled={!(p.capital >= 10) || !(p.risk > 0)}>Simpan &amp; buat akun</button>
              <button className="link" onClick={() => finish(false)} disabled={!(p.capital >= 10) || !(p.risk > 0)}>Simpan, lanjut sebagai tamu</button>
            </>
          )}
          {i > 0 && <button className="link" onClick={() => setI(i - 1)}>Kembali</button>}
        </div>
      </div>
    </div>
  );
}
