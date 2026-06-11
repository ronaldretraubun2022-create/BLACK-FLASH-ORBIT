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

    resolve: {
      alias: {
        "@": resolve(rootDir, "apps/web/src"),
      },
    },

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

    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-router-dom",
        "@supabase/supabase-js",
        "lucide-react",
      ],
    },

    server: {
      host: "0.0.0.0",
      port: 5173,
      proxy: {
        "/api": {
          target: "http://localhost:5000",
          changeOrigin: true,
          secure: false,
        },
      },
    },

    build: {
      outDir: resolve(rootDir, "dist/web"),
      emptyOutDir: true,
      sourcemap: false,
      minify: "oxc",
      cssCodeSplit: true,
      chunkSizeWarningLimit: 900,
      reportCompressedSize: true,

      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) {
              return undefined;
            }

            if (id.includes("react") || id.includes("react-dom")) {
              return "react-vendor";
            }

            if (id.includes("react-router")) {
              return "router-vendor";
            }

            if (id.includes("lucide-react")) {
              return "icons-vendor";
            }

            if (id.includes("@supabase")) {
              return "supabase-vendor";
            }

            return "vendor";
          },

          chunkFileNames: "assets/js/[name]-[hash].js",
          entryFileNames: "assets/js/[name]-[hash].js",

          assetFileNames: ({ name }) => {
            if (/\.(css)$/i.test(name ?? "")) {
              return "assets/css/[name]-[hash][extname]";
            }

            return "assets/[name]-[hash][extname]";
          },
        },
      },
    },
  };
});
