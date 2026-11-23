import { fmt, pct } from "../lib/api.js";
import { Spark } from "./ui.jsx";

export default function QuoteRow({ q, onOpen, onStar, starred }) {
  if (q.error) return (
    <div className="qrow" onClick={() => onOpen(q.symbol)}>
      <div className="qname"><b>{q.symbol}</b><span>Tidak ada data</span></div>
    </div>
  );
  const up = (q.changePct ?? 0) >= 0;
  return (
    <div className="qrow" onClick={() => onOpen(q.symbol)}>
      <div className="qname"><b>{q.symbol}</b><span>{q.name || "…"}</span></div>
      <Spark data={q.spark} up={up} />
      <div className="qprice">{fmt(q.price)}</div>
      <div className={`pill ${up ? "pos" : "neg"}`}>{pct(q.changePct)}</div>
      {onStar && <button className={`star ${starred ? "on" : ""}`} aria-label="Watchlist" onClick={(e) => { e.stopPropagation(); onStar(q.symbol); }}>{starred ? "★" : "☆"}</button>}
    </div>
  );
}
