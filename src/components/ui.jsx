import { useEffect, useState } from "react";

export const Icon = ({ name }) => {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    signals: <path d="M3 12h4l2.5-7 4 14 2.5-7H21" />,
    market: (<><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>),
    chart: (<><path d="M7 3v3M7 14v4M17 6v3M17 17v3" /><rect x="5" y="6" width="4" height="8" rx="1" /><rect x="15" y="9" width="4" height="8" rx="1" /></>),
    predict: (<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>),
    watch: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8L12 3.5z" />,
    refresh: <path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" />,
    bell: <path d="M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7zM10 20a2 2 0 0 0 4 0" />,
  };
  return <svg className="ico" viewBox="0 0 24 24" width="22" height="22" {...p}>{paths[name]}</svg>;
};

export function Spark({ data, up, w = 64, h = 26 }) {
  if (!data || data.length < 2) return <span className="spark" style={{ width: w }} />;
  const min = Math.min(...data), max = Math.max(...data), rng = max - min || 1;
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - 3 - ((v - min) / rng) * (h - 6)).toFixed(1)}`).join(" ");
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline points={pts} fill="none" stroke={up ? "var(--up)" : "var(--down)"} strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Notice({ title, text, action, onAction }) {
  return (
    <div className="notice">
      <b>{title}</b>
      {text && <p>{text}</p>}
      {action && <button className="btn ghost" onClick={onAction}>{action}</button>}
    </div>
  );
}

// ---- Pita sesi bursa AS (09.30–16.00 ET, Senin–Jumat; hari libur tidak dihitung) ----
function usSession(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t).value;
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  let h = +get("hour"); if (h === 24) h = 0;
  const min = h * 60 + +get("minute");
  const OPEN = 570, CLOSE = 960;
  if (wd >= 1 && wd <= 5 && min >= OPEN && min < CLOSE) return { open: true, mins: CLOSE - min };
  for (let off = 0; off <= 7; off++) {
    const d = (wd + off) % 7;
    if (d >= 1 && d <= 5) { const t = off * 1440 + OPEN - min; if (t > 0) return { open: false, mins: t }; }
  }
  return { open: false, mins: 0 };
}
const dur = (m) => (m >= 1440 ? `${Math.floor(m / 1440)}h ${Math.floor((m % 1440) / 60)}j` : `${Math.floor(m / 60)}j ${String(m % 60).padStart(2, "0")}m`);

export function SessionBar() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 20_000); return () => clearInterval(id); }, []);
  const s = usSession(now);
  const wib = now.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }).replace(".", ":");
  return (
    <div className={`session ${s.open ? "open" : ""}`} title="Bursa AS: 09.30–16.00 waktu New York">
      <i className="dot" />
      <span className="st">{s.open ? "Bursa AS buka" : "Bursa AS tutup"}</span>
      <span className="cd">{s.open ? "tutup" : "buka"} dalam {dur(s.mins)}</span>
      <span className="clock">{wib} WIB</span>
    </div>
  );
}
