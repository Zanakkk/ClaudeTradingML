import { useEffect, useState, useCallback, useMemo } from "react";
import { getJSON, errText, fmt, pct } from "../lib/api.js";
import { Icon, Notice } from "./ui.jsx";

const FILTERS = [["all", "Semua"], ["strong", "Lolos standar kuat"], ["KANDIDAT", "Kandidat"], ["PANTAU", "Pantau"], ["setup", "Sinyal aktif"]];
const DOLLARS = [[0, "Semua"], [1, "≥ $1"], [2, "≥ $2"], [3, "≥ $3"], [5, "≥ $5"]];
const PROFITS = [[0, "Semua"], [2, "≥ 2%"], [3, "≥ 3%"], [5, "≥ 5%"]];
const SORTS = [["score", "Skor"], ["win", "Win %"], ["vol", "Volatil"], ["net", "Untung %"], ["usd", "Untung $"]];
const VERDICT = { KANDIDAT: "Kandidat", PANTAU: "Pantau", HINDARI: "Hindari" };
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const money = (n) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}jt` : `$${Math.round(n / 1e3)}rb`);

const usd2 = (n) => `$${Math.abs(n).toFixed(2)}`;
// Rencana beli: ukuran posisi dibatasi oleh modal/jumlah posisi DAN rugi maksimal yang kamu izinkan.
function plan(r, cfg, fee) {
  const side = (pos) => Math.max(fee.min, (pos * fee.pct) / 100) + fee.fixed;
  const slF = r.slPct / 100, tpF = r.tpPct / 100;
  let pos = cfg.capital / cfg.n;
  // kurangi posisi sampai rugi maksimal (SL + fee) <= batas rugi
  for (let i = 0; i < 30 && pos * slF + side(pos) * 2 > cfg.risk; i++) pos *= 0.9;
  if (pos < 5) return null;
  const f2 = side(pos) * 2;
  return {
    pos, shares: pos / r.price, sl: r.price * (1 - slF), tp: r.price * (1 + tpF),
    maxLoss: pos * slF + f2, net: pos * tpF - f2, fee: f2, be: (f2 / pos) * 100,
    mcMed: r.mc ? (pos * r.mc.median) / 100 : null, mcBad: r.mc ? (pos * r.mc.p5) / 100 : null,
  };
}

function Card({ r, rank, onOpen, cfg, fee }) {
  const pl = fee ? plan(r, cfg, fee) : null;
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
      <div className="mc-box">
        <div className="eyebrow">Monte Carlo · simulasi 1.000×</div>
        {r.mc ? (
          <p>Dari 1.000 simulasi 10 trade berikutnya, <b className={r.mc.pProfit >= 70 ? "up" : "down"}>{r.mc.pProfit}%</b> berakhir untung. Hasil tengah {pct(r.mc.median, 1)}, skenario buruk (5% terburuk) {pct(r.mc.p5, 1)}.</p>
        ) : (
          <p className="s-note" style={{ margin: 0 }}>Belum bisa dihitung: {r.bt.trades < 8 ? `riwayat baru ${r.bt.trades} trade (minimal 8).` : "tekan Segarkan di atas untuk data terbaru."}</p>
        )}
      </div>
      {r.entry && (
        <div className="s-entry">
          <span>Masuk ${fmt(r.entry.price)}</span><span className="down">SL ${fmt(r.entry.sl)}</span><span className="up">TP ${fmt(r.entry.tp)}</span>
        </div>
      )}
      {pl && (
        <div className="s-plan">
          <div className="eyebrow">Versi simpel</div>
          <p className="s-line"><b>1. Beli</b> senilai <b>{usd2(pl.pos)}</b> <em>({pl.shares.toFixed(2)} lembar, harga ${fmt(r.price)})</em></p>
          <p className="s-line"><b>2. Jual untung</b> kalau harga sampai <b className="up">${fmt(pl.tp)}</b> → kamu dapat <b className="up">+{usd2(pl.net)}</b> <em>(sudah dipotong fee){r.holdH ? ` · biasanya ±${r.holdH} jam` : ""}</em></p>
          <p className="s-line"><b>3. Jual rugi</b> kalau harga turun ke <b className="down">${fmt(pl.sl)}</b> → kamu rugi <b className="down">−{usd2(pl.maxLoss)}</b></p>
          {pl.mcMed != null && (
            <div className="s-odds">
              <div className="eyebrow">Monte Carlo dalam dolar · 10 trade, masing-masing {usd2(pl.pos)}</div>
              <div className="odds-row mcd"><span>Hasil tengah</span><span className={pl.mcMed >= 0 ? "up" : "down"}>{pl.mcMed >= 0 ? "+" : "−"}{usd2(pl.mcMed)}</span><span>peluang untung {r.mc.pProfit}%</span></div>
              <div className="odds-row mcd"><span>Skenario buruk</span><span className="down">{pl.mcBad >= 0 ? "+" : "−"}{usd2(pl.mcBad)}</span><span>(5% terburuk)</span></div>
              {r.holdH && <p className="s-note">Satu trade rata-rata berlangsung ±{r.holdH} jam, jadi 10 trade ≈ {Math.round((r.holdH * 10) / 6.5)} hari bursa.</p>}
            </div>
          )}
          {r.hit?.h1 && (
            <div className="s-odds">
              <div className="eyebrow">Peluang dari riwayat saham ini</div>
              <div className="odds-row"><span>Dalam 1 jam</span><span className="up">kena untung {r.hit.h1.tp}%</span><span className="down">kena rugi {r.hit.h1.sl}%</span></div>
              <div className="odds-row"><span>Dalam 1 hari</span><span className="up">kena untung {r.hit.d1.tp}%</span><span className="down">kena rugi {r.hit.d1.sl}%</span></div>
              <p className="s-note">“Kena untung/rugi” = harga menyentuh angka di nomor 2/3. Sisanya: belum menyentuh keduanya. Targetnya biasanya butuh lebih dari 1 jam, jadi siap menunggu atau pasang alarm harga.</p>
            </div>
          )}
          {r.worstDay < -15 && <p className="s-warn">Hati-hati: saham ini pernah anjlok {Math.abs(r.worstDay).toFixed(0)}% dalam sehari. Harga bisa melompat melewati batas rugi, jadi ruginya bisa lebih besar dari {usd2(pl.maxLoss)}.</p>}
          {pl.net <= 0 && <p className="s-warn">Setelah fee, targetnya tidak menyisakan untung. Lewati.</p>}
        </div>
      )}
      <div className="s-grid">
        <div><small>Rata² bersih</small><b className={r.bt.avgNet >= 0 ? "up" : "down"}>{pct(r.bt.avgNet)}</b></div>
        <div><small>Untung bersih target</small><b className="up">+{fmt(r.netTpPct, 1)}%</b></div>
        <div><small>Target / fee</small><b>{fmt(r.tpPct, 1)}% / {fmt(r.rtFeePct, 1)}%</b></div>
        <div><small>Gerak 1 jam</small><b>{fmt(r.atrPct, 1)}%</b></div>
        <div><small>Volume/hari</small><b>{money(r.dollarVol)}</b></div>
      </div>
      <p className="s-chk">
        <b className={r.strong ? "up" : ""}>{r.strong ? "Lolos standar kuat" : `Standar kuat: ${r.checks.filter((c) => c.ok).length}/${r.checks.length}`}</b>
        {!r.strong && <> · kurang: {r.checks.filter((c) => !c.ok).map((c) => c.label).join("; ")}</>}
      </p>
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
  const [cfg, setCfg] = useState(() => load("calc", { capital: 100, n: 2, risk: 2 }));
  const [minProfit, setMinProfit] = useState(0);
  const [minUsd, setMinUsd] = useState(0);
  const [onlyCap, setOnlyCap] = useState(false);
  const [custom, setCustom] = useState(() => load("screenList", null));
  const [edit, setEdit] = useState(false);
  const setC = (k, v) => setCfg((c) => { const n = { ...c, [k]: v }; localStorage.setItem("calc", JSON.stringify(n)); return n; });
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
    const usdOf = (x) => (data.fee ? plan(x, cfg, data.fee)?.net ?? -1 : -1);
    if (minProfit) r = r.filter((x) => x.netTpPct >= minProfit);
    if (minUsd) r = r.filter((x) => usdOf(x) >= minUsd);
    if (filter === "setup") r = r.filter((x) => x.setupNow);
    else if (filter === "strong") r = r.filter((x) => x.strong);
    else if (filter !== "all") r = r.filter((x) => x.verdict === filter);
    const key = { score: (x) => x.score, win: (x) => x.bt.winShr, vol: (x) => x.atrPct, net: (x) => x.netTpPct, usd: (x) => (data.fee ? plan(x, cfg, data.fee)?.net ?? -1 : -1) }[sort];
    return [...r].sort((a, b) => key(b) - key(a));
  }, [data, filter, sort, onlyCap, minProfit, minUsd, cfg]);

  const saveList = () => {
    const syms = [...new Set(draft.split(/[\s,;]+/).map((x) => x.trim().toUpperCase()).filter(Boolean))].slice(0, 120);
    localStorage.setItem("screenList", JSON.stringify(syms.length ? syms : null));
    setCustom(syms.length ? syms : null); setEdit(false);
  };

  if (error && !data) return <Notice title="Screener belum bisa dimuat" text={errText(error, "daftar saham")} action="Coba lagi" onAction={() => run(false)} />;
  if (!data) return <div className="stack"><div className="skeleton tall" /><p className="disc">Menganalisis puluhan saham… biasanya 10–20 detik.</p></div>;

  const top = data.results.filter((x) => x.strong && (!onlyCap || x.price <= (data.maxPriceUsd || 10))).slice(0, 3);
  const age = Math.max(0, Math.round((Date.now() - data.generatedAt) / 60000));

  return (
    <div className="stack">
      <section className="card hero-s">
        <div className="eyebrow">Peringkat peluang · timeframe 1 jam</div>
        {top.length ? (
          <>
            <h2>{top.length} saham lolos standar kuat</h2>
            <div className="toprow">
              {top.map((t) => <button key={t.symbol} onClick={() => onOpen(t.symbol)}><b>{t.symbol}</b><span>{Math.round(t.bt.winShr * 100)}%</span></button>)}
            </div>
          </>
        ) : (
          <>
            <h2>Belum ada yang lolos standar kuat</h2>
            <p className="disc" style={{ margin: 0 }}>Tidak ada saham yang memenuhi ketujuh syarat di bawah. Menunggu lebih baik daripada memaksa masuk. Saham berlabel “Kandidat” masih boleh dipantau.</p>
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
      <div className="chips">
        <span className="chip-label">Untung bersih target</span>
        {PROFITS.map(([k, l]) => <button key={k} className={`chip ${minProfit === k ? "active" : ""}`} onClick={() => setMinProfit(k)}>{l}</button>)}
      </div>
      <div className="chips">
        <span className="chip-label">Untung target ($)</span>
        {DOLLARS.map(([k, l]) => <button key={k} className={`chip ${minUsd === k ? "active" : ""}`} onClick={() => setMinUsd(k)}>{l}</button>)}
      </div>
      <div className="seg">
        {SORTS.map(([k, l]) => <button key={k} className={sort === k ? "active" : ""} onClick={() => setSort(k)}>{l}</button>)}
      </div>

      {list.length ? list.map((r, i) => <Card key={r.symbol} r={r} rank={i + 1} onOpen={onOpen} cfg={cfg} fee={data.fee} />) : (
        <div className="empty"><b>Tidak ada saham untuk filter ini</b><p>Coba filter “Semua” atau matikan batas harga.</p></div>
      )}

      {data.skipped?.length > 0 && <p className="disc">Tidak ada data: {data.skipped.join(", ")}.</p>}

      <section className="card">
        <h3>Standar “kuat” untuk trade</h3>
        <ul className="std">
          {(data.results[0]?.checks || []).map((c) => <li key={c.k}>{c.label}</li>)}
        </ul>
        <p className="disc" style={{ margin: "8px 0 0" }}>Semua harus lolos. Ini patokan kehati-hatian dari saya, bukan rumus pasti: lolos berarti riwayatnya bagus, bukan berarti pasti untung. Simulasi mengacak hasil trade historis saham itu sendiri, jadi kalau sampelnya sedikit hasilnya ikut rapuh.</p>
      </section>

      <section className="card">
        <h3>Kalkulator posisi</h3>
        <div className="calc">
          <label>Modal ($)<input type="number" inputMode="decimal" min="10" value={cfg.capital} onChange={(e) => setC("capital", Math.max(10, +e.target.value || 0))} /></label>
          <label>Jumlah saham<input type="number" inputMode="numeric" min="1" max="5" value={cfg.n} onChange={(e) => setC("n", Math.min(5, Math.max(1, Math.round(+e.target.value || 1))))} /></label>
          <label>Rugi maks/trade ($)<input type="number" inputMode="decimal" min="0.5" step="0.5" value={cfg.risk} onChange={(e) => setC("risk", Math.max(0.5, +e.target.value || 0.5))} /></label>
        </div>
        <p className="disc" style={{ margin: "8px 0 0" }}>Angka “Rencana beli” di tiap kartu mengikuti isian ini. Ukuran posisi dikecilkan otomatis bila rugi di SL (termasuk fee) melebihi batasmu.</p>
      </section>

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
