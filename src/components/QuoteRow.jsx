import { fmt, pct } from "../lib/api.js";

export default function QuoteRow({ q, onOpen, onStar, starred }) {
  if (q.error) return <div className="qrow"><b>{q.symbol}</b><span className="muted">Error</span></div>;
  const up = (q.changePct ?? 0) >= 0;
  return (
    <div className="qrow" onClick={() => onOpen(q.symbol)}>
      <div className="qname"><b>{q.symbol}</b><span className="muted">{q.name}</span></div>
      <div className="qprice">{fmt(q.price)}</div>
      <div className={`pill ${up ? "pos" : "neg"}`}>{pct(q.changePct)}</div>
      {onStar && <button className={`star ${starred ? "on" : ""}`} onClick={(e) => { e.stopPropagation(); onStar(q.symbol); }}>{starred ? "★" : "☆"}</button>}
    </div>
  );
}
