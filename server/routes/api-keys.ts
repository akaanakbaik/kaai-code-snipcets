import { Request, Response } from "express";
import { db } from "../lib/db.js";
import { apiKeysTable, apiKeyUsageTable, adminIpWhitelistTable, requestLogsTable } from "../lib/schema.js";
import { eq, desc, and } from "drizzle-orm";
import crypto from "node:crypto";

function hashKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function generateRawKey(): string {
  const rand = crypto.randomBytes(24).toString("base64url");
  return `kaai_${rand}`;
}

export async function listApiKeys(req: Request, res: Response): Promise<void> {
  try {
    const keys = await db.select().from(apiKeysTable).orderBy(desc(apiKeysTable.createdAt));
    res.json({
      data: keys.map((k) => ({
        id: k.id,
        keyPrefix: k.keyPrefix,
        name: k.name,
        ownerEmail: k.ownerEmail,
        isActive: k.isActive,
        rateLimitPerSecond: k.rateLimitPerSecond,
        rateLimitPerDay: k.rateLimitPerDay,
        rateLimitPerMonth: k.rateLimitPerMonth,
        totalRequests: k.totalRequests,
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
        createdAt: k.createdAt.toISOString(),
        updatedAt: k.updatedAt.toISOString(),
      })),
    });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to list API keys" });
  }
}

export async function createApiKey(req: Request, res: Response): Promise<void> {
  const { name, ownerEmail, rateLimitPerSecond, rateLimitPerDay, rateLimitPerMonth } = req.body;
  if (!name || !ownerEmail) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "name and ownerEmail required" });
    return;
  }

  const rawKey = generateRawKey();
  const hashed = hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 14);

  try {
    const [created] = await db
      .insert(apiKeysTable)
      .values({
        id: crypto.randomUUID(),
        key: hashed,
        keyPrefix,
        name: name.trim(),
        ownerEmail: ownerEmail.toLowerCase().trim(),
        isActive: true,
        rateLimitPerSecond: Number(rateLimitPerSecond) || 10,
        rateLimitPerDay: Number(rateLimitPerDay) || 1000,
        rateLimitPerMonth: Number(rateLimitPerMonth) || 10000,
        totalRequests: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    res.status(201).json({
      id: created.id,
      key: rawKey,
      keyPrefix,
      name: created.name,
      ownerEmail: created.ownerEmail,
      isActive: created.isActive,
      rateLimitPerSecond: created.rateLimitPerSecond,
      rateLimitPerDay: created.rateLimitPerDay,
      rateLimitPerMonth: created.rateLimitPerMonth,
      createdAt: created.createdAt.toISOString(),
      message: "⚠️ Save this key now — it will NOT be shown again.",
    });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to create API key" });
  }
}

export async function updateApiKey(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { name, isActive, rateLimitPerSecond, rateLimitPerDay, rateLimitPerMonth } = req.body;

  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name.trim();
    if (isActive !== undefined) updates.isActive = Boolean(isActive);
    if (rateLimitPerSecond !== undefined) updates.rateLimitPerSecond = Number(rateLimitPerSecond);
    if (rateLimitPerDay !== undefined) updates.rateLimitPerDay = Number(rateLimitPerDay);
    if (rateLimitPerMonth !== undefined) updates.rateLimitPerMonth = Number(rateLimitPerMonth);

    const [updated] = await db.update(apiKeysTable).set(updates).where(eq(apiKeysTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "NOT_FOUND" }); return; }
    res.json({ id: updated.id, name: updated.name, isActive: updated.isActive, updatedAt: updated.updatedAt.toISOString() });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to update API key" });
  }
}

export async function deleteApiKey(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    await db.delete(apiKeyUsageTable).where(eq(apiKeyUsageTable.apiKeyId, id));
    await db.delete(apiKeysTable).where(eq(apiKeysTable.id, id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to delete API key" });
  }
}

export async function listIpWhitelist(req: Request, res: Response): Promise<void> {
  try {
    const rows = await db.select().from(adminIpWhitelistTable).orderBy(desc(adminIpWhitelistTable.createdAt));
    res.json({ data: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to list IPs" });
  }
}

export async function addIpWhitelist(req: Request, res: Response): Promise<void> {
  const { ipAddress, label, email } = req.body;
  if (!ipAddress || !email) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "ipAddress and email required" });
    return;
  }
  try {
    const [created] = await db
      .insert(adminIpWhitelistTable)
      .values({ id: crypto.randomUUID(), email, ipAddress, label: label ?? null, isActive: true, createdAt: new Date() })
      .returning();
    res.status(201).json({ ...created, createdAt: created.createdAt.toISOString() });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to add IP" });
  }
}

export async function updateIpWhitelist(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { label, isActive } = req.body;
  try {
    const updates: Record<string, unknown> = {};
    if (label !== undefined) updates.label = label;
    if (isActive !== undefined) updates.isActive = Boolean(isActive);
    const [updated] = await db.update(adminIpWhitelistTable).set(updates).where(eq(adminIpWhitelistTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "NOT_FOUND" }); return; }
    res.json({ success: true, ...updated, createdAt: updated.createdAt.toISOString() });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to update IP" });
  }
}

export async function deleteIpWhitelist(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    await db.delete(adminIpWhitelistTable).where(eq(adminIpWhitelistTable.id, id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to delete IP" });
  }
}

export async function getRequestLogs(req: Request, res: Response): Promise<void> {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const onlyBlocked = req.query.blocked === "true";
  try {
    const rows = await db.select().from(requestLogsTable).orderBy(desc(requestLogsTable.createdAt)).limit(limit);
    const filtered = onlyBlocked ? rows.filter((r) => r.blocked) : rows;
    res.json({ data: filtered.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })), total: filtered.length });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch logs" });
  }
}
