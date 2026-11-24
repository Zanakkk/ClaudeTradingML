import { useEffect, useState, useCallback } from "react";
import { getJSON, fmt, pct, errText } from "../lib/api.js";
import { Notice } from "./ui.jsx";

const TFS = [["15m", "15 menit"], ["1h", "1 jam"], ["1d", "Harian"]];
const COLORS = { up: "#4FD6A5", down: "#FF7A7A", amber: "#F2B84B", text: "#E9F1EE", muted: "#7F9AA5" };

function Dial({ score, outlook, confidence }) {
  const cx = 120, cy = 118, r = 92;
  const pt = (s, rad) => { const th = Math.PI - ((s + 100) / 200) * Math.PI; return [cx + rad * Math.cos(th), cy - rad * Math.sin(th)]; };
  const [nx, ny] = pt(score, r - 14);
  const arc = (a, b) => { const [x1, y1] = pt(a, r), [x2, y2] = pt(b, r); return `M${x1},${y1} A${r},${r} 0 0 1 ${x2},${y2}`; };
  const tone = score >= 15 ? COLORS.up : score <= -15 ? COLORS.down : COLORS.amber;
  return (
    <div className="dial">
      <svg viewBox="0 0 240 140" role="img" aria-label={`Skor ${score} dari 100, ${outlook}`}>
        <path d={arc(-100, 100)} stroke="#17323E" strokeWidth="14" fill="none" strokeLinecap="round" />
        <path d={arc(-100, -40)} stroke={COLORS.down} strokeWidth="14" fill="none" strokeLinecap="round" opacity=".85" />
        <path d={arc(-36, -14)} stroke="#3C5D6B" strokeWidth="14" fill="none" opacity=".0" />
        <path d={arc(40, 100)} stroke={COLORS.up} strokeWidth="14" fill="none" strokeLinecap="round" opacity=".85" />
        <path d={arc(-38, 38)} stroke="#2A4A58" strokeWidth="14" fill="none" />
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={tone} strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="7" fill={tone} />
        <circle cx={cx} cy={cy} r="3" fill="#0A1A24" />
      </svg>
      <div className="dial-read">
        <b className="mono" style={{ color: tone }}>{score > 0 ? "+" : ""}{score}</b>
        <strong>{outlook}</strong>
        <span>Keyakinan data: {confidence}</span>
      </div>
    </div>
  );
}

function Fan({ d }) {
  const W = 340, H = 170, padR = 44, padY = 14;
  const hist = d.history.close.slice(-40);
  const total = hist.length + d.horizon;
  const mc = d.mc;
  const up2 = mc ? d.price * (1 + mc.bands.at(-1).p95 / 100) : d.price + d.cone.at(-1).s2;
  const dn2 = mc ? d.price * (1 + mc.bands.at(-1).p5 / 100) : d.price - d.cone.at(-1).s2;
  const hi = Math.max(...hist, up2), lo = Math.min(...hist, dn2);
  const x = (i) => (i / (total - 1)) * (W - padR);
  const y = (v) => padY + (1 - (v - lo) / (hi - lo || 1)) * (H - padY * 2);
  const base = hist.length - 1;
  const band = (key) => {
    const hiV = (k) => (mc ? d.price * (1 + mc.bands[k][key === "s2" ? "p95" : "p75"] / 100) : d.price + d.cone[k][key]);
    const loV = (k) => (mc ? d.price * (1 + mc.bands[k][key === "s2" ? "p5" : "p25"] / 100) : d.price - d.cone[k][key]);
    const up = d.cone.map((_, k) => `${x(base + k + 1).toFixed(1)},${y(hiV(k)).toFixed(1)}`);
    const dn = d.cone.map((_, k) => `${x(base + k + 1).toFixed(1)},${y(loV(k)).toFixed(1)}`).reverse();
    return `${x(base).toFixed(1)},${y(d.price).toFixed(1)} ${up.join(" ")} ${dn.join(" ")}`;
  };
  const path = hist.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="fan" role="img" aria-label="Rentang harga yang mungkin">
      <polygon points={band("s2")} fill="rgba(242,184,75,.10)" />
      <polygon points={band("s1")} fill="rgba(242,184,75,.20)" />
      <line x1={x(base)} y1={y(d.price)} x2={x(total - 1)} y2={y(d.price)} stroke="#F2B84B" strokeDasharray="3 4" opacity=".7" />
      <path d={path} fill="none" stroke={COLORS.text} strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx={x(base)} cy={y(d.price)} r="3.5" fill={COLORS.amber} />
      <g className="mono" fontSize="10" fill={COLORS.muted}>
        <text x={W - padR + 6} y={y(up2) + 3}>{fmt(up2)}</text>
        <text x={W - padR + 6} y={y(d.price) + 3} fill={COLORS.amber}>{fmt(d.price)}</text>
        <text x={W - padR + 6} y={y(dn2) + 3}>{fmt(dn2)}</text>
      </g>
    </svg>
  );
}

