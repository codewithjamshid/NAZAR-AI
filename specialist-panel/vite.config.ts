import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The config runs in Node; declared here so the panel needs no @types/node.
declare const process: { env: Record<string, string | undefined> };

// VITE_BASE_PATH lets the panel live under a sub-path in production
// (e.g. /panel/ next to the nurse app on one domain). Dev stays at /.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react()],
  server: { port: 5174, strictPort: true },
  preview: { port: 5174, strictPort: true },
});
