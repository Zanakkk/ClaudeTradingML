import { useEffect, useState, useCallback, useMemo } from "react";
import { getJSON, errText, fmt, pct } from "../lib/api.js";
import { Icon, Notice } from "./ui.jsx";

const FILTERS = [["all", "Semua"], ["KANDIDAT", "Kandidat"], ["PANTAU", "Pantau"], ["setup", "Sinyal aktif"]];
const SORTS = [["score", "Skor"], ["win", "Win %"], ["vol", "Volatil"]];
const VERDICT = { KANDIDAT: "Kandidat", PANTAU: "Pantau", HINDARI: "Hindari" };
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const money = (n) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}jt` : `$${Math.round(n / 1e3)}rb`);

function Card({ r, rank, onOpen }) {
  const wr = r.bt.trades ? Math.round(r.bt.winShr * 100) : null;
  return (
    <button className={`scard ${r.verdict}`} onClick={() => onOpen(r.symbol)}>
      <div className="s-head">
        <span className="s-rank">{rank}</span>
        <div className="s-name"><b>{r.symbol}</b><small>{r.name}</small></div>
        <div className="s-price"><b>${fmt(r.price)}</b><small className={r.chg5d >= 0 ? "up" : "down"}>{pct(r.chg5d, 1)} · 5 hari</small></div>
      </div>
      <div className="s-body">
        <div className="s-win">
          <b>{wr == null ? "–" : `${wr}%`}</b>
          <small>peluang menang historis · {r.bt.trades} trade</small>
        </div>
        <span className={`vbadge ${r.verdict}`}>{VERDICT[r.verdict]}</span>
      </div>
      <div className="s-bar"><i style={{ width: `${r.score}%` }} /></div>
      <div className="s-grid">
        <div><small>Rata² bersih</small><b className={r.bt.avgNet >= 0 ? "up" : "down"}>{pct(r.bt.avgNet)}</b></div>
        <div><small>Target / fee</small><b>{fmt(r.tpPct, 1)}% / {fmt(r.rtFeePct, 1)}%</b></div>
        <div><small>Gerak 1 jam</small><b>{fmt(r.atrPct, 1)}%</b></div>
        <div><small>Volume/hari</small><b>{money(r.dollarVol)}</b></div>
      </div>
      {r.entry && (
        <div className="s-entry">
          <span>Masuk ${fmt(r.entry.price)}</span><span className="down">SL ${fmt(r.entry.sl)}</span><span className="up">TP ${fmt(r.entry.tp)}</span>
        </div>
      )}
      <p className="s-why">{r.reasons.join(" · ")}</p>
    </button>
  );
}

export default function ScreenerView({ onOpen }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("score");
  const [onlyCap, setOnlyCap] = useState(true);
  const [custom, setCustom] = useState(() => load("screenList", null));
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState("");

  const run = useCallback(async (force) => {
    setBusy(true);
    try {
      const url = custom?.length ? `/api/screener?symbols=${custom.join(",")}` : `/api/screener${force ? "?refresh=1" : ""}`;
      setData(await getJSON(url)); setError(null);
    } catch (e) { setError(e); }
    setBusy(false);
  }, [custom]);
  useEffect(() => { setData(null); run(false); }, [run]);

  const list = useMemo(() => {
    if (!data) return [];
    let r = data.results.filter((x) => !onlyCap || x.price <= (data.maxPriceUsd || 10));
    if (filter === "setup") r = r.filter((x) => x.setupNow);
    else if (filter !== "all") r = r.filter((x) => x.verdict === filter);
    const key = { score: (x) => x.score, win: (x) => x.bt.winShr, vol: (x) => x.atrPct }[sort];
    return [...r].sort((a, b) => key(b) - key(a));
  }, [data, filter, sort, onlyCap]);

  const saveList = () => {
    const syms = [...new Set(draft.split(/[\s,;]+/).map((x) => x.trim().toUpperCase()).filter(Boolean))].slice(0, 120);
    localStorage.setItem("screenList", JSON.stringify(syms.length ? syms : null));
    setCustom(syms.length ? syms : null); setEdit(false);
  };

  if (error && !data) return <Notice title="Screener belum bisa dimuat" text={errText(error, "daftar saham")} action="Coba lagi" onAction={() => run(false)} />;
  if (!data) return <div className="stack"><div className="skeleton tall" /><p className="disc">Menganalisis puluhan saham… biasanya 10–20 detik.</p></div>;

  const top = data.results.filter((x) => x.verdict === "KANDIDAT" && (!onlyCap || x.price <= (data.maxPriceUsd || 10))).slice(0, 3);
  const age = Math.max(0, Math.round((Date.now() - data.generatedAt) / 60000));

  return (
    <div className="stack">
      <section className="card hero-s">
        <div className="eyebrow">Peringkat peluang · timeframe 1 jam</div>
        {top.length ? (
          <>
            <h2>{top.length} saham paling layak dilirik</h2>
            <div className="toprow">
              {top.map((t) => <button key={t.symbol} onClick={() => onOpen(t.symbol)}><b>{t.symbol}</b><span>{Math.round(t.bt.winShr * 100)}%</span></button>)}
            </div>
          </>
        ) : (
          <>
            <h2>Belum ada kandidat kuat</h2>
            <p className="disc" style={{ margin: 0 }}>Tidak ada saham yang lolos semua syarat (tren naik, volume cukup, hasil bersih positif setelah fee). Menunggu lebih baik daripada memaksa masuk.</p>
          </>
        )}
        <div className="s-meta">
          <span>{data.results.length} saham dianalisis · {age} mnt lalu{data.custom ? " · daftar saya" : ""}</span>
          <button className="btn ghost sm" onClick={() => run(true)} disabled={busy}><Icon name="refresh" />{busy ? "Memuat" : "Segarkan"}</button>
        </div>
      </section>

      <div className="chips">
        {FILTERS.map(([k, l]) => <button key={k} className={`chip ${filter === k ? "active" : ""}`} onClick={() => setFilter(k)}>{l}</button>)}
        <button className={`chip ${onlyCap ? "active" : ""}`} onClick={() => setOnlyCap(!onlyCap)}>≤ ${data.maxPriceUsd || 10}</button>
      </div>
      <div className="seg">
        {SORTS.map(([k, l]) => <button key={k} className={sort === k ? "active" : ""} onClick={() => setSort(k)}>{l}</button>)}
      </div>

      {list.length ? list.map((r, i) => <Card key={r.symbol} r={r} rank={i + 1} onOpen={onOpen} />) : (
        <div className="empty"><b>Tidak ada saham untuk filter ini</b><p>Coba filter “Semua” atau matikan batas harga.</p></div>
      )}

      {data.skipped?.length > 0 && <p className="disc">Tidak ada data: {data.skipped.join(", ")}.</p>}

      <section className="card">
        <h3>Daftar saya</h3>
        {edit ? (
          <>
            <textarea className="ta" rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Contoh: SNAP, PLUG, NIO, SOFI (kosongkan untuk kembali ke daftar Gotrade)" />
            <div className="row-btn"><button className="btn" onClick={saveList}>Simpan &amp; analisis</button><button className="btn ghost" onClick={() => setEdit(false)}>Batal</button></div>
          </>
        ) : (
          <button className="btn ghost" onClick={() => { setDraft((custom || []).join(", ")); setEdit(true); }}>{custom ? `Ubah daftar (${custom.length} ticker)` : "Pakai daftar sendiri"}</button>
        )}
      </section>

      <p className="disc">
        “Peluang menang historis” = persentase trade yang untung bersih (setelah fee) saat aturan 1 jam yang sama diuji pada ±6 bulan riwayat saham itu, dikoreksi ke bawah bila sampelnya sedikit. Ini bukan jaminan: masa lalu tidak menjamin masa depan, hasil terbaik dari puluhan saham cenderung terlihat lebih bagus dari kenyataan, dan saham murah bisa gap turun, sulit dijual, atau reverse split. Gunakan SL, jangan pakai seluruh modal pada satu saham. Bukan nasihat keuangan.
      </p>
    </div>
  );
}
