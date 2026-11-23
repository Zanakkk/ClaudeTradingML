import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: /api/signals memakai kode function yang sama (tanpa Firestore).
function devApi() {
  return {
    name: "dev-api",
    configureServer(server) {
      server.middlewares.use("/api/signals", async (req, res) => {
        const { scanSymbols } = await server.ssrLoadModule("/functions/signals.js");
        const { DEFAULTS } = await server.ssrLoadModule("/functions/config.js");
        const results = await scanSymbols(DEFAULTS.symbols, DEFAULTS);
        const { symbols, contactUrl, ...settings } = DEFAULTS;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ generatedAt: Date.now(), settings, results }));
      });
    },
  };
}

export default defineConfig({ plugins: [react(), devApi()] });
