import { defineConfig } from "vite";
import honox from "honox/vite";
import client from "honox/vite/client";
import ssg from "@hono/vite-ssg";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const baseConfig = {
    base: process.env.BASE_PATH || "/",
    resolve: {
      alias: {
        "@/types": path.resolve(__dirname, "./app/types"),
      },
    },
  };

  if (mode === "client") {
    return {
      ...baseConfig,
      plugins: [
        client({
          jsxImportSource: "react",
        }),
        react(),
      ],
      build: {
        outDir: "dist",
        emptyOutDir: true,
        manifest: true,
      },
    };
  }

  return {
    ...baseConfig,
    plugins: [
      honox({
        client: {
          input: ["./app/client.ts"],
        },
      }),
      ssg({ entry: "./app/server.ts" }),
    ],
    ssr: {
      external: ["react", "react-dom", "recharts", "lodash"],
    },
    build: {
      outDir: "dist",
      emptyOutDir: false,
    },
  };
});
