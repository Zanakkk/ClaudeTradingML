import { useEffect, useState, useCallback } from "react";
import { getJSON, fmt, usd, errText } from "../lib/api.js";
import { Icon, Notice } from "./ui.jsx";

function b64ToUint8(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
const LABEL = { BUY: "Beli", WAIT: "Tunggu", SKIP_FEE: "Terlalu mahal (fee)", NO_DATA: "Data kurang", ERROR: "Tidak ada data" };
const rank = { BUY: 0, SKIP_FEE: 1, WAIT: 2 };

export default function SignalsView({ onOpen }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState("");
  const [push, setPush] = useState(typeof Notification !== "undefined" && Notification.permission === "granted");

  const load = useCallback(async () => {
    try { setData(await getJSON("/api/signals")); setError(null); } catch (e) { setError(e); }
  }, []);
  useEffect(() => { load(); const id = setInterval(load, 60_000); return () => clearInterval(id); }, [load]);

  async function enablePush() {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("Browser ini belum mendukung notifikasi.");
      const reg = await navigator.serviceWorker.register("/sw.js");
      if ((await Notification.requestPermission()) !== "granted") throw new Error("Izin notifikasi ditolak. Aktifkan dari pengaturan browser.");
      const { publicKey } = await getJSON("/api/vapid");
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(publicKey) });
      const r = await fetch("/api/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub) });
      if (!r.ok) throw new Error("Notifikasi belum bisa diaktifkan. Coba lagi.");
      setPush(true); setMsg("Notifikasi aktif. Kamu akan dapat pesan saat ada sinyal beli baru.");
    } catch (e) { setMsg(e.message); }
  }

  if (error && !data) return <Notice title="Sinyal belum bisa dimuat" text={errText(error)} action="Coba lagi" onAction={load} />;
  if (!data) return <div className="skeleton tall" />;

  const rows = data.results.slice().sort((a, b) => (rank[a.action] ?? 9) - (rank[b.action] ?? 9));
  const s = data.settings;
  const buys = rows.filter((r) => r.action === "BUY").length;

  return (
    <div className="stack">
      <section className="hero">
        <div>
          <div className="eyebrow">Pemindai 15 menit</div>
          <h1>{buys ? `${buys} sinyal beli` : "Belum ada sinyal beli"}</h1>
          <p>{buys ? "Ketuk kartu untuk melihat chart dan rencana trade." : "Pemindai berjalan tiap 15 menit selama bursa AS buka dan hanya memberi tanda saat tren, timing, dan fee sama-sama lolos."}</p>
        </div>
        <button className="btn" onClick={enablePush} disabled={push}><Icon name="bell" />{push ? "Notifikasi aktif" : "Aktifkan notifikasi"}</button>
      </section>
      {msg && <p className="muted pad">{msg}</p>}
      <div className="rules">
        <span>Modal ${s.capitalUsd}</span><span>Risiko {s.riskPct}% / trade</span><span>Fee {s.feePctPerSide}% / sisi</span><span>SL {s.slAtr}× · TP {s.tpAtr}× ATR</span>
      </div>

      {rows.map((r) => {
        const trade = r.sl != null;
        const slD = trade ? r.price - r.sl : 0, tpD = trade ? r.tp - r.price : 0;
        return (
          <article key={r.symbol} className={`scard ${r.action}`} onClick={() => onOpen(r.symbol)}>
            <div className="srow">
              <div className="sname">
                <b className="sym">{r.symbol}</b>
                <span className="muted">{r.action === "ERROR" ? "Tidak ada data" : `Tren 1 jam ${r.trend === "UP" ? "naik" : "belum naik"} · Stochastic ${fmt(r.stochK, 0)}`}</span>
              </div>
              <span className="mono">{fmt(r.price)}</span>
              <span className={`badge ${r.action}`}>{LABEL[r.action] || r.action}</span>
            </div>
            {trade && (
              <>
                <div className="ladder" aria-hidden><i className="lsl" style={{ flex: slD }} /><b /><i className="ltp" style={{ flex: tpD }} /></div>
                <div className="lvals">
                  <span className="neg">SL {fmt(r.sl)}<small>{usd(r.netSl)}</small></span>
                  <span className="mid">Entry {fmt(r.price)}<small>posisi ${fmt(r.positionUsd, 0)}</small></span>
                  <span className="pos">TP {fmt(r.tp)}<small>{usd(r.netTp)}</small></span>
                </div>
                <div className="feeline">Fee pulang-pergi <b>{usd(r.fee)}</b>{r.action === "SKIP_FEE" && " — profit TP kurang dari 3× fee, jadi tidak dikirim sebagai sinyal."}</div>
              </>
            )}
          </article>
        );
      })}
      <p className="disc">Angka net sudah dikurangi fee beli dan jual. Alat bantu analisa, bukan saran investasi. Diperbarui {new Date(data.generatedAt).toLocaleTimeString("id-ID")}.</p>
    </div>
  );
}
