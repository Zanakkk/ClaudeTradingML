import { useState, useCallback, useEffect } from "react";
import SearchBar from "./components/SearchBar.jsx";
import SignalsView from "./components/SignalsView.jsx";
import MarketView from "./components/MarketView.jsx";
import ChartView from "./components/ChartView.jsx";
import PredictView from "./components/PredictView.jsx";
import ScreenerView from "./components/ScreenerView.jsx";
import WatchlistView from "./components/WatchlistView.jsx";
import PortfolioView from "./components/PortfolioView.jsx";
import AccountView from "./components/AccountView.jsx";
import RecordSheet from "./components/RecordSheet.jsx";
import AuthScreen from "./components/AuthScreen.jsx";
import Onboarding from "./components/Onboarding.jsx";
import { Icon, SessionBar } from "./components/ui.jsx";
import { useAuth } from "./lib/firebase.js";
import { authed, getJSON } from "./lib/api.js";
import { setMoney } from "./lib/money.js";

const TABS = [
  ["signals", "signals", "Sinyal"],
  ["screener", "screener", "Screener"],
  ["chart", "chart", "Chart"],
  ["market", "market", "Pasar"],
  ["portfolio", "journal", "Jurnal"],
];
const DEFAULT_PROFILE = { name: "", capital: 100, feeTier: "regular", risk: 5, currency: "USD", rateManual: null };
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

