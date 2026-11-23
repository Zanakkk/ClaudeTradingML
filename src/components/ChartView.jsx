import { useEffect, useRef, useState, useCallback } from "react";
import { createChart, CandlestickSeries, LineSeries, HistogramSeries, ColorType, CrosshairMode } from "lightweight-charts";
import { ema, vwap, rsi, macd, bollinger, stochastic } from "../../functions/lib/indicators.js";
import { getJSON, fmt, pct } from "../lib/api.js";

const TFS = {
  "5m": { interval: "5m", range: "5d", intraday: true },
  "15m": { interval: "15m", range: "1mo", intraday: true },
  "1h": { interval: "1h", range: "3mo", intraday: true },
  "1D": { interval: "1d", range: "1y", intraday: false },
  "1W": { interval: "1wk", range: "5y", intraday: false },
};

const INDS = [
  { key: "ema20", label: "EMA 20", color: "#facc15" },
  { key: "ema50", label: "EMA 50", color: "#38bdf8" },
  { key: "ema200", label: "EMA 200", color: "#f472b6" },
  { key: "vwap", label: "VWAP", color: "#a78bfa" },
  { key: "bb", label: "Bollinger", color: "#94a3b8" },
  { key: "vol", label: "Volume", color: "#64748b" },
  { key: "rsi", label: "RSI", color: "#facc15" },
  { key: "stoch", label: "Stochastic", color: "#38bdf8" },
  { key: "macd", label: "MACD", color: "#f97316" },
];
const DEFAULT_ON = { ema20: true, ema50: true, vol: true };
const UP = "#22c55e", DOWN = "#ef4444";

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const cut = (arr, n) => arr.map((v, i) => (i < n ? null : v));

