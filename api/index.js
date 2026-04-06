/**
 * Vercel Serverless Function — Entry Point
 *
 * The Express backend is pre-compiled to dist/app.mjs during Vercel's
 * buildCommand via build-vercel.mjs. This ensures pino, pg, and other
 * complex packages are bundled correctly using the same esbuild setup
 * that works in production on Replit.
 *
 * Route: All /api/* requests → this handler
 */
import app from "../artifacts/api-server/dist/app.mjs";

export default app;
