import { useEffect, useState, useCallback } from "react";
import { getJSON, GROUPS, errText } from "../lib/api.js";
import QuoteRow from "./QuoteRow.jsx";
import { Notice } from "./ui.jsx";

const ALL = Object.values(GROUPS).flat();

export default function MarketView({ onOpen, watch, onToggleWatch }) {
  const [q, setQ] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try { setQ((await getJSON(`/api/quotes?symbols=${ALL.join(",")}`)).results); setError(null); }
    catch (e) { setError(e); }
  }, []);
  useEffect(() => { load(); const id = setInterval(load, 60_000); return () => clearInterval(id); }, [load]);

  if (error && !q) return <Notice title="Pasar belum bisa dimuat" text={errText(error)} action="Coba lagi" onAction={load} />;
  if (!q) return <div className="skeleton tall" />;

  const by = Object.fromEntries(q.map((x) => [x.symbol, x]));
  const ok = q.filter((x) => x.changePct != null);
  const gain = [...ok].sort((a, b) => b.changePct - a.changePct).slice(0, 5);
  const lose = [...ok].sort((a, b) => a.changePct - b.changePct).slice(0, 5);

  return (
    <div className="stack">
      <div className="two">
        <section className="card"><h3>Top naik</h3>{gain.map((x) => <QuoteRow key={x.symbol} q={x} onOpen={onOpen} />)}</section>
        <section className="card"><h3>Top turun</h3>{lose.map((x) => <QuoteRow key={x.symbol} q={x} onOpen={onOpen} />)}</section>
      </div>
      {Object.entries(GROUPS).map(([name, syms]) => (
        <section className="card" key={name}>
          <h3>{name}</h3>
          {syms.map((s) => by[s] && <QuoteRow key={s} q={by[s]} onOpen={onOpen} onStar={onToggleWatch} starred={watch.includes(s)} />)}
        </section>
      ))}
      <p className="disc">Perubahan harian terhadap penutupan sebelumnya. Grafik mini = 1 bulan terakhir. Data Yahoo Finance, bisa tertunda.</p>
    </div>
  );
}
