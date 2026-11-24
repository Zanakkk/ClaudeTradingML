import { useEffect, useState, useCallback, useMemo } from "react";
import { authed, getJSON, errText, fmt, pct } from "../lib/api.js";
import { Notice, Spark } from "./ui.jsx";

const m$ = (n) => `${n < 0 ? "−" : "+"}$${Math.abs(n).toFixed(2)}`;
const day = (t) => new Date(t).toLocaleDateString("id-ID", { day: "numeric", month: "short" });

export default function PortfolioView({ user, onLogin, onOpen }) {
  const [data, setData] = useState(null);
  const [live, setLive] = useState({});
  const [error, setError] = useState(null);
  const [closing, setClosing] = useState(null); // {id, price}
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setData(await authed("/api/journal", { op: "list" })); setError(null); } catch (e) { setError(e); }
  }, []);
  useEffect(() => { if (user) load(); }, [user, load]);

  const openSyms = useMemo(() => [...new Set((data?.trades || []).filter((t) => t.status === "open").map((t) => t.symbol))], [data]);
  useEffect(() => {
    if (!openSyms.length) return;
    const run = () => getJSON(`/api/quotes?symbols=${openSyms.join(",")}`).then((d) => setLive(Object.fromEntries(d.results.filter((x) => x.price != null).map((x) => [x.symbol, x.price])))).catch(() => {});
    run(); const id = setInterval(run, 60_000); return () => clearInterval(id);
  }, [openSyms]);

  if (!user) {
    return (
      <div className="empty">
        <b>Masuk untuk mulai mencatat</b>
        <p>Jurnal trade dan track record-mu tersimpan di akun, jadi aman dan bisa dibuka dari HP mana pun.</p>
        <div className="row-btn" style={{ justifyContent: "center" }}>
          <button className="btn" onClick={() => onLogin("signup")}>Buat akun</button>
          <button className="btn ghost" onClick={() => onLogin("login")}>Masuk</button>
        </div>
      </div>
    );
  }
  if (error && !data) return <Notice title="Portofolio belum bisa dimuat" text={errText(error)} action="Coba lagi" onAction={load} />;
  if (!data) return <div className="skeleton tall" />;

  const fee = data.fee;
  const side = (u) => Math.max(fee.min, (u * fee.pct) / 100) + fee.fixed;
  const open = data.trades.filter((t) => t.status === "open");
  const closed = data.trades.filter((t) => t.status === "closed").sort((a, b) => a.closedAt - b.closedAt);
  const unreal = (t) => { const p = live[t.symbol]; return p == null ? null : t.shares * (p - t.entryPrice) - t.feeIn - side(t.shares * p); };

  const wins = closed.filter((t) => t.pnl > 0), losses = closed.filter((t) => t.pnl <= 0);
  const total = closed.reduce((s, t) => s + t.pnl, 0);
  const gp = wins.reduce((s, t) => s + t.pnl, 0), gl = -losses.reduce((s, t) => s + t.pnl, 0);
  const curve = closed.reduce((a, t) => [...a, (a.at(-1) ?? 0) + t.pnl], [0]);
  const unrealSum = open.reduce((s, t) => s + (unreal(t) ?? 0), 0);
  const withPred = closed.filter((t) => t.pred?.win != null);
  const predWin = withPred.length ? (withPred.reduce((s, t) => s + t.pred.win, 0) / withPred.length) : null;
  const realWin = withPred.length ? (withPred.filter((t) => t.pnl > 0).length / withPred.length) * 100 : null;

  async function act(body) {
    setBusy(true);
    try { setData(await authed("/api/journal", body)); setClosing(null); } catch (e) { setError(e); }
    setBusy(false);
  }

  return (
    <div className="stack">
      <section className="card hero-s">
        <div className="eyebrow">Track record</div>
        <h2 className={total >= 0 ? "up" : "down"}>{closed.length ? m$(total) : "$0.00"} <small>terealisasi</small></h2>
        <div className="s-grid">
          <div><small>Trade selesai</small><b>{closed.length}</b></div>
          <div><small>Win rate</small><b>{closed.length ? `${Math.round((wins.length / closed.length) * 100)}%` : "–"}</b></div>
          <div><small>Rata² menang / kalah</small><b><span className="up">{wins.length ? m$(gp / wins.length) : "–"}</span> / <span className="down">{losses.length ? m$(-gl / losses.length) : "–"}</span></b></div>
          <div><small>Profit factor</small><b>{gl > 0 ? fmt(gp / gl, 2) : closed.length ? "∞" : "–"}</b></div>
        </div>
        {curve.length > 2 && <div style={{ marginTop: 12 }}><Spark data={curve} up={total >= 0} w={300} h={44} /></div>}
        {open.length > 0 && <p className="s-note">Posisi terbuka sekarang: <b className={unrealSum >= 0 ? "up" : "down"}>{m$(unrealSum)}</b> (belum direalisasi, sudah termasuk fee jual).</p>}
      </section>

      {predWin != null && (
        <section className="card">
          <h3>Prediksi vs kenyataan</h3>
          <p className="s-line">Saat masuk, rata-rata peluang menang yang ditampilkan: <b>{predWin.toFixed(0)}%</b>. Hasil nyata dari {withPred.length} trade: <b className={realWin >= predWin ? "up" : "down"}>{realWin.toFixed(0)}%</b>.</p>
          <p className="s-note">{withPred.length < 20 ? "Sampel masih kecil, jangan disimpulkan dulu. " : ""}Ini ukuran paling jujur apakah alat ini berguna untukmu.</p>
        </section>
      )}

      <section className="card">
        <h3>Posisi terbuka · {open.length}</h3>
        {!open.length && <p className="muted">Belum ada. Di Screener, tekan “Catat masuk” setelah kamu membeli di Gotrade.</p>}
        {open.map((t) => {
          const u = unreal(t), p = live[t.symbol];
          const hitTp = p != null && t.tp && p >= t.tp, hitSl = p != null && t.sl && p <= t.sl;
          return (
            <div className="pos" key={t.id}>
              <div className="pos-h">
                <button className="linkb" onClick={() => onOpen(t.symbol)}><b>{t.symbol}</b></button>
                <span className="muted">{day(t.openedAt)} · ${t.usd.toFixed(2)} @ ${fmt(t.entryPrice, 4)}</span>
                <b className={u == null ? "" : u >= 0 ? "up" : "down"}>{u == null ? "…" : m$(u)}</b>
              </div>
              <div className="pos-m">
                <span>Sekarang {p != null ? `$${fmt(p, 4)}` : "…"}</span>
                {t.sl && <span className="down">SL ${fmt(t.sl, 4)}</span>}
                {t.tp && <span className="up">TP ${fmt(t.tp, 4)}</span>}
              </div>
              {hitTp && <p className="s-note up">Harga sudah mencapai target. Pertimbangkan jual.</p>}
              {hitSl && <p className="s-warn">Harga sudah menyentuh batas rugi. Pertimbangkan jual.</p>}
              {t.note && <p className="s-note">{t.note}</p>}
              {closing?.id === t.id ? (
                <div className="closebox">
                  <label className="enter small"><span>Harga jual ($/lembar)</span>
                    <input type="number" inputMode="decimal" step="any" value={closing.price} onChange={(e) => setClosing({ id: t.id, price: +e.target.value || "" })} />
                  </label>
                  {closing.price > 0 && (() => { const pnl = t.shares * (closing.price - t.entryPrice) - t.feeIn - side(t.shares * closing.price); return <p className="s-line">Hasil bersih ≈ <b className={pnl >= 0 ? "up" : "down"}>{m$(pnl)}</b> ({pct((pnl / t.usd) * 100, 1)})</p>; })()}
                  <div className="row-btn">
                    <button className="btn" disabled={busy || !(closing.price > 0)} onClick={() => act({ op: "close", id: t.id, exitPrice: closing.price })}>Catat jual</button>
                    <button className="btn ghost" onClick={() => setClosing(null)}>Batal</button>
                  </div>
                </div>
              ) : (
                <div className="row-btn">
                  <button className="btn ghost sm" onClick={() => setClosing({ id: t.id, price: p != null ? +p.toFixed(4) : "" })}>Catat jual</button>
                  <button className="btn ghost sm" onClick={() => window.confirm("Hapus catatan ini? Tidak bisa dibatalkan.") && act({ op: "delete", id: t.id })}>Hapus</button>
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section className="card">
        <h3>Riwayat · {closed.length}</h3>
        {!closed.length && <p className="muted">Trade yang sudah kamu jual akan tampil di sini.</p>}
        {[...closed].reverse().map((t) => (
          <div className="pos" key={t.id}>
            <div className="pos-h">
              <button className="linkb" onClick={() => onOpen(t.symbol)}><b>{t.symbol}</b></button>
              <span className="muted">{day(t.openedAt)} → {day(t.closedAt)}</span>
              <b className={t.pnl >= 0 ? "up" : "down"}>{m$(t.pnl)}</b>
            </div>
            <div className="pos-m">
              <span>${t.usd.toFixed(2)} · ${fmt(t.entryPrice, 4)} → ${fmt(t.exitPrice, 4)}</span>
              <span>{pct(t.pnlPct, 1)} · fee ${(t.feeIn + t.feeOut).toFixed(2)}</span>
            </div>
            {t.pred?.win != null && <p className="s-note">Prediksi saat masuk: menang {t.pred.win.toFixed(0)}%{t.pred.mc != null ? ` · Monte Carlo ${t.pred.mc.toFixed(0)}%` : ""}</p>}
          </div>
        ))}
      </section>

      <p className="disc">Catatan ini hanya jurnal: aplikasi tidak membeli atau menjual apa pun. Pastikan angkanya sama dengan transaksi aslimu di Gotrade, terutama fee riil.</p>
    </div>
  );
}
