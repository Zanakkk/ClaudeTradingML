import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import webpush from "web-push";
import crypto from "node:crypto";
import { scanSymbols } from "./signals.js";
import { candles, search, quotes } from "./yahoo.js";
import { predict } from "./lib/predict.js";
import { runScreener } from "./screener.js";
import { UNIVERSE } from "./universe.js";
import { DEFAULTS } from "./config.js";

initializeApp();
const REGION = "us-central1";
const db = () => getFirestore();

// Pengaturan = default + override dari Firestore (config/settings), 1 read.
async function getSettings() {
  const snap = await db().doc("config/settings").get();
  return { ...DEFAULTS, ...(snap.exists ? snap.data() : {}) };
}

// Kunci VAPID dibuat otomatis sekali, disimpan di Firestore (tidak bisa dibaca klien).
async function initPush(settings) {
  const ref = db().doc("config/vapid");
  let v = (await ref.get()).data();
  if (!v) {
    v = webpush.generateVAPIDKeys();
    await ref.set(v);
  }
  webpush.setVapidDetails(settings.contactUrl, v.publicKey, v.privateKey);
  return v;
}

const feeInfo = (s) => ({ pct: s.feePctPerSide, min: s.minFeeUsd, fixed: s.fixedFeeUsd, capital: s.capitalUsd });
const json = (res, code, body, cache) => {
  if (cache) res.set("Cache-Control", cache);
  res.status(code).json(body);
};

