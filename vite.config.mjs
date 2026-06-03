import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command }) => {
  const isBuild = command === "build";

  if (isBuild) {
    process.env.NODE_ENV = "production";
  }

  return {
    root: resolve(rootDir, "apps/web"),
    envDir: rootDir,
    plugins: [
      react({
        jsxRuntime: "automatic",
      }),
      tailwindcss(),
    ],
    define: {
      "process.env.NODE_ENV": JSON.stringify(
        isBuild ? "production" : "development",
      ),
    },
    oxc: {
      jsx: {
        development: !isBuild,
      },
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      proxy: {
        "/api": {
          target: "http://localhost:5000",
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: resolve(rootDir, "dist/web"),
      emptyOutDir: true,
    },
  };
});
