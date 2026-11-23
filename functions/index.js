import { onRequest } from "firebase-functions/v2/https";
import handler from "./signals.js";

// Diakses lewat Hosting rewrite: /api/signals
export const signals = onRequest({ region: "us-central1", memory: "256MiB", timeoutSeconds: 30 }, handler);
