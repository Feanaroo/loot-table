import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The page asks for data.json?v=<this>: a new dataset gets a new URL, so a browser or GitHub's CDN
// can't pair new code with a cached older dataset (one without share numbers, say)
const dataVersion = createHash("sha256").update(readFileSync("public/data.json")).digest("hex").slice(0, 12);

export default defineConfig({
  plugins: [react()],
  // Relative paths: the same build runs in the desktop app and under a GitHub Pages subpath
  base: "./",
  define: { __DATA_VERSION__: JSON.stringify(dataVersion) },
  // Tauri expects a fixed dev port, and its own errors not cleared away
  clearScreen: false,
  server: { port: 5173, strictPort: true },
});
