import { useEffect, useRef, useState, useCallback } from "react";
import { createChart, CandlestickSeries, LineSeries, HistogramSeries, ColorType, CrosshairMode } from "lightweight-charts";
import { ema, vwap, rsi, macd, bollinger, stochastic } from "../../functions/lib/indicators.js";
import { getJSON, fmt, pct, errText } from "../lib/api.js";
import { Icon, Notice } from "./ui.jsx";

const TFS = {
  "5m": { interval: "5m", range: "5d", intraday: true },
  "15m": { interval: "15m", range: "1mo", intraday: true },
  "1h": { interval: "1h", range: "3mo", intraday: true },
  "1D": { interval: "1d", range: "1y", intraday: false },
  "1W": { interval: "1wk", range: "5y", intraday: false },
};

const INDS = [
  { key: "ema20", label: "EMA 20", color: "#F2B84B" },
  { key: "ema50", label: "EMA 50", color: "#6EA8FF" },
  { key: "ema200", label: "EMA 200", color: "#C792EA" },
  { key: "vwap", label: "VWAP", color: "#5CE1E6" },
  { key: "bb", label: "Bollinger", color: "#8FA6B0" },
  { key: "vol", label: "Volume", color: "#6B8794" },
  { key: "rsi", label: "RSI", color: "#F2B84B" },
  { key: "stoch", label: "Stochastic", color: "#6EA8FF" },
  { key: "macd", label: "MACD", color: "#FF9F6B" },
];
const DEFAULT_ON = { ema20: true, ema50: true, vol: true };
const UP = "#4FD6A5", DOWN = "#FF7A7A";

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
      setError(e);
      if (e.kind === "notfound") setData(null);
    } finally {
      setLoading(false);
    }
  }, [symbol, tfKey]);

  useEffect(() => {
    setData(null); setError(null);
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
    const intraday = TFS[tfKey].intraday;
    const chart = createChart(boxRef.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#7F9AA5", fontSize: 11, fontFamily: "IBM Plex Mono, ui-monospace, monospace", panes: { separatorColor: "#1B3A48" } },
      grid: { vertLines: { color: "#102833" }, horzLines: { color: "#102833" } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#1B3A48" },
      timeScale: {
        borderColor: "#1B3A48", timeVisible: intraday, secondsVisible: false,
        tickMarkFormatter: (t, type) => {
          const d = new Date(t * 1000);
          if (type <= 1) return d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
          if (type === 2) return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
          return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
        },
      },
      localization: {
        timeFormatter: (t) => intraday
          ? new Date(t * 1000).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
          : new Date(t * 1000).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }),
      },
    });

    const T = data.t;
    const bars = T.map((time, i) => ({ time, open: data.open[i], high: data.high[i], low: data.low[i], close: data.close[i] }));
    const candle = chart.addSeries(CandlestickSeries, { upColor: UP, downColor: DOWN, borderVisible: false, wickUpColor: UP, wickDownColor: DOWN });
    candle.setData(bars);

    const line = (arr, color, extra = {}, pane = 0) => {
      const s = chart.addSeries(LineSeries, { color, lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, ...extra }, pane);
      s.setData(T.map((time, i) => (arr[i] == null || !isFinite(arr[i]) ? null : { time, value: arr[i] })).filter(Boolean));
      return s;
    };

    if (on.vol) {
      const v = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "vol", priceLineVisible: false, lastValueVisible: false });
      v.setData(T.map((time, i) => ({ time, value: data.volume[i], color: data.close[i] >= data.open[i] ? "rgba(79,214,165,.30)" : "rgba(255,122,122,.30)" })));
      chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      candle.priceScale().applyOptions({ scaleMargins: { top: 0.06, bottom: 0.2 } });
    }
    if (on.ema20) line(cut(ema(data.close, 20), 19), INDS[0].color);
    if (on.ema50) line(cut(ema(data.close, 50), 49), INDS[1].color);
    if (on.ema200) line(cut(ema(data.close, 200), 199), INDS[2].color);
    if (on.vwap && intraday) line(vwap(T, data.high, data.low, data.close, data.volume), INDS[3].color, { lineWidth: 1 });
    if (on.bb) {
      const b = bollinger(data.close);
      line(b.upper, "#8FA6B0", { lineWidth: 1 });
      line(b.lower, "#8FA6B0", { lineWidth: 1 });
      line(b.mid, "#6B8794", { lineWidth: 1, lineStyle: 2 });
    }

    const guide = (s, ...prices) => prices.forEach((price) => s.createPriceLine({ price, color: "#3A5B69", lineStyle: 2, lineWidth: 1, axisLabelVisible: false }));
    let pane = 1;
    if (on.rsi) { guide(line(rsi(data.close), "#F2B84B", {}, pane), 70, 30); pane++; }
    if (on.stoch) {
      const { k, d } = stochastic(data.high, data.low, data.close);
      guide(line(k, "#6EA8FF", {}, pane), 80, 20);
      line(d, "#FF9F6B", {}, pane);
      pane++;
    }
    if (on.macd) {
      const m = macd(data.close);
      const h = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, pane);
      h.setData(T.map((time, i) => ({ time, value: m.hist[i], color: m.hist[i] >= 0 ? "rgba(79,214,165,.6)" : "rgba(255,122,122,.6)" })).slice(26));
      line(m.line, "#6EA8FF", {}, pane);
      line(m.signal, "#FF9F6B", {}, pane);
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

  if (error?.kind === "notfound")
    return (
      <Notice
        title={`Tidak ada data untuk “${symbol}”`}
        text="Periksa kode tickernya. Saham Indonesia memakai akhiran .JK (misalnya BBCA.JK), crypto memakai -USD (BTC-USD). Gunakan kolom cari di atas untuk menemukan kode yang tepat."
      />
    );

  const last = data && { open: data.open.at(-1), high: data.high.at(-1), low: data.low.at(-1), close: data.close.at(-1) };
  const bar = hover || last;
  const up = (data?.changePct ?? 0) >= 0;

  return (
    <div className="stack">
      <div className="chead">
        <div>
          <div className="eyebrow">{data?.currency || "USD"}</div>
          <h1 className="sym-lg">{symbol}<button className={`star ${watched ? "on" : ""}`} aria-label="Watchlist" onClick={() => onToggleWatch(symbol)}>{watched ? "★" : "☆"}</button></h1>
          <div className="muted">{data?.name || " "}</div>
        </div>
        <div className="bigprice">
          <b>{data ? fmt(data.price) : "–"}</b>
          <span className={`pill ${up ? "pos" : "neg"}`}>{data ? pct(data.changePct) : "–"}</span>
        </div>
      </div>

      <div className="seg">
        {Object.keys(TFS).map((k) => <button key={k} className={k === tfKey ? "active" : ""} onClick={() => setTf(k)}>{k}</button>)}
        <button className="refresh" aria-label="Muat ulang" onClick={fetchData}><Icon name="refresh" /></button>
      </div>

      <div className="chips">
        {INDS.map((i) => (
          <button key={i.key} className={`chip ${on[i.key] ? "active" : ""}`} onClick={() => toggle(i.key)}>
            <i style={{ background: i.color }} />{i.label}
          </button>
        ))}
      </div>

      {bar && (
        <div className="legend mono">
          <span>O {fmt(bar.open)}</span><span>H {fmt(bar.high)}</span><span>L {fmt(bar.low)}</span>
          <span className={bar.close >= bar.open ? "pos" : "neg"}>C {fmt(bar.close)}</span>
        </div>
      )}

      {error && data && <p className="muted">{errText(error)} Menampilkan data terakhir.</p>}
      {error && !data && <Notice title="Chart belum bisa dimuat" text={errText(error)} action="Coba lagi" onAction={fetchData} />}
      {!error || data ? (
        <div className="chartbox" style={{ height: 340 + subPanes * 130 }}>
          {!data && <div className="skeleton fill" />}
          <div ref={boxRef} style={{ height: "100%" }} />
        </div>
      ) : null}

      {sig && sig.action && sig.action !== "ERROR" && sig.action !== "NO_DATA" && (
        <div className={`sigbox ${sig.action}`}>
          <b>{sig.action === "BUY" ? "Sinyal beli aktif" : sig.action === "SKIP_FEE" ? "Sinyal teknikal ada, tapi fee terlalu besar" : "Belum ada sinyal beli"}</b>
          <span>Tren 1 jam {sig.trend === "UP" ? "naik" : "belum naik"} · Stochastic {fmt(sig.stochK, 0)}</span>
          {sig.sl != null && <span className="mono">SL {fmt(sig.sl)} · TP {fmt(sig.tp)} · net TP ${fmt(sig.netTp)}</span>}
        </div>
      )}
      <p className="disc">Cubit dan geser untuk zoom. Sentuh chart untuk melihat harga tiap candle. Data Yahoo Finance, bisa tertunda. Bukan saran investasi.</p>
    </div>
  );
}
