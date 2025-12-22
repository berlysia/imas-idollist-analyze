import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  root: "src/visualizer",
  publicDir: "../../data",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/types": path.resolve(__dirname, "./src/types"),
    },
  },
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
  },
});
