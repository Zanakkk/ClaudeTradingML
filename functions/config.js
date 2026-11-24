// Pengaturan default. Bisa ditimpa tanpa deploy ulang dengan mengedit dokumen
// Firestore `config/settings` (field yang sama) lewat Firebase Console.
export const DEFAULTS = {
  symbols: ["SPY", "QQQ", "NVDA", "AAPL", "MSFT", "TSLA", "AMD", "AMZN", "META", "GOOGL"],
  capitalUsd: 100,        // modal
  riskPct: 1,             // risiko maksimal per trade (% modal)
  feePctPerSide: 0.3,     // Gotrade reguler 0.3%, Prestige 0.2% (cek di app) — berlaku beli DAN jual
  feePctPrestige: 0.2,    // tarif Prestige
  minFeeUsd: 0.1,         // minimum fee per transaksi
  fixedFeeUsd: 0.02,      // biaya tetap kecil per transaksi (JFX, dll)
  slAtr: 1,               // stop loss = 1x ATR
  tpAtr: 1.5,             // take profit = 1.5x ATR
  minDollarVol: 300000,   // screener: abaikan saham dengan nilai transaksi harian rata-rata < $300 ribu
  maxPriceUsd: 10,        // screener: batas harga
  minRewardToFee: 3,      // sinyal dilewati kalau profit kotor TP < 3x total fee
  contactUrl: "https://claudetradingml.web.app",
};
