import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The dashboard is a standalone client. In dev it proxies /v1/* to the harness
// API (default :8080) so the browser never needs CORS. Override with HARNESS_API_URL.
const API = process.env.HARNESS_API_URL ?? "http://localhost:8080";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/v1": { target: API, changeOrigin: true },
    },
  },
});
