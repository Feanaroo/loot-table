import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative paths: the same build runs in the desktop app and under a GitHub Pages subpath
  base: "./",
  // Tauri expects a fixed dev port, and its own errors not cleared away
  clearScreen: false,
  server: { port: 5173, strictPort: true },
});
