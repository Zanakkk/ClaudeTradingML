import { useState } from "react";
import { authed, errText, fmt } from "../lib/api.js";
import { money, toDisp, fromDisp, sym, rate, px, pxSym } from "../lib/money.js";

// Lembar "Catat masuk": mencatat pembelian yang SUDAH kamu lakukan di broker ke jurnal.
// Nominal diketik dalam mata uang tampilan; harga & SL/TP dalam mata uang saham itu (saham .JK = rupiah).
export default function RecordSheet({ item, feePct, onClose, onSaved }) {
  const idr = item.cur === "IDR";
  const [amt, setAmt] = useState(() => Math.round(toDisp(item.usd) * 100) / 100);
  const [price, setPrice] = useState(+item.price.toFixed(idr ? 2 : 4));
  const [sl, setSl] = useState(item.sl ? +item.sl.toFixed(idr ? 2 : 4) : "");
  const [tp, setTp] = useState(item.tp ? +item.tp.toFixed(idr ? 2 : 4) : "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const usdVal = fromDisp(amt);
  const nat = idr ? usdVal * rate() : usdVal; // nominal dalam mata uang saham
  const ok = amt > 0 && price > 0;
  const pct = idr ? item.feePct ?? 0.2 : feePct;

  async function save() {
    setBusy(true); setErr("");
    try {
      await authed("/api/journal", { op: "open", symbol: item.symbol, name: item.name, usd: nat, price, sl: sl || null, tp: tp || null, note, pred: item.pred });
      onSaved();
    } catch (e) { setErr(errText(e)); setBusy(false); }
  }
  const feeUsd = idr ? (usdVal * pct) / 100 : Math.max(0.1, (usdVal * pct) / 100) + 0.02;

  return (
    <div className="overlay sheetwrap" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`Catat masuk ${item.symbol}`} onClick={(e) => e.stopPropagation()}>
        <div className="grab" aria-hidden="true" />
        <h2>Catat masuk {item.symbol}</h2>
        <p className="muted">Isi sesuai pembelian yang kamu lakukan di broker. Harga bisa kamu ubah kalau terisi di harga berbeda.</p>
        <div className="aform">
          <label>Nominal beli ({sym()})<input type="number" inputMode="decimal" value={amt || ""} onChange={(e) => setAmt(+e.target.value)} /></label>
          <label>Harga masuk ({pxSym(item.cur)}/lembar)<input type="number" inputMode="decimal" step="any" value={price || ""} onChange={(e) => setPrice(+e.target.value)} /></label>
          <div className="two">
            <label>Batas rugi (SL)<input type="number" inputMode="decimal" step="any" value={sl} onChange={(e) => setSl(+e.target.value || "")} /></label>
            <label>Target (TP)<input type="number" inputMode="decimal" step="any" value={tp} onChange={(e) => setTp(+e.target.value || "")} /></label>
          </div>
          <label>Catatan (opsional)<input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Alasan masuk" /></label>
        </div>
        {ok && <p className="muted">≈ {idr ? `${Math.floor(nat / price / 100)} lot · ` : ""}{fmt(nat / price, idr ? 0 : 4)} lembar · fee beli ≈ {money(feeUsd)}</p>}
        {err && <p className="aerr" role="alert">{err}</p>}
        <div className="row-btn">
          <button className="btn" onClick={save} disabled={!ok || busy}>{busy ? "Menyimpan…" : "Catat masuk"}</button>
          <button className="btn ghost" onClick={onClose}>Batal</button>
        </div>
      </div>
    </div>
  );
}
