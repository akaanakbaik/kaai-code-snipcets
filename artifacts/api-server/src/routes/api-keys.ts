/**
 * Admin routes for API Key management
 * All routes protected by requireAdminSession.
 *
 * POST   /api/admin/api-keys          - Create API key
 * GET    /api/admin/api-keys          - List all API keys
 * PATCH  /api/admin/api-keys/:id      - Update key (name, limits, active)
 * DELETE /api/admin/api-keys/:id      - Delete key
 *
 * GET    /api/admin/ip-whitelist      - List whitelisted IPs
 * POST   /api/admin/ip-whitelist      - Add IP
 * PATCH  /api/admin/ip-whitelist/:id  - Update IP entry
 * DELETE /api/admin/ip-whitelist/:id  - Remove IP
 *
 * GET    /api/admin/request-logs      - Recent request logs
 */

import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import {
  apiKeysTable,
  apiKeyUsageTable,
  adminIpWhitelistTable,
  requestLogsTable,
} from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import crypto from "node:crypto";

const router = Router();

// Middleware applied per-route (imported from admin.ts via re-export)
// requireAdminSession is applied in admin routes registration

function hashKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function generateRawKey(): string {
  const rand = crypto.randomBytes(24).toString("base64url");
  return `kaai_${rand}`;
}

// ─── API Keys ─────────────────────────────────────────────────────────────────

// GET /api/admin/api-keys
export async function listApiKeys(req: Request, res: Response): Promise<void> {
  try {
    const keys = await db
      .select()
      .from(apiKeysTable)
      .orderBy(desc(apiKeysTable.createdAt));

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

// POST /api/admin/api-keys
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
      key: rawKey,          // Only time the raw key is shown!
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

// PATCH /api/admin/api-keys/:id
export async function updateApiKey(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { name, ownerEmail, isActive, rateLimitPerSecond, rateLimitPerDay, rateLimitPerMonth } = req.body;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name.trim();
  if (ownerEmail !== undefined) updates.ownerEmail = ownerEmail.toLowerCase().trim();
  if (isActive !== undefined) updates.isActive = Boolean(isActive);
  if (rateLimitPerSecond !== undefined) updates.rateLimitPerSecond = Number(rateLimitPerSecond);
  if (rateLimitPerDay !== undefined) updates.rateLimitPerDay = Number(rateLimitPerDay);
  if (rateLimitPerMonth !== undefined) updates.rateLimitPerMonth = Number(rateLimitPerMonth);

  try {
    const [updated] = await db
      .update(apiKeysTable)
      .set(updates as any)
      .where(eq(apiKeysTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "NOT_FOUND", message: "API key not found" });
      return;
    }

    res.json({ success: true, id: updated.id, isActive: updated.isActive });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to update API key" });
  }
}

// DELETE /api/admin/api-keys/:id
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

// ─── IP Whitelist ─────────────────────────────────────────────────────────────

// GET /api/admin/ip-whitelist
export async function listIpWhitelist(req: Request, res: Response): Promise<void> {
  try {
    const rows = await db
      .select()
      .from(adminIpWhitelistTable)
      .orderBy(desc(adminIpWhitelistTable.createdAt));

    res.json({
      data: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to list IPs" });
  }
}

// POST /api/admin/ip-whitelist
export async function addIpWhitelist(req: Request, res: Response): Promise<void> {
  const { email, ipAddress, label } = req.body;
  if (!ipAddress) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "ipAddress required" });
    return;
  }

  try {
    const [created] = await db
      .insert(adminIpWhitelistTable)
      .values({
        id: crypto.randomUUID(),
        email: email?.toLowerCase().trim() ?? "",
        ipAddress: ipAddress.trim(),
        label: label?.trim() ?? null,
        isActive: true,
        createdAt: new Date(),
      })
      .returning();

    res.status(201).json({ ...created, createdAt: created.createdAt.toISOString() });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to add IP" });
  }
}

// PATCH /api/admin/ip-whitelist/:id
export async function updateIpWhitelist(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { email, ipAddress, label, isActive } = req.body;

  const updates: Record<string, unknown> = {};
  if (email !== undefined) updates.email = email.toLowerCase().trim();
  if (ipAddress !== undefined) updates.ipAddress = ipAddress.trim();
  if (label !== undefined) updates.label = label.trim();
  if (isActive !== undefined) updates.isActive = Boolean(isActive);

  try {
    const [updated] = await db
      .update(adminIpWhitelistTable)
      .set(updates as any)
      .where(eq(adminIpWhitelistTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "NOT_FOUND", message: "IP entry not found" });
      return;
    }

    res.json({ success: true, ...updated, createdAt: updated.createdAt.toISOString() });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to update IP" });
  }
}

// DELETE /api/admin/ip-whitelist/:id
export async function deleteIpWhitelist(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    await db.delete(adminIpWhitelistTable).where(eq(adminIpWhitelistTable.id, id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to delete IP" });
  }
}

// ─── Request Logs ─────────────────────────────────────────────────────────────

// GET /api/admin/request-logs
export async function getRequestLogs(req: Request, res: Response): Promise<void> {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const onlyBlocked = req.query.blocked === "true";

  try {
    const query = db
      .select()
      .from(requestLogsTable)
      .orderBy(desc(requestLogsTable.createdAt))
      .limit(limit);

    const rows = await query;

    const filtered = onlyBlocked ? rows.filter((r) => r.blocked) : rows;

    res.json({
      data: filtered.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
      total: filtered.length,
    });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch logs" });
  }
}

export default router;
