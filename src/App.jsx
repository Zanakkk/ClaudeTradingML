import { useEffect, useState, useCallback } from "react";

const fmt = (n) => (n == null ? "-" : n.toFixed(2));

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [symbols, setSymbols] = useState(localStorage.getItem("symbols") || "");

  const load = useCallback(async () => {
    try {
      const q = symbols ? `?symbols=${encodeURIComponent(symbols)}` : "";
      const r = await fetch(`/api/signals${q}`);
      setData(await r.json());
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [symbols]);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000); // refresh tiap 1 menit
    return () => clearInterval(id);
  }, [load]);

  const rows = (data?.results || []).slice().sort((a, b) => (b.action === "BUY") - (a.action === "BUY"));

  return (
    <div className="wrap">
      <h1>ProjectTradingML</h1>
      <p className="sub">Tren 1 jam · timing 15 menit · SL 1× ATR · TP 1.5× ATR</p>

      <div className="bar">
        <input
          placeholder="Ticker (pisah koma), kosong = default"
          value={symbols}
          onChange={(e) => { setSymbols(e.target.value); localStorage.setItem("symbols", e.target.value); }}
        />
        <button onClick={load}>Refresh</button>
      </div>

      {error && <p className="err">Gagal memuat: {error}</p>}
      {!data && !error && <p>Memuat…</p>}

      {data && (
        <table>
          <thead>
            <tr><th>Ticker</th><th>Sinyal</th><th>Harga</th><th>SL</th><th>TP</th><th>Tren 1H</th><th>Stoch K</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.symbol} className={r.action === "BUY" ? "buy" : ""}>
                <td>{r.symbol}</td>
                <td><b>{r.action}</b></td>
                <td>{fmt(r.price)}</td>
                <td>{fmt(r.sl)}</td>
                <td>{fmt(r.tp)}</td>
                <td>{r.trend || "-"}</td>
                <td>{fmt(r.stochK)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="disc">
        Alat bantu analisa, bukan saran investasi. Data Yahoo Finance (tidak resmi, bisa tertunda).
        Terakhir diperbarui: {data ? new Date(data.generatedAt).toLocaleTimeString("id-ID") : "-"}
      </p>
    </div>
  );
}
