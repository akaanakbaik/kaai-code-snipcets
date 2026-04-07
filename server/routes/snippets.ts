import { Router } from "express";
import { db } from "../lib/db.js";
import { snippetsTable } from "../lib/schema.js";
import { eq, and, or, ilike, sql, desc, count, asc } from "drizzle-orm";
import crypto from "node:crypto";
import { z } from "zod";
import { sendBroadcastEmail } from "../lib/mailer.js";
import { logger } from "../lib/logger.js";

const router = Router();

const ADMIN_EMAILS: Record<string, string> = {
  "akaanakbaik17@proton.me": "aka",
  "yaudahpakeaja6@gmail.com": "youso",
  "kelvdra46@gmail.com": "hydra",
  "clpmadang@gmail.com": "udin",
};

function generateId(): string {
  const digits = Array.from({ length: 5 }, () => Math.floor(Math.random() * 10)).join("");
  const letters = Array.from({ length: 5 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26))
  ).join("");
  return digits + letters;
}

function formatSnippet(snippet: typeof snippetsTable.$inferSelect, hideEmail = true) {
  const result: Record<string, unknown> = {
    ...snippet,
    tags: snippet.tags ?? [],
    createdAt: snippet.createdAt.toISOString(),
    updatedAt: snippet.updatedAt.toISOString(),
  };
  if (hideEmail) delete result.authorEmail;
  return result;
}

async function sendToBot(snippet: Record<string, unknown>) {
  const botUrl = process.env.VITE_BOT_WEBHOOK_URL;
  const secret = process.env.VITE_WEBHOOK_SECRET;
  if (!botUrl) return;
  try {
    await fetch(botUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Webhook-Secret": secret ?? "" },
      body: JSON.stringify({
        id: snippet.id,
        nama: snippet.authorName,
        email: snippet.authorEmail,
        namacode: snippet.title,
        tagcode: (snippet.tags as string[])?.join(","),
        code: snippet.code,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Best-effort
  }
}

async function notifyAdmins(snippetTitle: string, snippetId: string, authorName: string): Promise<void> {
  await Promise.allSettled(
    Object.entries(ADMIN_EMAILS).map(([email, name]) =>
      sendBroadcastEmail(
        email,
        `[Kaai] Ada snippet baru menunggu review`,
        `Hai ${name}, ada code yang perlu di acc nih, acc segera ya!\n\n` +
        `Judul: ${snippetTitle}\n` +
        `Pengirim: ${authorName}\n` +
        `ID: ${snippetId}\n\n` +
        `Buka panel admin di https://codes-snippet.kaai.my.id/admin untuk review.`,
      ).catch(() => {})
    )
  );
  logger.info(`[snippets] Admin notification sent for snippet ${snippetId}`);
}

// Validation schemas
const CreateSnippetBody = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).default(""),
  language: z.string().min(1).max(50),
  tags: z.array(z.string()).max(10).default([]),
  code: z.string().min(1).max(50000),
  authorName: z.string().min(1).max(100),
  authorEmail: z.string().email().max(200),
});

const ListSnippetsQuery = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(12),
  q: z.string().optional(),
  search: z.string().optional(),
  language: z.string().optional(),
  tag: z.string().optional(),
  sort: z.enum(["newest", "oldest", "popular", "copies", "az"]).optional(),
  sortBy: z.enum(["popular", "latest", "az"]).optional(),
});

// GET /api/snippets/popular
router.get("/snippets/popular", async (req, res) => {
  try {
    const [mostViewed, mostCopied] = await Promise.all([
      db.select().from(snippetsTable).where(eq(snippetsTable.status, "approved")).orderBy(desc(snippetsTable.viewCount)).limit(6),
      db.select().from(snippetsTable).where(eq(snippetsTable.status, "approved")).orderBy(desc(snippetsTable.copyCount)).limit(6),
    ]);
    res.json({ mostViewed: mostViewed.map((s) => formatSnippet(s)), mostCopied: mostCopied.map((s) => formatSnippet(s)) });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch popular snippets" });
  }
});

// GET /api/snippets/tags
router.get("/snippets/tags", async (req, res) => {
  try {
    const rows = await db.select({ tags: snippetsTable.tags }).from(snippetsTable).where(eq(snippetsTable.status, "approved"));
    const tagCounts: Record<string, number> = {};
    rows.forEach((r) => { (r.tags ?? []).forEach((tag) => { tagCounts[tag] = (tagCounts[tag] || 0) + 1; }); });
    const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([tag, count]) => ({ tag, count }));
    res.json({ data: sorted });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch tags" });
  }
});

// POST /api/snippets/:id/view
router.post("/snippets/:id/view", async (req, res) => {
  try {
    await db.update(snippetsTable).set({ viewCount: sql`${snippetsTable.viewCount} + 1` }).where(and(eq(snippetsTable.id, req.params.id), eq(snippetsTable.status, "approved")));
    res.json({ success: true });
  } catch {
    res.json({ success: false });
  }
});

