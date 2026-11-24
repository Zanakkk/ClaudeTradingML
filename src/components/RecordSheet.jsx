import { useState } from "react";
import { authed, errText, fmt } from "../lib/api.js";

// Lembar "Catat masuk": mencatat pembelian yang SUDAH kamu lakukan di Gotrade ke jurnal.
export default function RecordSheet({ item, feePct, onClose, onSaved }) {
  const [usd, setUsd] = useState(+item.usd.toFixed(2));
  const [price, setPrice] = useState(+item.price.toFixed(4));
  const [sl, setSl] = useState(item.sl ? +item.sl.toFixed(4) : "");
  const [tp, setTp] = useState(item.tp ? +item.tp.toFixed(4) : "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ok = usd > 0 && price > 0;

  async function save() {
    setBusy(true); setErr("");
    try {
      await authed("/api/journal", { op: "open", symbol: item.symbol, name: item.name, usd, price, sl: sl || null, tp: tp || null, note, pred: item.pred });
      onSaved();
    } catch (e) { setErr(errText(e)); setBusy(false); }
  }

  return (
    <div className="overlay sheetwrap" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`Catat masuk ${item.symbol}`} onClick={(e) => e.stopPropagation()}>
        <div className="grab" aria-hidden="true" />
        <h2>Catat masuk {item.symbol}</h2>
        <p className="muted">Isi sesuai pembelian yang kamu lakukan di Gotrade. Harga bisa kamu ubah kalau terisi di harga berbeda.</p>
        <div className="aform">
          <label>Nominal beli ($)<input type="number" inputMode="decimal" value={usd || ""} onChange={(e) => setUsd(+e.target.value)} /></label>
          <label>Harga masuk ($/lembar)<input type="number" inputMode="decimal" step="any" value={price || ""} onChange={(e) => setPrice(+e.target.value)} /></label>
          <div className="two">
            <label>Batas rugi (SL)<input type="number" inputMode="decimal" step="any" value={sl} onChange={(e) => setSl(+e.target.value || "")} /></label>
            <label>Target (TP)<input type="number" inputMode="decimal" step="any" value={tp} onChange={(e) => setTp(+e.target.value || "")} /></label>
          </div>
          <label>Catatan (opsional)<input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Alasan masuk" /></label>
        </div>
        {ok && <p className="muted">≈ {fmt(usd / price, 4)} lembar · fee beli ≈ ${(Math.max(0.1, (usd * feePct) / 100) + 0.02).toFixed(2)}</p>}
        {err && <p className="aerr" role="alert">{err}</p>}
        <div className="row-btn">
          <button className="btn" onClick={save} disabled={!ok || busy}>{busy ? "Menyimpan…" : "Catat masuk"}</button>
          <button className="btn ghost" onClick={onClose}>Batal</button>
        </div>
      </div>
    </div>
  );
}
