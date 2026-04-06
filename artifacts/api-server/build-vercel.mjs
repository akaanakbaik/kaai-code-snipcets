/**
 * Vercel backend build script.
 * Compiles src/app.ts → dist/app.js (CommonJS)
 * so api/index.js can require() it as a Vercel serverless handler.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { mkdir } from "node:fs/promises";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(artifactDir, "dist");

await mkdir(distDir, { recursive: true });

await esbuild({
  entryPoints: [path.resolve(artifactDir, "src/app.ts")],
  platform: "node",
  target: "node20",
  bundle: true,
  format: "cjs",
  outdir: distDir,
  // [name] uses the source filename — src/app.ts → dist/app.js
  // pino worker entries get their own distinct names (pino-worker, thread-stream, etc.)
  entryNames: "[name]",
  outExtension: { ".js": ".js" },
  logLevel: "info",
  external: [
    "*.node",
    "pg-native",
  ],
  plugins: [
    esbuildPluginPino({ transports: ["pino-pretty"] }),
  ],
});

console.log("✅ Backend built: artifacts/api-server/dist/app.js");
