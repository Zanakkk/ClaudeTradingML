// Daftar saham di bawah ~$10 yang tampil di Gotrade (dari 11 screenshot).
// Daftar ini bisa diganti dari aplikasi (tab Screener → Daftar saya).
export const UNDER10 = [
  "SBSW","SNAP","SFIX","TASK","TCPC","TDOC","TME","HNST",
  "ABCL","ACP","ADT","AEG","AGNC","API","BIRD","AMC",
  "BB","BMBL","AI","CGC","PRTS","COUR","CRON","XRAY",
  "TDUP","TLRY","TRIP","UAA","UPWK","VALE","SPCE","WB",
  "PTON","PLBY","PLUG","PSEC","QS","QVCGA","RENT",
  "NIO","NOK","NMR","NVAX","OTLY","OPEN","ONL","PAYO",
  "WEN","WU","WIT","XPEV",
  "EH","EXFY","FLNA","FVRR","FMC","FUBO","FCEL","FNKO",
  "JMIA","KLTR","DNUT","LCID","LUMN","NNDM","NRDS","NEGG",
  "ANGI","AIV","ARKO","ASAN","ATER","ACB","BYND","BNGO",
  "GT","GPRO","GRAB","ICL","INO","PGX","IQ","JBLU",
];

// Saham lain di Gotrade (harga di atas $10), dari screenshot kedua.
export const LARGER = [
  "SHOP","SPOT","SBUX","TSLA","V","ZM","RIVN","HOOD","SE","NFLX","NKE","NVDA","PYPL","PFE","PG",
  "T","BIDU","BAC","BRK-B","C","KO","COIN","DIS","EBAY","XOM","F","GME","GOOG",
  "INTC","JNJ","JPM","MA","MCD","META","MSFT","MRNA","MRVL","HPE","LYB","MSI","LIN",
  "ADBE","AMD","ABNB","BABA","AMZN","AAPL","DELL","UMC","MU","DOCN","ASX",
];
export const UNIVERSE = [...new Set([...UNDER10, ...LARGER])];
