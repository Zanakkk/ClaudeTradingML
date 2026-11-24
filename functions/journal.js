// Jurnal trade per akun: satu dokumen Firestore journals/{uid} berisi semua trade milik akun itu.
// 1 read untuk membuka, 1 write per perubahan.
import crypto from "node:crypto";

const num = (v, hi = 1e9) => { v = Number(v); return Number.isFinite(v) && v > 0 && v <= hi ? v : null; };
const str = (v, n) => String(v ?? "").slice(0, n);
const SYMBOL_RE = /^[A-Za-z0-9.^=\-]{1,15}$/;

const isIdx = (sym) => /\.JK$/i.test(sym || "");

// Semua angka uang pada satu trade memakai mata uang trade itu (USD untuk saham AS, IDR untuk saham IDX).
export async function journalOp(db, uid, body, feeUsd, feeIdx) {
  const fee = feeUsd;
  const sideOf = (cur) => { const f = cur === "IDR" ? feeIdx : feeUsd; return (amt) => Math.max(f.min, (amt * f.pct) / 100) + f.fixed; };
  const ref = db.doc(`journals/${uid}`);
  const op = body.op;

  if (op === "list") {
    const s = await ref.get();
    return { trades: s.exists ? s.data().trades || [] : [], fee, feeIdx };
  }

  const trades = await db.runTransaction(async (t) => {
    const s = await t.get(ref);
    let list = s.exists ? s.data().trades || [] : [];

    if (op === "open") {
      const symbol = str(body.symbol, 15).toUpperCase();
      const cur = isIdx(symbol) ? "IDR" : "USD";
      const usd = num(body.usd, cur === "IDR" ? 1e12 : 1e6), price = num(body.price, 1e9);
      if (!SYMBOL_RE.test(symbol) || !usd || !price) throw new Error("bad_input");
      if (list.length >= 1500) throw new Error("full");
      const p = body.pred || {};
      const clean = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) / 100 : null);
      list = [{
        id: crypto.randomUUID(), symbol, name: str(body.name, 60), status: "open", cur,
        usd, entryPrice: price, shares: usd / price, feeIn: sideOf(cur)(usd),
        sl: num(body.sl), tp: num(body.tp), note: str(body.note, 200),
        openedAt: Date.now(),
        pred: { win: clean(p.win), mc: clean(p.mc), score: clean(p.score), strong: p.strong ? 1 : 0 },
      }, ...list];
    } else if (op === "close") {
      const tr = list.find((x) => x.id === body.id && x.status === "open");
      const exit = num(body.exitPrice, 1e9);
      if (!tr || !exit) throw new Error("bad_input");
      const feeOut = sideOf(tr.cur || "USD")(tr.shares * exit);
      const pnl = tr.shares * (exit - tr.entryPrice) - tr.feeIn - feeOut;
      Object.assign(tr, { status: "closed", exitPrice: exit, feeOut, pnl, pnlPct: (pnl / tr.usd) * 100, closedAt: Date.now() });
    } else if (op === "edit") {
      const tr = list.find((x) => x.id === body.id);
      if (!tr) throw new Error("bad_input");
      if ("sl" in body) tr.sl = num(body.sl);
      if ("tp" in body) tr.tp = num(body.tp);
      if ("note" in body) tr.note = str(body.note, 200);
    } else if (op === "delete") {
      list = list.filter((x) => x.id !== body.id);
    } else throw new Error("bad_input");

    t.set(ref, { trades: list, updatedAt: Date.now() });
    return list;
  });
  return { trades, fee, feeIdx };
}
