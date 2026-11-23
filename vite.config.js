import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: arahkan /api ke backend produksi (Firebase).
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": { target: "https://claudetradingml.web.app", changeOrigin: true } } },
});