const SYMBOL_RE = /^[A-Za-z0-9.^=\-]{1,15}$/;
const INTERVALS = ["1m", "5m", "15m", "1h", "1d", "1wk"];
const RANGES = ["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "max"];
const PREDICT_TF = {
  "15m": { interval: "15m", range: "1mo", horizon: 8, label: "2 jam" },
  "1h": { interval: "1h", range: "6mo", horizon: 8, label: "8 jam" },
  "1d": { interval: "1d", range: "5y", horizon: 5, label: "5 hari" },
};
const parseSymbols = (q, max) =>
  String(q || "").split(",").map((x) => x.trim().toUpperCase()).filter((x) => SYMBOL_RE.test(x)).slice(0, max);

// Satu function untuk semua endpoint /api/*
export const api = onRequest(
  { region: REGION, memory: "512MiB", timeoutSeconds: 60, invoker: "public" },
  async (req, res) => {
    try {
      if (req.path === "/api/vapid") {
        const v = await initPush(await getSettings());
        return json(res, 200, { publicKey: v.publicKey }, "public, max-age=3600");
      }

      if (req.path === "/api/subscribe" && req.method === "POST") {
        const sub = req.body;
        if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return json(res, 400, { error: "bad subscription" });
        const id = crypto.createHash("sha256").update(sub.endpoint).digest("hex").slice(0, 40);
        await db().doc(`subs/${id}`).set({ sub: { endpoint: sub.endpoint, keys: sub.keys }, createdAt: Date.now() });
        return json(res, 200, { ok: true });
      }

      if (req.path === "/api/signals") {
        const settings = await getSettings();
        const symbols = req.query.symbols ? parseSymbols(req.query.symbols, 20) : settings.symbols;
        const results = await scanSymbols(symbols, settings);
        const { symbols: _s, contactUrl: _c, ...pub } = settings;
        return json(res, 200, { generatedAt: Date.now(), settings: pub, results }, "public, max-age=30, s-maxage=60, stale-while-revalidate=120");
      }

      if (req.path === "/api/chart") {
        const [symbol] = parseSymbols(req.query.symbol, 1);
        const interval = INTERVALS.includes(req.query.interval) ? req.query.interval : "15m";
        const range = RANGES.includes(req.query.range) ? req.query.range : "1mo";
        if (!symbol) return json(res, 400, { error: "symbol required" });
        const [c, [q]] = await Promise.all([candles(symbol, interval, range), quotes([symbol])]);
        const intraday = !["1d", "1wk"].includes(interval);
        return json(
          res, 200,
          {
            symbol, name: q?.name || c.meta.shortName || "", currency: c.meta.currency,
            price: q?.price ?? c.close[c.close.length - 1], prev: q?.prev ?? null, changePct: q?.changePct ?? null,
            interval, range, t: c.t, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume,
          },
          intraday ? "public, max-age=15, s-maxage=30" : "public, max-age=60, s-maxage=120"
        );
      }

      if (req.path === "/api/search") {
        const q = String(req.query.q || "").trim().slice(0, 40);
        if (!q) return json(res, 200, { results: [] });
        return json(res, 200, { results: await search(q) }, "public, max-age=300, s-maxage=600");
      }

      if (req.path === "/api/quotes") {
        const symbols = parseSymbols(req.query.symbols, 60);
        return json(res, 200, { results: await quotes(symbols) }, "public, max-age=20, s-maxage=45, stale-while-revalidate=90");
      }

      if (req.path === "/api/predict") {
        const [symbol] = parseSymbols(req.query.symbol, 1);
        if (!symbol) return json(res, 400, { error: "symbol required" });
        const cfg = PREDICT_TF[req.query.tf] || PREDICT_TF["1h"];
        const [c, settings] = await Promise.all([candles(symbol, cfg.interval, cfg.range), getSettings()]);
        const out = predict(c, settings, cfg.horizon);
        if (out.error) return json(res, 200, { symbol, error: out.error }, "public, max-age=60");
        return json(
          res, 200,
          {
            symbol, name: c.meta.shortName || "", currency: c.meta.currency, tf: req.query.tf in PREDICT_TF ? req.query.tf : "1h",
            horizonLabel: cfg.label, interval: cfg.interval, ...out,
            history: { t: c.t.slice(-60), close: c.close.slice(-60) },
          },
          "public, max-age=30, s-maxage=60"
        );
      }

      if (req.path === "/api/screener") {
        const settings = await getSettings();
        const custom = req.query.symbols ? parseSymbols(req.query.symbols, 120) : null;
        if (custom) {
          // daftar kustom: hitung langsung, tanpa cache
          const out = await runScreener(custom, settings);
          return json(res, 200, { ...out, custom: true, maxPriceUsd: settings.maxPriceUsd, fee: feeInfo(settings) }, "public, max-age=60");
        }
        const ref = db().doc("screener/latest");
        const snap = await ref.get();
        const fresh = snap.exists && snap.data().v === 3 && Date.now() - snap.data().generatedAt < 20 * 60 * 1000;
        if (fresh && !req.query.refresh) return json(res, 200, { ...snap.data(), maxPriceUsd: settings.maxPriceUsd, fee: feeInfo(settings) }, "public, max-age=60");
        const out = await runScreener(UNIVERSE, settings);
        await ref.set(out);
        return json(res, 200, { ...out, maxPriceUsd: settings.maxPriceUsd, fee: feeInfo(settings) }, "public, max-age=60");
      }

      return json(res, 404, { error: "not_found" });
    } catch (e) {
      console.error(e);
      if (/404|no data|not found/i.test(e.message || "")) return json(res, 404, { error: "not_found" }, "public, max-age=60");
      return json(res, 502, { error: "unavailable" }, "no-store");
    }
  }
);

// Cek sinyal tiap 15 menit hanya di jam bursa AS (Senin–Jumat), kirim push untuk BUY baru.
export const scan = onSchedule(
  { schedule: "*/15 9-15 * * 1-5", timeZone: "America/New_York", region: REGION, memory: "256MiB", timeoutSeconds: 120 },
  async () => {
    const settings = await getSettings();
    const results = await scanSymbols(settings.symbols, settings);
    const buys = results.filter((r) => r.action === "BUY");
    if (!buys.length) return;

    // satu notifikasi per ticker per hari
    const day = new Date().toISOString().slice(0, 10);
    const stRef = db().doc("state/notified");
    const st = (await stRef.get()).data() || {};
    const done = st.day === day ? st.symbols || [] : [];
    const fresh = buys.filter((b) => !done.includes(b.symbol));
    if (!fresh.length) return;
    await stRef.set({ day, symbols: [...done, ...fresh.map((f) => f.symbol)] });

    await initPush(settings);
    const subs = await db().collection("subs").get();
    await Promise.all(
      fresh.flatMap((b) => {
        const payload = JSON.stringify({
          title: `BUY ${b.symbol} @ ${b.price.toFixed(2)}`,
          body: `SL ${b.sl.toFixed(2)} · TP ${b.tp.toFixed(2)} · posisi $${b.positionUsd.toFixed(0)} · net TP $${b.netTp.toFixed(2)}`,
          tag: b.symbol,
        });
        return subs.docs.map(async (d) => {
          try {
            await webpush.sendNotification(d.data().sub, payload);
          } catch (e) {
            if (e.statusCode === 404 || e.statusCode === 410) await d.ref.delete();
          }
        });
      })
    );
  }
);

// Screener dihitung ulang tiap 30 menit selama jam bursa, supaya halaman terbuka cepat.
export const screen = onSchedule(
  { schedule: "*/30 9-16 * * 1-5", timeZone: "America/New_York", region: REGION, memory: "512MiB", timeoutSeconds: 180 },
  async () => {
    const out = await runScreener(UNIVERSE, await getSettings());
    await db().doc("screener/latest").set(out);

    // Arsip harian: 1 dokumen kecil per hari, ditulis hanya pada run setelah bursa tutup (jam 16 NY).
    const ny = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
    if (ny.getHours() >= 16) {
      const day = `${ny.getFullYear()}-${String(ny.getMonth() + 1).padStart(2, "0")}-${String(ny.getDate()).padStart(2, "0")}`;
      const rows = out.results.map((r) => ({
        s: r.symbol, p: r.price, sc: r.score, v: r.verdict, st: r.strong ? 1 : 0, w: +r.bt.winShr.toFixed(3),
        n: r.bt.trades, net: +r.netTpPct.toFixed(2), setup: r.setupNow ? 1 : 0, mc: r.mc?.pProfit ?? null,
      }));
      await db().doc(`screener_daily/${day}`).set({ day, savedAt: Date.now(), count: rows.length, rows });
      // simpan 90 hari: hapus yang lebih lama (maks 5 dokumen per run)
      const cutoff = new Date(ny.getTime() - 90 * 864e5).toISOString().slice(0, 10);
      const old = await db().collection("screener_daily").where("day", "<", cutoff).limit(5).get();
      await Promise.all(old.docs.map((d) => d.ref.delete()));
    }
  }
);
