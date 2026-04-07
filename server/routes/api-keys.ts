import { Request, Response } from "express";
import { db } from "../lib/db.js";
import { apiKeysTable, apiKeyUsageTable, adminIpWhitelistTable, requestLogsTable } from "../lib/schema.js";
import { eq, desc } from "drizzle-orm";
import crypto from "node:crypto";

function hashKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// Format: 5 digits + 5 uppercase letters = 10 chars (e.g. "12345ABCDE")
function generateRawKey(): string {
  const digits = String(10000 + crypto.randomInt(90000)); // 10000–99999 (5 digits)
  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const letters = Array.from({ length: 5 }, () => alpha[crypto.randomInt(26)]).join("");
  return `${digits}${letters}`;
}

function validateCustomKey(raw: string): string | null {
  const cleaned = raw.trim().toUpperCase().replace(/\s/g, "");
  if (cleaned.length < 6 || cleaned.length > 48) {
    return "Custom key harus 6–48 karakter.";
  }
  if (!/^[A-Z0-9_\-]+$/.test(cleaned)) {
    return "Custom key hanya boleh huruf kapital, angka, - atau _.";
  }
  return null;
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
  const { name, ownerEmail, rateLimitPerSecond, rateLimitPerDay, rateLimitPerMonth, customKey } = req.body;
  if (!name || !ownerEmail) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "name and ownerEmail required" });
    return;
  }

  let rawKey: string;
  if (customKey && String(customKey).trim()) {
    const errMsg = validateCustomKey(String(customKey));
    if (errMsg) {
      res.status(400).json({ error: "VALIDATION_ERROR", message: errMsg });
      return;
    }
    rawKey = String(customKey).trim().toUpperCase().replace(/\s/g, "");
  } else {
    rawKey = generateRawKey();
  }

  const hashed = hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 10);

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
      message: "⚠️ Simpan key ini sekarang — tidak akan ditampilkan lagi!",
    });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to create API key" });
  }
}

export async function updateApiKey(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { name, isActive, rateLimitPerSecond, rateLimitPerDay, rateLimitPerMonth, newKey } = req.body;

  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name.trim();
    if (isActive !== undefined) updates.isActive = Boolean(isActive);
    if (rateLimitPerSecond !== undefined) updates.rateLimitPerSecond = Number(rateLimitPerSecond);
    if (rateLimitPerDay !== undefined) updates.rateLimitPerDay = Number(rateLimitPerDay);
    if (rateLimitPerMonth !== undefined) updates.rateLimitPerMonth = Number(rateLimitPerMonth);

    // Update key if newKey is provided
    let newRawKey: string | undefined;
    if (newKey && String(newKey).trim()) {
      const errMsg = validateCustomKey(String(newKey));
      if (errMsg) {
        res.status(400).json({ error: "VALIDATION_ERROR", message: errMsg });
        return;
      }
      newRawKey = String(newKey).trim().toUpperCase().replace(/\s/g, "");
      updates.key = hashKey(newRawKey);
      updates.keyPrefix = newRawKey.slice(0, 10);
    }

    const [updated] = await db.update(apiKeysTable).set(updates).where(eq(apiKeysTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "NOT_FOUND" }); return; }
    res.json({
      id: updated.id,
      name: updated.name,
      keyPrefix: updated.keyPrefix,
      isActive: updated.isActive,
      updatedAt: updated.updatedAt.toISOString(),
      ...(newRawKey ? { newKey: newRawKey, message: "⚠️ Key baru tersimpan. Simpan sekarang — tidak akan ditampilkan lagi!" } : {}),
    });
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
