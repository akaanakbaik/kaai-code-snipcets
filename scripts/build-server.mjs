/**
 * Build script for the Express server.
 * Compiles server/app.ts → _server/app.cjs (CommonJS for Vercel serverless).
 *
 * Uses execSync + esbuild CLI to avoid ESM import resolution issues.
 * packages=external keeps all npm packages as require() calls so Vercel
 * can include them from node_modules at deploy time.
 *
 * Usage: node scripts/build-server.mjs
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { resolve } from "path";

if (!existsSync("_server")) {
  mkdirSync("_server", { recursive: true });
}

console.log("📦 Compiling server/app.ts → _server/app.cjs ...");
console.log("   Node version:", process.version);
console.log("   CWD:", process.cwd());

// Prefer local binary, fall back to PATH
const localBin = resolve("node_modules/.bin/esbuild");
const esbuildBin = existsSync(localBin) ? localBin : "esbuild";

console.log("   esbuild binary:", esbuildBin);

const cmd = [
  `"${esbuildBin}"`,
  "server/app.ts",
  "--bundle",
  "--packages=external",
  "--platform=node",
  "--target=node22",
  "--format=cjs",
  "--outfile=_server/app.cjs",
  "--external:pg-native",
  "--external:fsevents",
  "--external:pino-pretty",
  "--log-level=info",
].join(" ");

console.log("   Running:", cmd.slice(0, 120));

execSync(cmd, { stdio: "inherit", shell: true });

console.log("✅ Server compiled → _server/app.cjs");
