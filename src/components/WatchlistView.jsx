import { useEffect, useState } from "react";
import { getJSON } from "../lib/api.js";
import QuoteRow from "./QuoteRow.jsx";

export default function WatchlistView({ watch, onOpen, onToggleWatch }) {
  const [q, setQ] = useState([]);
  const key = watch.join(",");

  useEffect(() => {
    if (!key) { setQ([]); return; }
    const run = () => getJSON(`/api/quotes?symbols=${key}`).then((d) => setQ(d.results)).catch(() => {});
    run();
    const id = setInterval(run, 60_000);
    return () => clearInterval(id);
  }, [key]);

  if (!watch.length)
    return <p className="muted empty">Belum ada watchlist.<br />Tekan ☆ di halaman chart atau daftar pasar untuk menambah.</p>;

  return (
    <section className="card">
      <h3>⭐ Watchlist</h3>
      {watch.map((s) => <QuoteRow key={s} q={q.find((x) => x.symbol === s) || { symbol: s, name: "…", price: null }} onOpen={onOpen} onStar={onToggleWatch} starred />)}
    </section>
  );
}
