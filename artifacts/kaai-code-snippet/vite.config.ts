import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// ─── "use client" stripper ────────────────────────────────────────────────────
// shadcn/ui components include `"use client"` directives for Next.js RSC.
// In a Vite app this directive is meaningless and causes Rollup sourcemap
// warnings at build time (e.g. tooltip.tsx, select.tsx, label.tsx).
// This plugin removes the directive before Rollup processes the file.
function stripUseClient(): Plugin {
  return {
    name: "strip-use-client",
    enforce: "pre",
    transform(code, id) {
      if (!/\.[jt]sx?$/.test(id)) return null;
      if (!code.startsWith('"use client"') && !code.startsWith("'use client'")) return null;
      return {
        code: code.replace(/^['"]use client['"];?\r?\n/, ""),
        map: null,
      };
    },
  };
}

// ─── Config ───────────────────────────────────────────────────────────────────

const isBuildMode = process.argv.includes("build");
const isProduction = process.env.NODE_ENV === "production";

const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 3000;

if (!isBuildMode) {
  if (!rawPort) {
    throw new Error("PORT environment variable is required but was not provided.");
  }
  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }
}

const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [
    stripUseClient(),
    react(),
    tailwindcss(),
    // runtimeErrorOverlay only in development — it interferes with sourcemaps in production
    ...(!isProduction ? [runtimeErrorOverlay()] : []),
    ...(!isProduction && process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({ root: path.resolve(import.meta.dirname, "..") }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          router: ["wouter"],
          syntax: ["react-syntax-highlighter"],
          query: ["@tanstack/react-query"],
          ui: ["lucide-react", "framer-motion"],
        },
      },
    },
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
