import { useEffect, useState } from "react";
import { getJSON } from "../lib/api.js";

export default function SearchBar({ onPick }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!q.trim()) { setRes([]); return; }
    const id = setTimeout(async () => {
      try { setRes((await getJSON(`/api/search?q=${encodeURIComponent(q.trim())}`)).results || []); }
      catch { setRes([]); }
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  const pick = (symbol) => { onPick(symbol); setQ(""); setRes([]); setOpen(false); };

  return (
    <div className="search">
      <input
        value={q}
        placeholder="Cari saham, ETF, crypto… (NVDA, BBCA.JK, BTC-USD)"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || !q.trim()) return;
          const t = q.trim().toUpperCase();
          pick(res.find((r) => r.symbol === t)?.symbol || t);
        }}
      />
      {open && res.length > 0 && (
        <ul className="drop">
          {res.map((r) => (
            <li key={r.symbol} onPointerDown={() => pick(r.symbol)}>
              <b>{r.symbol}</b>
              <span>{r.name}</span>
              <em>{r.exchange}</em>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
