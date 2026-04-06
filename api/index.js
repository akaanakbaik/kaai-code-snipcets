/**
 * Vercel Serverless Function — handles /api/*
 *
 * The Express backend is pre-compiled to CommonJS by
 * scripts/build-server.mjs during Vercel's buildCommand.
 * Output is at _server/app.cjs (project root).
 *
 * Uses createRequire (ESM → CJS interop) to load the bundle.
 */

import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const appPath = path.join(process.cwd(), "_server", "app.cjs");

console.log("[api/index.js] Loading Express bundle from:", appPath);
console.log("[api/index.js] process.cwd():", process.cwd());
console.log("[api/index.js] NODE_ENV:", process.env.NODE_ENV);
console.log("[api/index.js] DATABASE_URL set:", !!process.env.DATABASE_URL);

let app;

try {
  const mod = require(appPath);

  if (typeof mod === "function") {
    app = mod;
  } else if (typeof mod.default === "function") {
    app = mod.default;
  } else if (mod && mod.app && typeof mod.app === "function") {
    app = mod.app;
  } else {
    throw new Error(
      "App export not found. mod type=" + typeof mod +
      ", mod.default type=" + typeof (mod && mod.default)
    );
  }

  console.log("✅ Express app resolved, type:", typeof app);
} catch (err) {
  console.error("❌ [api/index.js] FATAL: Failed to load Express bundle:", err.message);
  console.error(err.stack);
}

export default function handler(req, res) {
  if (!app) {
    console.error("[api/index.js] Handler called but app failed to initialize");
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Server initialization failed" }));
    return;
  }

  try {
    return app(req, res);
  } catch (err) {
    console.error("❌ [api/index.js] Handler crash:", err.message);
    console.error(err.stack);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Internal Server Error" }));
    }
  }
}
