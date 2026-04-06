import { Router, type IRouter } from "express";
import { pool } from "../lib/db.js";
import { z } from "zod";

const router: IRouter = Router();

const HealthCheckResponse = z.object({ status: z.literal("ok") });

router.get("/healthz", (_req, res) => {
  res.json(HealthCheckResponse.parse({ status: "ok" }));
});

router.get("/healthz/db", async (_req, res) => {
  const start = Date.now();
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
      dbHost: process.env.DATABASE_URL?.replace(/\/\/[^@]+@/, "//***@").slice(0, 60),
    });
  } catch (err: any) {
    res.status(500).json({
      status: "error",
      latencyMs: Date.now() - start,
      error: err.message,
      nodeEnv: process.env.NODE_ENV,
    });
  }
});

export default router;
