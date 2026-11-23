import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Menjalankan /api/signals di dev server (di produksi dipakai Vercel serverless).
function devApi() {
  return {
    name: "dev-api",
    configureServer(server) {
      server.middlewares.use("/api/signals", async (req, res) => {
        const mod = await server.ssrLoadModule("/functions/signals.js");
        await mod.default(req, res);
      });
    },
  };
}

export default defineConfig({ plugins: [react(), devApi()] });
