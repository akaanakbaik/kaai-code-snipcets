/**
 * Vercel-specific backend build script.
 *
 * Compiles src/app.ts (WITHOUT server.listen) into dist/app.mjs
 * so that api/index.js can import it as a Vercel serverless handler.
 *
 * Uses the same esbuild configuration as build.mjs to ensure
 * pino, pg, and other complex packages are handled correctly.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import { mkdir } from "node:fs/promises";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(artifactDir, "dist");

await mkdir(distDir, { recursive: true });

// Externalize everything that can't run in Vercel serverless or causes
// bundling conflicts (native addons, pino workers, etc.)
const external = [
  "*.node",
  "pino",
  "pino-http",
  "pino-pretty",
  "thread-stream",
  "pg",
  "pg-native",
  "nodemailer",
  "sharp",
  "better-sqlite3",
  "sqlite3",
  "canvas",
  "bcrypt",
  "argon2",
  "fsevents",
  "re2",
  "farmhash",
  "bufferutil",
  "utf-8-validate",
  "cpu-features",
  "dtrace-provider",
  "isolated-vm",
  "lightningcss",
  "ssh2",
];

await esbuild({
  entryPoints: [path.resolve(artifactDir, "src/app.ts")],
  platform: "node",
  bundle: true,
  format: "esm",
  outfile: path.resolve(distDir, "app.mjs"),
  logLevel: "info",
  external,
  sourcemap: false,
  banner: {
    js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
`,
  },
});

console.log("✅ Vercel backend bundle ready: artifacts/api-server/dist/app.mjs");
