import { useEffect, useState, useCallback } from "react";
import { getJSON, fmt, usd } from "../lib/api.js";

function b64ToUint8(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
const LABEL = { BUY: "BUY", WAIT: "WAIT", SKIP_FEE: "SKIP (fee)", NO_DATA: "No data", ERROR: "Error" };
const rank = { BUY: 0, SKIP_FEE: 1, WAIT: 2 };

export default function SignalsView({ onOpen }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState("");
  const [push, setPush] = useState(typeof Notification !== "undefined" && Notification.permission === "granted");

  const load = useCallback(async () => {
    try { setData(await getJSON("/api/signals")); setError(null); } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); const id = setInterval(load, 60_000); return () => clearInterval(id); }, [load]);

  async function enablePush() {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("Browser tidak mendukung push");
      const reg = await navigator.serviceWorker.register("/sw.js");
      if ((await Notification.requestPermission()) !== "granted") throw new Error("Izin notifikasi ditolak");
      const { publicKey } = await getJSON("/api/vapid");
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(publicKey) });
      const r = await fetch("/api/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub) });
      if (!r.ok) throw new Error("Gagal menyimpan langganan");
      setPush(true); setMsg("Notifikasi aktif ✔");
    } catch (e) { setMsg(e.message); }
  }

  const rows = (data?.results || []).slice().sort((a, b) => (rank[a.action] ?? 9) - (rank[b.action] ?? 9));
  const s = data?.settings;

  return (
    <div>
      <section className="card info">
        <div>
          <b>Sinyal strategi</b>
          <div className="muted">Tren 1 jam · timing 15 menit · SL/TP ATR · sudah dihitung fee</div>
          {s && <div className="muted">Modal ${s.capitalUsd} · risiko {s.riskPct}%/trade · fee {s.feePctPerSide}%/sisi</div>}
        </div>
        <button className="btn" onClick={enablePush} disabled={push}>{push ? "🔔 Aktif" : "🔔 Aktifkan"}</button>
      </section>
      {msg && <p className="muted">{msg}</p>}
      {error && <p className="err">Gagal memuat: {error}</p>}
      {!data && !error && <p className="muted">Memuat sinyal…</p>}

      {rows.map((r) => (
        <div key={r.symbol} className={`scard ${r.action}`} onClick={() => onOpen(r.symbol)}>
          <div className="srow">
            <b>{r.symbol}</b>
            <span className="muted">{r.error ? r.error : `Tren ${r.trend ?? "–"} · Stoch ${fmt(r.stochK, 0)}`}</span>
            <span className="price2">{fmt(r.price)}</span>
            <span className={`badge ${r.action}`}>{LABEL[r.action] || r.action}</span>
          </div>
          {r.sl != null && (
            <div className="grid">
              <div><small>SL</small>{fmt(r.sl)}</div>
              <div><small>TP</small>{fmt(r.tp)}</div>
              <div><small>Posisi</small>${fmt(r.positionUsd, 0)}</div>
              <div><small>Fee</small>{usd(r.fee)}</div>
              <div><small>Net TP</small><span className={r.netTp >= 0 ? "pos" : "neg"}>{usd(r.netTp)}</span></div>
              <div><small>Net SL</small><span className="neg">{usd(r.netSl)}</span></div>
            </div>
          )}
        </div>
      ))}
      <p className="disc">
        "SKIP (fee)" = sinyal teknikal ada, tapi fee memakan terlalu banyak profit. Alat bantu analisa, bukan saran
        investasi. Diperbarui: {data ? new Date(data.generatedAt).toLocaleTimeString("id-ID") : "–"}
      </p>
    </div>
  );
}
