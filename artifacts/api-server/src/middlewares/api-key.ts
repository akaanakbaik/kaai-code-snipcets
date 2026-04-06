/**
 * API Key middleware
 *
 * Validates X-API-Key header for public endpoints.
 * Keys are stored hashed (SHA-256) in the database.
 * Enforces per-key rate limits (per-second, per-day, per-month).
 */

import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { apiKeysTable, apiKeyUsageTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "node:crypto";

// In-memory per-second sliding window: keyId -> timestamps[]
const secondWindow = new Map<string, number[]>();

function hashKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStr(): string {
  return new Date().toISOString().slice(0, 7);
}

function checkPerSecond(keyId: string, limit: number): boolean {
  const now = Date.now();
  const windowMs = 1000;
  const timestamps = (secondWindow.get(keyId) ?? []).filter((t) => now - t < windowMs);
  if (timestamps.length >= limit) return false;
  timestamps.push(now);
  secondWindow.set(keyId, timestamps);
  return true;
}

export async function requireApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const raw = req.headers["x-api-key"];

  if (!raw || typeof raw !== "string") {
    res.status(401).json({
      error: "UNAUTHORIZED",
      message: "API key required. Pass X-API-Key header.",
    });
    return;
  }

  const hashed = hashKey(raw.trim());

  try {
    const [apiKey] = await db
      .select()
      .from(apiKeysTable)
      .where(and(eq(apiKeysTable.key, hashed), eq(apiKeysTable.isActive, true)))
      .limit(1);

    if (!apiKey) {
      res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Invalid or inactive API key.",
      });
      return;
    }

    // Per-second limit (in-memory)
    if (!checkPerSecond(apiKey.id, apiKey.rateLimitPerSecond)) {
      res.status(429).json({
        error: "RATE_LIMITED",
        message: `Rate limit exceeded: max ${apiKey.rateLimitPerSecond} req/s`,
        retryAfter: 1,
      });
      return;
    }

    // Per-day and per-month limit (DB-backed)
    const today = todayStr();
    const month = monthStr();

    const [usage] = await db
      .select()
      .from(apiKeyUsageTable)
      .where(and(eq(apiKeyUsageTable.apiKeyId, apiKey.id), eq(apiKeyUsageTable.date, today)))
      .limit(1);

    const dayCount = usage?.requestsToday ?? 0;
    const monthCount = usage?.requestsMonth ?? 0;

    if (dayCount >= apiKey.rateLimitPerDay) {
      res.status(429).json({
        error: "RATE_LIMITED",
        message: `Daily limit reached: max ${apiKey.rateLimitPerDay} req/day`,
        retryAfter: 86400,
      });
      return;
    }

    if (monthCount >= apiKey.rateLimitPerMonth) {
      res.status(429).json({
        error: "RATE_LIMITED",
        message: `Monthly limit reached: max ${apiKey.rateLimitPerMonth} req/month`,
        retryAfter: 3600 * 24 * 7,
      });
      return;
    }

    // Attach key info to request
    (req as any).apiKey = apiKey;

    // Update usage counters + last used (fire-and-forget)
    updateUsage(apiKey.id, today, month).catch(() => {});

    next();
  } catch (err) {
    res.status(500).json({ error: "SERVER_ERROR", message: "API key validation failed" });
  }
}

async function updateUsage(keyId: string, today: string, month: string): Promise<void> {
  const [usage] = await db
    .select()
    .from(apiKeyUsageTable)
    .where(and(eq(apiKeyUsageTable.apiKeyId, keyId), eq(apiKeyUsageTable.date, today)))
    .limit(1);

  if (usage) {
    await db
      .update(apiKeyUsageTable)
      .set({
        requestsToday: usage.requestsToday + 1,
        requestsMonth: usage.requestsMonth + 1,
        updatedAt: new Date(),
      })
      .where(eq(apiKeyUsageTable.id, usage.id));
  } else {
    // Check if month record exists from previous day
    const [monthUsage] = await db
      .select()
      .from(apiKeyUsageTable)
      .where(and(eq(apiKeyUsageTable.apiKeyId, keyId), eq(apiKeyUsageTable.month, month)))
      .limit(1);

    const prevMonth = monthUsage?.requestsMonth ?? 0;

    await db.insert(apiKeyUsageTable).values({
      id: crypto.randomUUID(),
      apiKeyId: keyId,
      date: today,
      month,
      requestsToday: 1,
      requestsMonth: prevMonth + 1,
      updatedAt: new Date(),
    });
  }

  // Update lastUsedAt on api_keys (total is tracked via usage rows)
  await db
    .update(apiKeysTable)
    .set({ lastUsedAt: new Date(), updatedAt: new Date() })
    .where(eq(apiKeysTable.id, keyId))
    .catch(() => {});
}
