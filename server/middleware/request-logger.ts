import { Request, Response, NextFunction } from "express";
import { db } from "../lib/db.js";
import { requestLogsTable } from "../lib/schema.js";
import crypto from "node:crypto";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown";

  res.on("finish", () => {
    const apiKey = (req as any).apiKey;
    const responseTimeMs = Date.now() - start;
    const path = req.path.split("?")[0].slice(0, 200);

    if (!path.startsWith("/api")) return;

    db.insert(requestLogsTable)
      .values({
        id: crypto.randomUUID(),
        ipAddress: ip,
        method: req.method,
        path,
        statusCode: res.statusCode,
        apiKeyId: apiKey?.id ?? null,
        apiKeyPrefix: apiKey?.keyPrefix ?? null,
        blocked: res.statusCode === 403 || res.statusCode === 429,
        blockReason:
          res.statusCode === 429 ? "RATE_LIMITED" : res.statusCode === 403 ? "FORBIDDEN" : null,
        responseTimeMs,
        userAgent: req.headers["user-agent"]?.slice(0, 200) ?? null,
        createdAt: new Date(),
      })
      .catch(() => {});
  });

  next();
}
