import { useState, useCallback } from "react";
import SearchBar from "./components/SearchBar.jsx";
import SignalsView from "./components/SignalsView.jsx";
import MarketView from "./components/MarketView.jsx";
import ChartView from "./components/ChartView.jsx";
import PredictView from "./components/PredictView.jsx";
import WatchlistView from "./components/WatchlistView.jsx";
import { Icon, SessionBar } from "./components/ui.jsx";

const TABS = [
  ["signals", "signals", "Sinyal"],
  ["market", "market", "Pasar"],
  ["chart", "chart", "Chart"],
  ["predict", "predict", "Prediksi"],
  ["watch", "watch", "Watchlist"],
];
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

export default function App() {
  const [tab, setTab] = useState("chart");
  const [symbol, setSymbol] = useState(() => localStorage.getItem("symbol") || "SPY");
  const [watch, setWatch] = useState(() => load("watch", ["SPY", "QQQ", "NVDA"]));

  const open = useCallback((s) => { setSymbol(s); localStorage.setItem("symbol", s); setTab((t) => (t === "predict" ? "predict" : "chart")); window.scrollTo(0, 0); }, []);
  const toggleWatch = useCallback((s) => setWatch((w) => {
    const n = w.includes(s) ? w.filter((x) => x !== s) : [...w, s];
    localStorage.setItem("watch", JSON.stringify(n));
    return n;
  }), []);

  return (
    <div className="app">
      <header>
        <div className="top">
          <div className="brand">Trading<span>ML</span></div>
          <SessionBar />
        </div>
        <SearchBar onPick={open} />
      </header>
      <main>
        {tab === "signals" && <SignalsView onOpen={(s) => { setSymbol(s); localStorage.setItem("symbol", s); setTab("chart"); window.scrollTo(0, 0); }} />}
        {tab === "market" && <MarketView onOpen={(s) => { setSymbol(s); localStorage.setItem("symbol", s); setTab("chart"); window.scrollTo(0, 0); }} watch={watch} onToggleWatch={toggleWatch} />}
        {tab === "chart" && <ChartView key={symbol} symbol={symbol} watched={watch.includes(symbol)} onToggleWatch={toggleWatch} />}
        {tab === "predict" && <PredictView key={symbol} symbol={symbol} />}
        {tab === "watch" && <WatchlistView watch={watch} onOpen={(s) => { setSymbol(s); localStorage.setItem("symbol", s); setTab("chart"); window.scrollTo(0, 0); }} onToggleWatch={toggleWatch} />}
      </main>
      <nav>
        {TABS.map(([k, icon, label]) => (
          <button key={k} className={tab === k ? "active" : ""} onClick={() => { setTab(k); window.scrollTo(0, 0); }}>
            <Icon name={icon} /><span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
