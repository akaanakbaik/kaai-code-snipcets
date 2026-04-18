import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

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

const isDev = process.env.NODE_ENV !== "production";
const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 5173;

export default defineConfig({
  base: "/",
  plugins: [
    stripUseClient(),
    react(),
    tailwindcss(),
    ...(isDev
      ? [
          (await import("@replit/vite-plugin-runtime-error-modal").catch(() => null))?.default?.() ?? [],
        ].flat()
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),

      "@workspace/api-client-react": path.resolve(
        import.meta.dirname,
        "lib/api-client-react/src"
      ),
    },
    dedupe: ["react", "react-dom"],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 700,
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
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.API_PORT ?? 3000}`,
        changeOrigin: true,
      },
      "/sitemap.xml": {
        target: `http://localhost:${process.env.API_PORT ?? 3000}`,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
