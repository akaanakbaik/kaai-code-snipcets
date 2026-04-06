import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Detailed DB connectivity check — useful for debugging production issues
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
      message: err.message,
      nodeEnv: process.env.NODE_ENV,
    });
  }
});

export default router;
