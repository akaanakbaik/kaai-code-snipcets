import { Router } from "express";
import { runFullSync } from "../lib/sync.js";

const router = Router();

router.get("/cron/sync", async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const authorization = req.header("authorization");
  const headerSecret = req.header("x-cron-secret");

  if (!secret) {
    res.status(503).json({ error: "Cron secret is not configured" });
    return;
  }

  if (authorization !== `Bearer ${secret}` && headerSecret !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const startedAt = Date.now();
  try {
    await runFullSync();
    res.json({ ok: true, durationMs: Date.now() - startedAt });
  } catch (err) {
    res.status(500).json({ error: "Sync failed", message: (err as Error).message });
  }
});

export default router;