const usd = (n) => `${n < 0 ? "−" : "+"}$${Math.abs(n).toFixed(2)}`;
function cdf(q, thr) { // peluang hasil akhir <= thr, dari 21 kuantil (tiap 5%)
  if (thr <= q[0]) return 0;
  if (thr >= q[20]) return 1;
  for (let i = 0; i < 20; i++) if (thr < q[i + 1]) return (i + (q[i + 1] === q[i] ? 0 : (thr - q[i]) / (q[i + 1] - q[i]))) / 20;
  return 1;
}

function McBlock({ d }) {
  const [amt, setAmt] = useState(() => +localStorage.getItem("enter") || 100);
  const set = (v) => { setAmt(v); if (v > 0) localStorage.setItem("enter", String(v)); };
  const m = d.mc, f = d.fee;
  const pos = Math.max(1, amt || 0);
  const side = Math.max(f.min, (pos * f.pct) / 100) + f.fixed;
  const rt = side * 2;
  const val = (retPct) => (pos * retPct) / 100 - rt;
  const net = val(m.tpPct), loss = -val(-m.slPct);
  const pWin = (1 - cdf(m.q, (rt / pos) * 100)) * 100;
  const ev = (m.pTP / 100) * net - (m.pSL / 100) * loss;
  return (
    <section className="card">
      <h3>Monte Carlo · {m.iters.toLocaleString("id-ID")} jalur harga</h3>
      <label className="enter">
        <span>Mau masuk berapa ($)?</span>
        <input type="number" inputMode="decimal" min="1" value={amt || ""} onChange={(e) => set(+e.target.value)} />
      </label>
      <div className="chips" style={{ margin: "8px 0 12px" }}>
        {[25, 50, 100, 200, 500].map((v) => <button key={v} className={`chip ${amt === v ? "active" : ""}`} onClick={() => set(v)}>${v}</button>)}
      </div>
      <p className="s-line"><b>Beli</b> ${pos.toFixed(2)} <em>({(pos / d.price).toFixed(2)} lembar @ ${fmt(d.price)}) · fee bolak-balik ≈ ${rt.toFixed(2)}</em></p>

      <div className="eyebrow" style={{ marginTop: 12 }}>Kalau ditahan {d.horizonLabel}</div>
      <div className="odds-row mcd"><span>Terbaik 5%</span><span className="up">{usd(val(m.q[19]))}</span><span /></div>
      <div className="odds-row mcd"><span>Tengah</span><span className={val(m.q[10]) >= 0 ? "up" : "down"}>{usd(val(m.q[10]))}</span><span /></div>
      <div className="odds-row mcd"><span>Terburuk 5%</span><span className="down">{usd(val(m.q[1]))}</span><span /></div>
      <p className="s-note">Peluang untung bersih (setelah fee): <b className={pWin >= 50 ? "up" : "down"}>{pWin.toFixed(0)}%</b></p>

      <div className="eyebrow" style={{ marginTop: 12 }}>Kalau pakai target &amp; batas rugi</div>
      <p className="s-line"><b className="up">Kena target</b> (+{m.tpPct.toFixed(1)}%) {usd(net)} · peluang <b>{m.pTP.toFixed(0)}%</b></p>
      <p className="s-line"><b className="down">Kena batas rugi</b> (−{m.slPct.toFixed(1)}%) {usd(-loss)} · peluang <b>{m.pSL.toFixed(0)}%</b></p>
      <p className="s-line"><b>Belum keduanya</b> dalam {d.horizonLabel} · peluang <b>{m.pNone.toFixed(0)}%</b></p>
      <p className="s-note">Kalau diulang berkali-kali, rata-rata dari yang kena target/batas ≈ <b className={ev >= 0 ? "up" : "down"}>{usd(ev)}</b> per trade. Simulasi ini tidak menebak arah, jadi angka positif berarti target lebih besar dari fee dan risikonya, bukan karena harga pasti naik.</p>
    </section>
  );
}

