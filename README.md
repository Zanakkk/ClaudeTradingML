# ClaudeTradingML

Dashboard sinyal trading saham AS (React + Vite). Tren 1 jam, timing masuk 15 menit, SL/TP berbasis ATR.

## Jalankan

```bash
npm install
npm run dev
```

## Deploy (Firebase)

```bash
npm i -g firebase-tools && firebase login
# ganti project ID di .firebaserc
(cd functions && npm install)
npm run build
firebase deploy
```

Cloud Functions butuh paket Blaze (ada free tier).

## Arsitektur

- `src/` — UI React (Firebase Hosting)
- `functions/signals.js` — Cloud Function: ambil data Yahoo paralel, hitung sinyal, cache CDN 60 detik
- `functions/lib/` — indikator (EMA, ATR, Stochastic, VWAP) & logika sinyal

Tidak ada database: data selalu diambil langsung dari Yahoo dan di-cache singkat di CDN.

## Roadmap

1. Backtest baseline + biaya spread/fee
2. Filter LightGBM (label triple-barrier), skor via endpoint terpisah
3. Notifikasi Telegram
4. Pindah ke Alpaca bila produk dijual (Yahoo tidak resmi)

> Alat bantu analisa, bukan saran investasi.
