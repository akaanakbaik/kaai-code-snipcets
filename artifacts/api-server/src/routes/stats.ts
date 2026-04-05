import { Router } from "express";
import { db, snippetsTable } from "@workspace/db";
import { eq, count, countDistinct, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router = Router();

function formatSnippet(snippet: typeof snippetsTable.$inferSelect) {
  return {
    ...snippet,
    tags: snippet.tags ?? [],
    createdAt: snippet.createdAt.toISOString(),
    updatedAt: snippet.updatedAt.toISOString(),
  };
}

// GET /api/stats
router.get("/stats", async (_req, res) => {
  const [total, pending, approved, rejected, authors, languages] = await Promise.all([
    db.select({ count: count() }).from(snippetsTable),
    db.select({ count: count() }).from(snippetsTable).where(eq(snippetsTable.status, "pending")),
    db.select({ count: count() }).from(snippetsTable).where(eq(snippetsTable.status, "approved")),
    db.select({ count: count() }).from(snippetsTable).where(eq(snippetsTable.status, "rejected")),
    db.select({ count: countDistinct(snippetsTable.authorEmail) }).from(snippetsTable),
    db
      .selectDistinct({ language: snippetsTable.language })
      .from(snippetsTable)
      .where(eq(snippetsTable.status, "approved")),
  ]);

  res.json({
    totalSnippets: Number(total[0]?.count ?? 0),
    pendingSnippets: Number(pending[0]?.count ?? 0),
    approvedSnippets: Number(approved[0]?.count ?? 0),
    rejectedSnippets: Number(rejected[0]?.count ?? 0),
    totalAuthors: Number(authors[0]?.count ?? 0),
    totalLanguages: languages.length,
  });
});

// GET /api/stats/languages
router.get("/stats/languages", async (_req, res) => {
  const rows = await db
    .select({
      language: snippetsTable.language,
      count: count(),
    })
    .from(snippetsTable)
    .where(eq(snippetsTable.status, "approved"))
    .groupBy(snippetsTable.language)
    .orderBy(desc(count()));

  res.json(rows.map((r) => ({ language: r.language, count: Number(r.count) })));
});

// GET /api/stats/recent
router.get("/stats/recent", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 5, 20);

  const rows = await db
    .select()
    .from(snippetsTable)
    .where(eq(snippetsTable.status, "approved"))
    .orderBy(desc(snippetsTable.createdAt))
    .limit(limit);

  res.json(rows.map(formatSnippet));
});

export default router;