export default function App() {
  const [tab, setTab] = useState("screener");
  const [cmode, setCmode] = useState("chart"); // di tab Chart: grafik | prediksi
  const [jmode, setJmode] = useState("portfolio"); // di tab Jurnal: portofolio | akun
  const [symbol, setSymbol] = useState(() => localStorage.getItem("symbol") || "SPY");
  const [watch, setWatch] = useState(() => load("watch", ["SPY", "QQQ", "NVDA"]));

  useEffect(() => { document.documentElement.style.zoom = localStorage.getItem("zoom") || "1"; }, []);
  const [fxAuto, setFxAuto] = useState(() => +localStorage.getItem("fxAuto") || 16000);
  useEffect(() => {
    getJSON("/api/quotes?symbols=IDR=X").then((d) => { const p = d.results?.[0]?.price; if (p > 1000 && p < 100000) { setFxAuto(p); localStorage.setItem("fxAuto", String(p)); } }).catch(() => {});
  }, []);
  const auth = useAuth();
  const user = auth.user;
  const [profile, setProfile] = useState(() => ({ ...DEFAULT_PROFILE, ...load("profile", {}) }));
  const [onboard, setOnboard] = useState(() => !localStorage.getItem("onboarded"));
  const [authMode, setAuthMode] = useState(null); // null | "signup" | "login"
  const [record, setRecord] = useState(null);
  const [toast, setToast] = useState("");
  const [bump, setBump] = useState(0);
  setMoney(profile.currency, profile.rateManual || fxAuto); // sebelum anak-anak dirender
  const feePct = profile.feeTier === "prestige" ? 0.2 : 0.3;

  // Muat profil dari akun saat masuk
  useEffect(() => {
    if (!user) return;
    authed("/api/profile", { op: "get" }).then((d) => {
      if (d.profile) { const n = { ...DEFAULT_PROFILE, ...d.profile }; setProfile(n); localStorage.setItem("profile", JSON.stringify(n)); if (d.profile.onboarded) localStorage.setItem("onboarded", "1"); setOnboard((o) => (d.profile.onboarded ? false : o)); }
    }).catch(() => {});
  }, [user?.uid]);

  const saveProfile = useCallback(async (p) => {
    const n = { ...DEFAULT_PROFILE, ...p };
    setProfile(n); localStorage.setItem("profile", JSON.stringify(n));
    if (user) await authed("/api/profile", { op: "set", profile: n });
  }, [user]);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };
  const askRecord = (item) => { if (!user) { setAuthMode("signup"); return; } setRecord(item); };

  const open = useCallback((s) => { setSymbol(s); localStorage.setItem("symbol", s); setTab("chart"); window.scrollTo(0, 0); }, []);
  const toggleWatch = useCallback((s) => setWatch((w) => {
    const n = w.includes(s) ? w.filter((x) => x !== s) : [...w, s];
    localStorage.setItem("watch", JSON.stringify(n));
    return n;
  }), []);

  const go = (s) => { setSymbol(s); localStorage.setItem("symbol", s); setTab("chart"); window.scrollTo(0, 0); };

  return (
    <div className="app">
      <header>
        <div className="top">
          <div className="brand">Trading<span>ML</span></div>
          <SessionBar />
          <button className="avatar" aria-label="Akun" onClick={() => { setJmode("account"); setTab("portfolio"); window.scrollTo(0, 0); }}>{user ? (profile.name || user.name || user.email || "?").trim().slice(0, 1).toUpperCase() : <Icon name="user" />}</button>
        </div>
        <SearchBar onPick={open} />
      </header>
      <main>
        {tab === "signals" && <SignalsView onOpen={(s) => { setSymbol(s); localStorage.setItem("symbol", s); setTab("chart"); window.scrollTo(0, 0); }} />}
        {tab === "screener" && <ScreenerView onOpen={go} onRecord={askRecord} profile={profile} feePct={feePct} />}
        {tab === "market" && watch.length > 0 && <div style={{ marginBottom: 12 }}><WatchlistView watch={watch} onOpen={go} onToggleWatch={toggleWatch} /></div>}
        {tab === "market" && <MarketView onOpen={(s) => { setSymbol(s); localStorage.setItem("symbol", s); setTab("chart"); window.scrollTo(0, 0); }} watch={watch} onToggleWatch={toggleWatch} />}
        {tab === "chart" && (
          <div className="seg sub"><button className={cmode === "chart" ? "active" : ""} onClick={() => setCmode("chart")}>Grafik</button><button className={cmode === "predict" ? "active" : ""} onClick={() => setCmode("predict")}>Prediksi &amp; beli</button></div>
        )}
        {tab === "chart" && cmode === "chart" && <ChartView key={symbol} symbol={symbol} watched={watch.includes(symbol)} onToggleWatch={toggleWatch} />}
        {tab === "chart" && cmode === "predict" && <PredictView key={symbol} symbol={symbol} onRecord={askRecord} />}
        {tab === "portfolio" && (
          <div className="seg sub"><button className={jmode === "portfolio" ? "active" : ""} onClick={() => setJmode("portfolio")}>Portofolio</button><button className={jmode === "account" ? "active" : ""} onClick={() => setJmode("account")}>Akun &amp; pengaturan</button></div>
        )}
        {tab === "portfolio" && jmode === "portfolio" && <PortfolioView key={bump} user={user} onLogin={setAuthMode} onOpen={go} />}
        {tab === "portfolio" && jmode === "account" && <AccountView fxAuto={fxAuto} user={user} profile={profile} saveProfile={saveProfile} onLogin={setAuthMode} onReplayIntro={() => setOnboard(true)} />}
      </main>
      <nav>
        {TABS.map(([k, icon, label]) => (
          <button key={k} className={tab === k ? "active" : ""} onClick={() => { setTab(k); if (k === "portfolio") setJmode("portfolio"); window.scrollTo(0, 0); }}>
            <Icon name={icon} /><span>{label}</span>
          </button>
        ))}
      </nav>
      {record && <RecordSheet item={record} feePct={feePct} onClose={() => setRecord(null)} onSaved={() => { setRecord(null); setBump((b) => b + 1); flash("Tercatat di Jurnal"); }} />}
      {authMode && <AuthScreen initial={authMode} onClose={() => setAuthMode(null)} onGuest={() => setAuthMode(null)} />}
      {onboard && (
        <Onboarding profile={profile} onSave={saveProfile} onFinish={(want) => { localStorage.setItem("onboarded", "1"); setOnboard(false); if (want && !user) setAuthMode("signup"); }} />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
