import { useEffect, useState } from "react";
import { getJSON } from "../lib/api.js";

export default function SearchBar({ onPick }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  const [state, setState] = useState("idle"); // idle | loading | done
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (!term) { setRes([]); setState("idle"); return; }
    setState("loading");
    let alive = true;
    const id = setTimeout(async () => {
      let list = [];
      try { list = (await getJSON(`/api/search?q=${encodeURIComponent(term)}`)).results || []; } catch {}
      if (alive) { setRes(list); setState("done"); }
    }, 250);
    return () => { alive = false; clearTimeout(id); };
  }, [q]);

  const pick = (symbol) => { onPick(symbol); setQ(""); setRes([]); setState("idle"); setOpen(false); document.activeElement?.blur?.(); };
  const term = q.trim();

  return (
    <div className="search">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>
      <input
        value={q}
        inputMode="search"
        autoCapitalize="characters"
        placeholder="Cari saham, ETF, crypto"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || !term) return;
          const t = term.toUpperCase();
          if (res.length) pick(res.find((r) => r.symbol === t)?.symbol || res[0].symbol);
          else if (state === "loading") pick(t);
        }}
      />
      {open && term && (
        <div className="drop">
          {state === "loading" && !res.length && <div className="drop-empty">Mencari…</div>}
          {state === "done" && !res.length && (
            <div className="drop-empty"><b>Tidak ada hasil untuk “{term}”</b><span>Coba kode ticker, misalnya NVDA. Saham Indonesia memakai akhiran .JK (BBCA.JK).</span></div>
          )}
          {res.map((r) => (
            <button key={r.symbol} onPointerDown={() => pick(r.symbol)}>
              <b>{r.symbol}</b><span>{r.name}</span><em>{r.exchange}</em>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
