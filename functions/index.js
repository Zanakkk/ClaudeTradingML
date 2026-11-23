import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import webpush from "web-push";
import crypto from "node:crypto";
import { scanSymbols } from "./signals.js";
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

const json = (res, code, body, cache) => {
  if (cache) res.set("Cache-Control", cache);
  res.status(code).json(body);
};

// Satu function untuk semua endpoint /api/*
export const api = onRequest(
  { region: REGION, memory: "256MiB", timeoutSeconds: 30, invoker: "public" },
  async (req, res) => {
    const settings = await getSettings();

    if (req.path === "/api/vapid") {
      const v = await initPush(settings);
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
      const q = req.query.symbols;
      const symbols = q ? String(q).split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 20) : settings.symbols;
      const results = await scanSymbols(symbols, settings);
      const { symbols: _s, contactUrl: _c, ...pub } = settings;
      return json(res, 200, { generatedAt: Date.now(), settings: pub, results }, "public, max-age=30, s-maxage=60, stale-while-revalidate=120");
    }

    return json(res, 404, { error: "not found" });
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
