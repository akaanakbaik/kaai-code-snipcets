import { Router, type IRouter } from "express";
import { pool, poolSupabase1, poolSupabase2 } from "../lib/db.js";
import { z } from "zod";

const router: IRouter = Router();

const HealthCheckResponse = z.object({ status: z.literal("ok") });

function maskUrl(url: string | undefined): string {
  if (!url) return "(not set)";
  return url.replace(/\/\/[^@]+@/, "//***@").slice(0, 80);
}

router.get("/healthz", (_req, res) => {
  res.json(HealthCheckResponse.parse({ status: "ok" }));
});

router.get("/healthz/db", async (_req, res) => {
  const start = Date.now();

  // Detect which primary URL is in use
  const primaryUrl =
    process.env.DATABASE_SUPABASE_POLLER_URL_2 ??
    process.env.DATABASE_URL ??
    undefined;

  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    client.release();

    res.json({
      status: "ok",
      latencyMs: Date.now() - start,
      tables: result.rows.map((r: any) => r.table_name),
      nodeEnv: process.env.NODE_ENV,
      primaryDb: maskUrl(primaryUrl),
      supabase1Connected: poolSupabase1 !== null,
      supabase2Connected: poolSupabase2 !== null,
    });
  } catch (err: any) {
    res.status(500).json({
      status: "error",
      latencyMs: Date.now() - start,
      error: err.message,
      nodeEnv: process.env.NODE_ENV,
      primaryDb: maskUrl(primaryUrl),
      supabase1Connected: poolSupabase1 !== null,
      supabase2Connected: poolSupabase2 !== null,
    });
  }
});

router.get("/healthz/db/supabase1", async (_req, res) => {
  if (!poolSupabase1) {
    return res.status(503).json({ status: "disabled", reason: "DATABASE_SUPABASE_POLLER_URL_1 and DATABASE_URL_SUPABASE_1 not set" });
  }
  const start = Date.now();
  try {
    const client = await poolSupabase1.connect();
    await client.query("SELECT 1");
    client.release();
    res.json({ status: "ok", latencyMs: Date.now() - start });
  } catch (err: any) {
    res.status(500).json({ status: "error", latencyMs: Date.now() - start, error: err.message });
  }
});

router.get("/healthz/db/supabase2", async (_req, res) => {
  if (!poolSupabase2) {
    return res.status(503).json({ status: "disabled", reason: "DATABASE_SUPABASE_POLLER_URL_2 and DATABASE_URL_SUPABASE_2 not set" });
  }
  const start = Date.now();
  try {
    const client = await poolSupabase2.connect();
    await client.query("SELECT 1");
    client.release();
    res.json({ status: "ok", latencyMs: Date.now() - start });
  } catch (err: any) {
    res.status(500).json({ status: "error", latencyMs: Date.now() - start, error: err.message });
  }
});

export default router;
