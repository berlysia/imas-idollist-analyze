import { defineConfig } from "vite";
import honox from "honox/vite";
import ssg from "@hono/vite-ssg";
import path from "node:path";

export default defineConfig(({ mode }) => ({
  base: process.env.BASE_PATH || "/",
  plugins: [
    honox({
      client: {
        input: ["./app/client.ts"],
      },
    }),
    mode === "ssg" && ssg({ entry: "./app/server.ts" }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/types": path.resolve(__dirname, "./src/types"),
    },
  },
  ssr: {
    external: ["react", "react-dom", "recharts", "lodash"],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
}));
