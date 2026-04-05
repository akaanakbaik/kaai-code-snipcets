import app from "../artifacts/api-server/src/app";

/**
 * Vercel serverless function — wraps the Express app.
 *
 * All /api/* requests are routed here by vercel.json.
 * Note: Background cron jobs (Supabase sync, GitHub backup) do NOT run
 * in serverless mode. Use Vercel Cron or an external scheduler if needed.
 */
export default app;
