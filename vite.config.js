import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "docs-site",
  cacheDir: "../node_modules/.vite/wisp-docs",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
