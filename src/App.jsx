import { useEffect, useState, useCallback } from "react";

const fmt = (n, d = 2) => (n == null ? "-" : n.toFixed(d));
const usd = (n) => (n == null ? "-" : `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`);

function b64ToUint8(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const LABEL = { BUY: "BUY", WAIT: "WAIT", SKIP_FEE: "SKIP (fee)", NO_DATA: "No data", ERROR: "Error" };

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [push, setPush] = useState(
    typeof Notification !== "undefined" && Notification.permission === "granted" ? "on" : "off"
  );
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/signals");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  async function enablePush() {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("Browser tidak mendukung push");
      const reg = await navigator.serviceWorker.register("/sw.js");
      if ((await Notification.requestPermission()) !== "granted") throw new Error("Izin notifikasi ditolak");
      const { publicKey } = await (await fetch("/api/vapid")).json();
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(publicKey) });
      const r = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      if (!r.ok) throw new Error("Gagal menyimpan langganan");
      setPush("on");
      setMsg("Notifikasi aktif ✔");
    } catch (e) {
      setMsg(e.message);
    }
  }

  const rank = { BUY: 0, SKIP_FEE: 1, WAIT: 2 };
  const rows = (data?.results || []).slice().sort((a, b) => (rank[a.action] ?? 9) - (rank[b.action] ?? 9));
  const s = data?.settings;

  return (
    <div className="wrap">
      <h1>ClaudeTradingML</h1>
      <p className="sub">Tren 1 jam · timing 15 menit · SL/TP berbasis ATR · sudah dihitung fee</p>

      <div className="bar">
        <button onClick={load}>Refresh</button>
        <button onClick={enablePush} disabled={push === "on"}>
          {push === "on" ? "Notifikasi aktif" : "Aktifkan notifikasi"}
        </button>
      </div>
      {msg && <p className="sub">{msg}</p>}
      {error && <p className="err">Gagal memuat: {error}</p>}
      {!data && !error && <p>Memuat…</p>}

      {s && (
        <p className="sub">
          Modal ${s.capitalUsd} · risiko {s.riskPct}%/trade · fee {s.feePctPerSide}%/sisi (min ${s.minFeeUsd})
        </p>
      )}

      {data && (
        <table>
          <thead>
            <tr><th>Ticker</th><th>Sinyal</th><th>Harga</th><th>SL</th><th>TP</th><th>Posisi</th><th>Fee</th><th>Net TP</th><th>Net SL</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.symbol} className={r.action === "BUY" ? "buy" : r.action === "SKIP_FEE" ? "skip" : ""}>
                <td>{r.symbol}</td>
                <td><b>{LABEL[r.action] || r.action}</b></td>
                <td>{fmt(r.price)}</td>
                <td>{fmt(r.sl)}</td>
                <td>{fmt(r.tp)}</td>
                <td>{r.positionUsd == null ? "-" : `$${fmt(r.positionUsd, 0)}`}</td>
                <td>{usd(r.fee)}</td>
                <td>{usd(r.netTp)}</td>
                <td>{usd(r.netSl)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="disc">
        "SKIP (fee)" = sinyal teknikal ada, tapi fee memakan terlalu banyak profit. Alat bantu analisa, bukan saran
        investasi. Data Yahoo Finance (tidak resmi, bisa tertunda).
        Terakhir diperbarui: {data ? new Date(data.generatedAt).toLocaleTimeString("id-ID") : "-"}
      </p>
    </div>
  );
}