// POST /api/snippets/:id/copy
router.post("/snippets/:id/copy", async (req, res) => {
  try {
    await db.update(snippetsTable).set({ copyCount: sql`${snippetsTable.copyCount} + 1` }).where(and(eq(snippetsTable.id, req.params.id), eq(snippetsTable.status, "approved")));
    res.json({ success: true });
  } catch {
    res.json({ success: false });
  }
});

// GET /api/snippets
router.get("/snippets", async (req, res) => {
  const parsed = ListSnippetsQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid query params" });
    return;
  }

  const { page, limit, q, search, language, tag, sort, sortBy } = parsed.data;
  const offset = (page - 1) * limit;
  const searchQuery = q || search || undefined;

  // Map sortBy (frontend) → sort (backend canonical)
  let resolvedSort: "newest" | "oldest" | "popular" | "copies" | "az" = "newest";
  if (sort) {
    resolvedSort = sort;
  } else if (sortBy) {
    if (sortBy === "popular") resolvedSort = "popular";
    else if (sortBy === "latest") resolvedSort = "newest";
    else if (sortBy === "az") resolvedSort = "az";
  }

  try {
    const conditions = [eq(snippetsTable.status, "approved")];
    if (searchQuery) {
      conditions.push(
        or(
          ilike(snippetsTable.title, `%${searchQuery}%`),
          ilike(snippetsTable.code, `%${searchQuery}%`),
          ilike(snippetsTable.description, `%${searchQuery}%`),
          ilike(snippetsTable.authorName, `%${searchQuery}%`),
          sql`EXISTS (SELECT 1 FROM unnest(${snippetsTable.tags}) AS t WHERE t ILIKE ${'%' + searchQuery + '%'})`,
        )!
      );
    }
    if (language) conditions.push(eq(snippetsTable.language, language));
    if (tag) conditions.push(sql`${snippetsTable.tags} @> ARRAY[${tag}]::text[]`);

    const where = and(...conditions);
    const orderBy =
      resolvedSort === "newest"  ? [desc(snippetsTable.createdAt)] :
      resolvedSort === "oldest"  ? [asc(snippetsTable.createdAt)] :
      resolvedSort === "popular" ? [desc(snippetsTable.viewCount), desc(snippetsTable.copyCount)] :
      resolvedSort === "copies"  ? [desc(snippetsTable.copyCount)] :
      resolvedSort === "az"      ? [asc(snippetsTable.title)] :
      [desc(snippetsTable.createdAt)];

    const [snippets, [{ total }]] = await Promise.all([
      db.select().from(snippetsTable).where(where).orderBy(...orderBy).limit(limit).offset(offset),
      db.select({ total: count() }).from(snippetsTable).where(where),
    ]);

    res.json({
      data: snippets.map((s) => formatSnippet(s)),
      pagination: { page, limit, total: Number(total), totalPages: Math.ceil(Number(total) / limit) },
    });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch snippets" });
  }
});

// POST /api/snippets
router.post("/snippets", async (req, res) => {
  const parsed = CreateSnippetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
    return;
  }

  const id = generateId();
  try {
    const [snippet] = await db
      .insert(snippetsTable)
      .values({ id, ...parsed.data, status: "pending", createdAt: new Date(), updatedAt: new Date() })
      .returning();

    const full = { ...snippet, authorEmail: snippet.authorEmail };
    sendToBot(full as any).catch(() => {});
    notifyAdmins(snippet.title, snippet.id, snippet.authorName).catch(() => {});

    res.status(201).json(formatSnippet(snippet));
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to create snippet" });
  }
});

// GET /api/snippets/:id
router.get("/snippets/:id", async (req, res) => {
  try {
    const [snippet] = await db
      .select()
      .from(snippetsTable)
      .where(and(eq(snippetsTable.id, req.params.id), eq(snippetsTable.status, "approved")))
      .limit(1);

    if (!snippet) {
      res.status(404).json({ error: "NOT_FOUND", message: "Snippet not found" });
      return;
    }
    res.json(formatSnippet(snippet));
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch snippet" });
  }
});

// Webhook approve/reject (for Telegram bot)
router.post("/snippets/:id/approve", async (req, res) => {
  const secret = process.env.VITE_WEBHOOK_SECRET;
  if (secret && req.headers["x-webhook-secret"] !== secret) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }
  const [updated] = await db
    .update(snippetsTable)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(snippetsTable.id, req.params.id))
    .returning();
  if (!updated) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  res.json(formatSnippet(updated));
});

router.post("/snippets/:id/reject", async (req, res) => {
  const secret = process.env.VITE_WEBHOOK_SECRET;
  if (secret && req.headers["x-webhook-secret"] !== secret) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }
  const reason = req.body?.reason;
  const [updated] = await db
    .update(snippetsTable)
    .set({ status: "rejected", rejectReason: reason ?? null, updatedAt: new Date() })
    .where(eq(snippetsTable.id, req.params.id))
    .returning();
  if (!updated) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  res.json(formatSnippet(updated));
});

export default router;
