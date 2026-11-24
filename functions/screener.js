import { candles } from "./yahoo.js";
import { analyze } from "./lib/screen.js";

async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    })
  );
  return out;
}

export async function runScreener(symbols, settings, name = {}) {
  const res = await pool(symbols, 8, async (symbol) => {
    try {
      const [h1, d1] = await Promise.all([candles(symbol, "1h", "2y"), candles(symbol, "1d", "6mo")]);
      const r = analyze(symbol, h1, d1, settings);
      r.name = h1.meta.shortName || h1.meta.longName || name[symbol] || "";
      return r;
    } catch (e) {
      return { symbol, status: /404|no data|not found/i.test(e.message) ? "no_data" : "error" };
    }
  });
  const ok = res.filter((r) => r.status === "ok").sort((a, b) => b.score - a.score);
  const skipped = res.filter((r) => r.status !== "ok").map((r) => r.symbol);
  return { v: 5, generatedAt: Date.now(), results: ok, skipped };
}
