/**
 * Vercel backend build script.
 *
 * Compiles src/app.ts → _dist_server/app.js  (CommonJS, project root)
 *
 * Why root-level _dist_server/:
 *   api/index.js references it as require('./_dist_server/app.js').
 *   Placing it at the project root guarantees Vercel's file tracer
 *   finds and bundles it alongside the serverless function.
 *
 * Why NO esbuild-plugin-pino:
 *   logger.ts uses pino.destination({sync:true}) in production —
 *   no worker threads are spawned, so no worker shim files are needed.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import { mkdir, rm } from "node:fs/promises";

globalThis.require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Output at project root: <root>/_dist_server/
const projectRoot = path.resolve(__dirname, "../../");
const distDir = path.resolve(projectRoot, "_dist_server");

// Clean previous build
await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

await esbuild({
  entryPoints: [path.resolve(__dirname, "src/app.ts")],
  platform: "node",
  target: "node20",
  bundle: true,
  format: "cjs",
  outfile: path.resolve(distDir, "app.js"),
  logLevel: "info",
  define: {
    // Force production mode so logger uses sync destination (no worker threads)
    "process.env.NODE_ENV": '"production"',
  },
  external: [
    // Only exclude native binaries — everything else gets bundled
    "*.node",
    "pg-native",
  ],
});

console.log("✅ Backend built → _dist_server/app.js");
