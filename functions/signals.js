import { computeSignal } from "./lib/signal.js";
import { candles } from "./yahoo.js";

// Semua ticker & timeframe diambil paralel.
export async function scanSymbols(symbols, settings) {
  return Promise.all(
    symbols.map(async (symbol) => {
      try {
        const [h1, m15] = await Promise.all([candles(symbol, "1h", "1mo"), candles(symbol, "15m", "5d")]);
        return { symbol, ...computeSignal(h1, m15, settings), updated: m15.t[m15.t.length - 1] };
      } catch (e) {
        return { symbol, action: "ERROR", error: e.message };
      }
    })
  );
}
