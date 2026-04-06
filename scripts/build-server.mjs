/**
 * Build script for the Express server.
 * Bundles server/app.ts → _server/app.cjs (CommonJS for Vercel serverless).
 *
 * Usage: node scripts/build-server.mjs
 */

import { build } from "esbuild";
import { existsSync, mkdirSync } from "fs";

if (!existsSync("_server")) {
  mkdirSync("_server", { recursive: true });
}

await build({
  entryPoints: ["server/app.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: "_server/app.cjs",
  external: [
    // Native addons that can't be bundled
    "pg-native",
    "fsevents",
    // Optional pino transport (not needed in prod)
    "pino-pretty",
  ],
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  minify: false,
  sourcemap: false,
  logLevel: "info",
  banner: {
    js: "// Auto-generated — do not edit",
  },
});

console.log("✅ Server bundled → _server/app.cjs");