export default function PredictView({ symbol }) {
  const [tf, setTf] = useState(() => localStorage.getItem("ptf") || "1h");
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);

  const run = useCallback(async () => {
    setD(null); setError(null);
    try { setD(await getJSON(`/api/predict?symbol=${encodeURIComponent(symbol)}&tf=${tf}`)); }
    catch (e) { setError(e); }
  }, [symbol, tf]);
  useEffect(() => { run(); }, [run]);
  const pick = (k) => { setTf(k); localStorage.setItem("ptf", k); };

  const head = (
    <>
      <div className="phead">
        <div><div className="eyebrow">Prediksi berbasis probabilitas</div><h1 className="sym-lg">{symbol}</h1></div>
      </div>
      <div className="seg">{TFS.map(([k, l]) => <button key={k} className={k === tf ? "active" : ""} onClick={() => pick(k)}>{l}</button>)}</div>
    </>
  );

  if (error?.kind === "notfound") return <div className="stack">{head}<Notice title={`Tidak ada data untuk “${symbol}”`} text="Periksa kode tickernya, atau cari ticker lain lewat kolom cari." /></div>;
  if (error) return <div className="stack">{head}<Notice title="Prediksi belum bisa dihitung" text={errText(error)} action="Coba lagi" onAction={run} /></div>;
  if (!d) return <div className="stack">{head}<div className="skeleton tall" /></div>;
  if (d.error) return <div className="stack">{head}<Notice title="Data riwayat belum cukup" text="Ticker ini terlalu baru atau datanya terlalu sedikit untuk dihitung. Coba timeframe lain." /></div>;

  const b = d.backtest, a = d.analog;
  const good = b.trades >= 20 && b.avgNet > 0;
  const lvl = a.level === "exact" ? "kondisi yang sangat mirip" : a.level === "trend" ? "arah tren yang sama" : "seluruh riwayat";

  return (
    <div className="stack">
      {head}
      <section className="card dialcard">
        <Dial score={d.score} outlook={d.outlook} confidence={d.confidence} />
        <p className="muted center-t">Skor −100 sampai +100 dari tren, momentum, dan pola historis. Ini kondisi saat ini, bukan jaminan arah harga.</p>
      </section>

      <section className="card">
        <h3>Kalau dulu kondisinya seperti sekarang</h3>
        <div className="stats">
          <div><small>Berakhir naik</small><b className="mono" style={{ color: a.pUp >= d.basePUp ? COLORS.up : COLORS.down }}>{a.pUp.toFixed(0)}%</b><em>biasanya {d.basePUp.toFixed(0)}%</em></div>
          <div><small>Rata-rata gerak</small><b className="mono">{pct(a.avg)}</b><em>median {pct(a.median)}</em></div>
          <div><small>Rentang 80%</small><b className="mono sm">{pct(a.p10, 1)} – {pct(a.p90, 1)}</b><em>dalam {d.horizonLabel}</em></div>
        </div>
        <p className="muted">Dihitung dari {a.n} kejadian dengan {lvl} di riwayat {symbol}. Kejadian saling tumpang tindih, jadi angkanya lebih rapuh daripada kelihatannya.</p>
      </section>

      <section className="card">
        <h3>Rentang harga {d.horizonLabel} ke depan</h3>
        <Fan d={d} />
        <p className="muted">{d.mc ? "Dari 1.000 jalur simulasi: pita terang = 50% jalur di tengah, pita pudar = 90%. Tanpa menebak arah." : "Pita terang = sekitar 68% kemungkinan, pita pudar = sekitar 95%. Dari volatilitas terakhir, tanpa menebak arah."}</p>
      </section>

      {d.mc && d.fee && <McBlock d={d} />}

      <section className="card">
        <h3>Yang membentuk skor</h3>
        {d.factors.map((f) => (
          <div className="factor" key={f.label}>
            <div><b>{f.label}</b><span>{f.text}</span></div>
            <div className="bar"><i style={{ width: `${Math.min(100, Math.abs(f.pts) * 3.3)}%`, background: f.pts >= 0 ? COLORS.up : COLORS.down, [f.pts >= 0 ? "left" : "right"]: "50%" }} /></div>
            <em className="mono" style={{ color: f.pts > 0 ? COLORS.up : f.pts < 0 ? COLORS.down : COLORS.muted }}>{f.pts > 0 ? "+" : ""}{f.pts}</em>
          </div>
        ))}
      </section>

      <section className={`card verdict ${good ? "good" : "bad"}`}>
        <h3>Uji mundur aturan sinyal di {symbol}</h3>
        <p className="verdict-t">{b.trades === 0 ? "Belum ada kejadian sinyal di riwayat ini." : good ? `Positif setelah fee pada ${b.trades} trade di riwayat ini.` : "Belum terbukti menguntungkan setelah fee."}</p>
        {b.trades > 0 && (
          <div className="stats">
            <div><small>Trade</small><b className="mono">{b.trades}</b></div>
            <div><small>Menang</small><b className="mono">{b.winRate.toFixed(0)}%</b></div>
            <div><small>Rata-rata net</small><b className="mono" style={{ color: b.avgNet >= 0 ? COLORS.up : COLORS.down }}>{pct(b.avgNet)}</b></div>
          </div>
        )}
        <p className="muted">Fee pulang-pergi ≈ {b.rtFeePct.toFixed(2)}% dari modal, sedangkan target TP rata-rata ≈ {b.tpPct.toFixed(2)}% per trade.{b.tpPct < b.rtFeePct * 2 && " Target sekecil itu hampir habis dimakan fee."}{b.trades > 0 && b.trades < 20 && " Sampelnya masih kecil."}</p>
      </section>

      <p className="disc">Semua angka dihitung dari riwayat harga, bukan ramalan. Pasar bisa bergerak berlawanan dengan pola lama kapan saja. Alat bantu analisa, bukan saran investasi.</p>
    </div>
  );
}
