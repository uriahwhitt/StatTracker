import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    // Ensure sw.js and manifest.json are copied from public/
    // (Vite does this automatically for files in /public)
  },
  server: {
    port: 5173,
    host: true, // expose on local network for mobile testing
  },
});
