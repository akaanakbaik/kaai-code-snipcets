import { Router } from "express";
import { db, snippetsTable } from "@workspace/db";
import {
  CreateSnippetBody,
  ListSnippetsQueryParams,
  GetSnippetParams,
} from "@workspace/api-zod";
import { eq, and, or, ilike, sql, desc, count, asc } from "drizzle-orm";
import crypto from "node:crypto";

const router = Router();

function generateId(): string {
  const digits = Array.from({ length: 5 }, () => Math.floor(Math.random() * 10)).join("");
  const letters = Array.from({ length: 5 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26))
  ).join("");
  return digits + letters;
}

function formatSnippet(snippet: typeof snippetsTable.$inferSelect, hideEmail = true) {
  const result = {
    ...snippet,
    tags: snippet.tags ?? [],
    createdAt: snippet.createdAt.toISOString(),
    updatedAt: snippet.updatedAt.toISOString(),
  };
  if (hideEmail) {
    (result as any).authorEmail = undefined;
  }
  return result;
}

async function sendToBot(snippet: ReturnType<typeof formatSnippet> & { authorEmail?: string }) {
  const botUrl = process.env.VITE_BOT_WEBHOOK_URL;
  const secret = process.env.VITE_WEBHOOK_SECRET;
  if (!botUrl) return;
  try {
    await fetch(botUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Secret": secret ?? "",
      },
      body: JSON.stringify({
        id: snippet.id,
        nama: snippet.authorName,
        email: snippet.authorEmail,
        namacode: snippet.title,
        tagcode: snippet.tags.join(","),
        code: snippet.code,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Best-effort
  }
}

// GET /api/snippets/popular — Most viewed + most copied
router.get("/snippets/popular", async (req, res) => {
  try {
    const [mostViewed, mostCopied] = await Promise.all([
      db
        .select()
        .from(snippetsTable)
        .where(eq(snippetsTable.status, "approved"))
        .orderBy(desc(snippetsTable.viewCount))
        .limit(6),
      db
        .select()
        .from(snippetsTable)
        .where(eq(snippetsTable.status, "approved"))
        .orderBy(desc(snippetsTable.copyCount))
        .limit(6),
    ]);

    res.json({
      mostViewed: mostViewed.map((s) => formatSnippet(s)),
      mostCopied: mostCopied.map((s) => formatSnippet(s)),
    });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch popular snippets" });
  }
});

// GET /api/snippets/tags — Most used tags
router.get("/snippets/tags", async (req, res) => {
  try {
    const rows = await db
      .select({ tags: snippetsTable.tags })
      .from(snippetsTable)
      .where(eq(snippetsTable.status, "approved"));

    const tagCounts: Record<string, number> = {};
    rows.forEach((r) => {
      (r.tags ?? []).forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    const sorted = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    res.json({ data: sorted });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch tags" });
  }
});

// POST /api/snippets/:id/view — Track view
router.post("/snippets/:id/view", async (req, res) => {
  try {
    await db
      .update(snippetsTable)
      .set({ viewCount: sql`${snippetsTable.viewCount} + 1` })
      .where(and(eq(snippetsTable.id, req.params.id), eq(snippetsTable.status, "approved")));
    res.json({ success: true });
  } catch {
    res.json({ success: false });
  }
});

// POST /api/snippets/:id/copy — Track copy
router.post("/snippets/:id/copy", async (req, res) => {
  try {
    await db
      .update(snippetsTable)
      .set({ copyCount: sql`${snippetsTable.copyCount} + 1` })
      .where(and(eq(snippetsTable.id, req.params.id), eq(snippetsTable.status, "approved")));
    res.json({ success: true });
  } catch {
    res.json({ success: false });
  }
});

// GET /api/snippets
router.get("/snippets", async (req, res) => {
  const parsed = ListSnippetsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid query parameters" });
    return;
  }

  const { search, language, tag, sortBy = "popular", page = 1, limit = 12 } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions = [eq(snippetsTable.status, "approved")];

  if (search) {
    // Smart multi-field search: parse tokens for language/author detection
    const tokens = search.toLowerCase().split(/\s+/).filter(Boolean);
    const langMap: Record<string, string> = {
      js: "javascript", ts: "typescript", py: "python",
      rb: "ruby", go: "go", rs: "rust", sh: "bash",
      kt: "kotlin", cs: "csharp", md: "markdown",
    };
    
    const searchConditions = or(
      ilike(snippetsTable.title, `%${search}%`),
      ilike(snippetsTable.description, `%${search}%`),
      ilike(snippetsTable.authorName, `%${search}%`),
      ilike(snippetsTable.language, `%${search}%`),
    );
    if (searchConditions) conditions.push(searchConditions);
  }

  if (language) {
    conditions.push(ilike(snippetsTable.language, language));
  }

  if (tag) {
    conditions.push(sql`${snippetsTable.tags} @> ARRAY[${tag}]::text[]`);
  }

  const whereClause = and(...conditions);

  const orderExpr =
    sortBy === "latest"
      ? desc(snippetsTable.createdAt)
      : sortBy === "az"
      ? asc(snippetsTable.title)
      : desc(snippetsTable.viewCount); // popular = most viewed

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(snippetsTable)
      .where(whereClause)
      .orderBy(orderExpr)
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(snippetsTable).where(whereClause),
  ]);

  const total = Number(totalRows[0]?.count ?? 0);
  const totalPages = Math.ceil(total / limit);

  res.json({
    data: rows.map((s) => formatSnippet(s)),
    total,
    page,
    limit,
    totalPages,
  });
});

// POST /api/snippets
router.post("/snippets", async (req, res) => {
  const parsed = CreateSnippetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid request body" });
    return;
  }

  const { title, description, language, tags, code, authorName, authorEmail } = parsed.data;

  // Anti-duplicate check
  const existing = await db
    .select({ id: snippetsTable.id })
    .from(snippetsTable)
    .where(
      and(
        eq(snippetsTable.title, title),
        eq(snippetsTable.authorEmail, authorEmail),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({
      error: "DUPLICATE_SNIPPET",
      message: "A snippet with this title from this author already exists",
    });
    return;
  }

  const id = generateId();
  const now = new Date();

  const [snippet] = await db
    .insert(snippetsTable)
    .values({
      id,
      title,
      description,
      language,
      tags,
      code,
      authorName,
      authorEmail,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!snippet) {
    res.status(500).json({ error: "CREATE_FAILED", message: "Failed to create snippet" });
    return;
  }

  // Fire webhook to Telegram bot
  sendToBot({ ...formatSnippet(snippet, false), authorEmail: snippet.authorEmail });

  // Return without email
  res.status(201).json(formatSnippet(snippet));
});

// GET /api/snippets/pending
router.get("/snippets/pending", async (req, res) => {
  const rows = await db
    .select()
    .from(snippetsTable)
    .where(eq(snippetsTable.status, "pending"))
    .orderBy(desc(snippetsTable.createdAt));

  res.json({
    data: rows.map((s) => ({
      ...s,
      tags: s.tags ?? [],
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })),
    total: rows.length,
    page: 1,
    limit: rows.length,
    totalPages: 1,
  });
});

// GET /api/snippets/:id
router.get("/snippets/:id", async (req, res) => {
  const parsed = GetSnippetParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid snippet ID" });
    return;
  }

  const [snippet] = await db
    .select()
    .from(snippetsTable)
    .where(eq(snippetsTable.id, parsed.data.id))
    .limit(1);

  if (!snippet) {
    res.status(404).json({ error: "NOT_FOUND", message: "Snippet not found" });
    return;
  }

  res.json(formatSnippet(snippet));
});

// Keep old approve/reject for Telegram bot webhook compatibility
router.post("/snippets/:id/approve", async (req, res) => {
  const secret = process.env.VITE_WEBHOOK_SECRET;
  const incoming = req.headers["x-webhook-secret"];
  if (secret && incoming !== secret) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }

  const [updated] = await db
    .update(snippetsTable)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(snippetsTable.id, req.params.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }

  res.json(formatSnippet(updated));
});

router.post("/snippets/:id/reject", async (req, res) => {
  const secret = process.env.VITE_WEBHOOK_SECRET;
  const incoming = req.headers["x-webhook-secret"];
  if (secret && incoming !== secret) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }

  const reason = req.body?.reason;
  const [updated] = await db
    .update(snippetsTable)
    .set({ status: "rejected", rejectReason: reason ?? null, updatedAt: new Date() })
    .where(eq(snippetsTable.id, req.params.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }

  res.json(formatSnippet(updated));
});

export default router;