export default function ChartView({ symbol, watched, onToggleWatch }) {
  const [tfKey, setTfKey] = useState(() => localStorage.getItem("tf") || "15m");
  const [on, setOn] = useState(() => load("inds", DEFAULT_ON));
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hover, setHover] = useState(null);
  const [sig, setSig] = useState(null);
  const boxRef = useRef(null);
  const rangeRef = useRef({});

  const fetchData = useCallback(async () => {
    const tf = TFS[tfKey];
    try {
      setLoading(true);
      setData(await getJSON(`/api/chart?symbol=${encodeURIComponent(symbol)}&interval=${tf.interval}&range=${tf.range}`));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [symbol, tfKey]);

  useEffect(() => {
    setData(null);
    fetchData();
    const id = setInterval(fetchData, 60_000);
    return () => clearInterval(id);
  }, [fetchData]);

  useEffect(() => {
    setSig(null);
    getJSON(`/api/signals?symbols=${encodeURIComponent(symbol)}`).then((d) => setSig(d.results?.[0] || null)).catch(() => {});
  }, [symbol]);

  const setTf = (k) => { setTfKey(k); localStorage.setItem("tf", k); };
  const toggle = (k) => setOn((o) => { const n = { ...o, [k]: !o[k] }; localStorage.setItem("inds", JSON.stringify(n)); return n; });

  const subPanes = (on.rsi ? 1 : 0) + (on.stoch ? 1 : 0) + (on.macd ? 1 : 0);

  useEffect(() => {
    if (!data || !boxRef.current) return;
    const tf = TFS[tfKey];
    const intraday = tf.intraday;
    const chart = createChart(boxRef.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#8a9ab5", fontSize: 11, panes: { separatorColor: "#1b2742" } },
      grid: { vertLines: { color: "#111a2e" }, horzLines: { color: "#111a2e" } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#1b2742" },
      timeScale: {
        borderColor: "#1b2742",
        timeVisible: intraday,
        secondsVisible: false,
        tickMarkFormatter: (t, type) => {
          const d = new Date(t * 1000);
          if (type <= 1) return d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
          if (type === 2) return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
          return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
        },
      },
      localization: {
        timeFormatter: (t) =>
          intraday
            ? new Date(t * 1000).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
            : new Date(t * 1000).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }),
      },
    });

    const T = data.t;
    const bars = T.map((time, i) => ({ time, open: data.open[i], high: data.high[i], low: data.low[i], close: data.close[i] }));
    const candle = chart.addSeries(CandlestickSeries, {
      upColor: UP, downColor: DOWN, borderVisible: false, wickUpColor: UP, wickDownColor: DOWN,
    });
    candle.setData(bars);

    const line = (arr, color, extra = {}, pane = 0) => {
      const s = chart.addSeries(LineSeries, { color, lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, ...extra }, pane);
      s.setData(T.map((time, i) => (arr[i] == null || !isFinite(arr[i]) ? null : { time, value: arr[i] })).filter(Boolean));
      return s;
    };

    if (on.vol) {
      const v = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "vol", priceLineVisible: false, lastValueVisible: false });
      v.setData(T.map((time, i) => ({ time, value: data.volume[i], color: data.close[i] >= data.open[i] ? "rgba(34,197,94,.35)" : "rgba(239,68,68,.35)" })));
      chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      candle.priceScale().applyOptions({ scaleMargins: { top: 0.06, bottom: 0.2 } });
    }
    if (on.ema20) line(cut(ema(data.close, 20), 19), INDS[0].color);
    if (on.ema50) line(cut(ema(data.close, 50), 49), INDS[1].color);
    if (on.ema200) line(cut(ema(data.close, 200), 199), INDS[2].color);
    if (on.vwap && intraday) line(vwap(T, data.high, data.low, data.close, data.volume), INDS[3].color, { lineWidth: 1 });
    if (on.bb) {
      const b = bollinger(data.close);
      line(b.upper, "#94a3b8", { lineWidth: 1 });
      line(b.lower, "#94a3b8", { lineWidth: 1 });
      line(b.mid, "#64748b", { lineWidth: 1, lineStyle: 2 });
    }

    const guide = (s, ...prices) => prices.forEach((price) => s.createPriceLine({ price, color: "#475569", lineStyle: 2, lineWidth: 1, axisLabelVisible: false }));
    let pane = 1;
    if (on.rsi) { guide(line(rsi(data.close), "#facc15", {}, pane), 70, 30); pane++; }
    if (on.stoch) {
      const { k, d } = stochastic(data.high, data.low, data.close);
      guide(line(k, "#38bdf8", {}, pane), 80, 20);
      line(d, "#f97316", {}, pane);
      pane++;
    }
    if (on.macd) {
      const m = macd(data.close);
      const h = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, pane);
      h.setData(T.map((time, i) => ({ time, value: m.hist[i], color: m.hist[i] >= 0 ? "rgba(34,197,94,.6)" : "rgba(239,68,68,.6)" })).slice(26));
      line(m.line, "#38bdf8", {}, pane);
      line(m.signal, "#f97316", {}, pane);
    }
    chart.panes().forEach((p, i) => p.setStretchFactor?.(i === 0 ? 3 : 1));

    const key = `${symbol}|${tfKey}`;
    const n = bars.length;
    if (rangeRef.current.key === key && rangeRef.current.range) chart.timeScale().setVisibleLogicalRange(rangeRef.current.range);
    else chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - 100), to: n + 4 });

    chart.subscribeCrosshairMove((p) => setHover(p.time ? p.seriesData.get(candle) || null : null));

    return () => {
      try { rangeRef.current = { key, range: chart.timeScale().getVisibleLogicalRange() }; } catch {}
      chart.remove();
    };
  }, [data, on, tfKey, symbol]);

  const last = data && {
    open: data.open[data.open.length - 1], high: data.high[data.high.length - 1],
    low: data.low[data.low.length - 1], close: data.close[data.close.length - 1],
  };
  const bar = hover || last;
  const up = (data?.changePct ?? 0) >= 0;

  return (
    <div>
      <div className="chead">
        <div>
          <h2>{symbol} <button className={`star ${watched ? "on" : ""}`} onClick={() => onToggleWatch(symbol)}>{watched ? "★" : "☆"}</button></h2>
          <div className="muted">{data?.name || "…"}</div>
        </div>
        <div className="price">
          <b>{data ? fmt(data.price) : "–"}</b>
          <span className={up ? "pos" : "neg"}>{data ? pct(data.changePct) : ""}</span>
        </div>
      </div>

      <div className="chips">
        {Object.keys(TFS).map((k) => (
          <button key={k} className={`chip ${k === tfKey ? "active" : ""}`} onClick={() => setTf(k)}>{k}</button>
        ))}
        <button className="chip ghost" onClick={fetchData}>{loading ? "…" : "⟳"}</button>
      </div>

      <div className="chips scroll">
        {INDS.map((i) => (
          <button key={i.key} className={`chip sm ${on[i.key] ? "active" : ""}`} style={on[i.key] ? { borderColor: i.color } : null} onClick={() => toggle(i.key)}>
            <i style={{ background: i.color }} />{i.label}
          </button>
        ))}
      </div>

      {bar && (
        <div className="legend">
          <span>O {fmt(bar.open)}</span><span>H {fmt(bar.high)}</span><span>L {fmt(bar.low)}</span>
          <span className={bar.close >= bar.open ? "pos" : "neg"}>C {fmt(bar.close)}</span>
        </div>
      )}

      {error && <p className="err">Gagal memuat chart: {error}</p>}
      <div className="chartbox" style={{ height: 340 + subPanes * 130 }}>
        {!data && !error && <div className="center muted">Memuat chart…</div>}
        <div ref={boxRef} style={{ height: "100%" }} />
      </div>

      {sig && sig.action !== "ERROR" && (
        <div className={`sigbox ${sig.action}`}>
          <b>Sinyal strategi: {sig.action === "SKIP_FEE" ? "SKIP (fee)" : sig.action}</b>
          <span>Tren 1h: {sig.trend ?? "–"} · Stoch K: {fmt(sig.stochK, 1)}</span>
          {sig.sl != null && <span>SL {fmt(sig.sl)} · TP {fmt(sig.tp)} · net TP ${fmt(sig.netTp)}</span>}
        </div>
      )}
      <p className="disc">Cubit & geser untuk zoom, sentuh chart untuk melihat harga. Data Yahoo Finance (tidak resmi, bisa tertunda). Bukan saran investasi.</p>
    </div>
  );
}
