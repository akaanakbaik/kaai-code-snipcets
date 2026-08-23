import { Router } from "express";
import { db } from "../lib/db.js";
import { snippetsTable } from "../lib/schema.js";
import { eq, count, desc, sum, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const router = Router();

function formatSnippet(snippet: typeof snippetsTable.$inferSelect) {
  return {
    ...snippet,
    slug: snippet.slug,
    tags: snippet.tags ?? [],
    createdAt: snippet.createdAt.toISOString(),
    updatedAt: snippet.updatedAt.toISOString(),
  };
}

// GET /api/stats — main statistics
router.get("/stats", async (_req, res) => {
  try {
    const [summary] = await db.select({
      totalSnippets: count(),
      pendingSnippets: sql<number>`COUNT(*) FILTER (WHERE ${snippetsTable.status} = 'pending')`,
      approvedSnippets: sql<number>`COUNT(*) FILTER (WHERE ${snippetsTable.status} = 'approved')`,
      rejectedSnippets: sql<number>`COUNT(*) FILTER (WHERE ${snippetsTable.status} = 'rejected')`,
      totalAuthors: sql<number>`COUNT(DISTINCT ${snippetsTable.authorEmail}) FILTER (WHERE ${snippetsTable.status} = 'approved')`,
      totalLanguages: sql<number>`COUNT(DISTINCT ${snippetsTable.language}) FILTER (WHERE ${snippetsTable.status} = 'approved')`,
      totalViews: sql<number>`COALESCE(SUM(${snippetsTable.viewCount}) FILTER (WHERE ${snippetsTable.status} = 'approved'), 0)`,
      totalCopies: sql<number>`COALESCE(SUM(${snippetsTable.copyCount}) FILTER (WHERE ${snippetsTable.status} = 'approved'), 0)`,
    }).from(snippetsTable);

    res.json({
      totalSnippets: Number(summary?.totalSnippets ?? 0),
      pendingSnippets: Number(summary?.pendingSnippets ?? 0),
      approvedSnippets: Number(summary?.approvedSnippets ?? 0),
      rejectedSnippets: Number(summary?.rejectedSnippets ?? 0),
      totalAuthors: Number(summary?.totalAuthors ?? 0),
      totalLanguages: Number(summary?.totalLanguages ?? 0),
      totalViews: Number(summary?.totalViews ?? 0),
      totalCopies: Number(summary?.totalCopies ?? 0),
    });
  } catch (err) {
    logger.error({ err }, "[stats] GET /api/stats failed");
    res.status(500).json({ error: "DB_ERROR", message: "Gagal mengambil statistik" });
  }
});

// GET /api/stats/languages — breakdown per language
router.get("/stats/languages", async (_req, res) => {
  try {
    const rows = await db
      .select({ language: snippetsTable.language, count: count() })
      .from(snippetsTable)
      .where(eq(snippetsTable.status, "approved"))
      .groupBy(snippetsTable.language)
      .orderBy(desc(count()));

    res.json(rows.map((r) => ({ language: r.language, count: Number(r.count) })));
  } catch (err) {
    logger.error({ err }, "[stats] GET /api/stats/languages failed");
    res.status(500).json({ error: "DB_ERROR", message: "Gagal mengambil statistik bahasa" });
  }
});

// GET /api/stats/recent — recent approved snippets
router.get("/stats/recent", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 5, 20);
    const rows = await db
      .select()
      .from(snippetsTable)
      .where(eq(snippetsTable.status, "approved"))
      .orderBy(desc(snippetsTable.createdAt))
      .limit(limit);

    res.json(rows.map(formatSnippet));
  } catch (err) {
    logger.error({ err }, "[stats] GET /api/stats/recent failed");
    res.status(500).json({ error: "DB_ERROR", message: "Gagal mengambil snippet terbaru" });
  }
});

// GET /api/stats/top-authors — top contributors by snippet count
router.get("/stats/top-authors", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const rows = await db
      .select({
        authorName: snippetsTable.authorName,
        count: count(),
        totalViews: sum(snippetsTable.viewCount),
        totalCopies: sum(snippetsTable.copyCount),
      })
      .from(snippetsTable)
      .where(eq(snippetsTable.status, "approved"))
      .groupBy(snippetsTable.authorName)
      .orderBy(desc(count()))
      .limit(limit);

    res.json(rows.map((r) => ({
      authorName: r.authorName,
      snippetCount: Number(r.count),
      totalViews: Number(r.totalViews ?? 0),
      totalCopies: Number(r.totalCopies ?? 0),
    })));
  } catch (err) {
    logger.error({ err }, "[stats] GET /api/stats/top-authors failed");
    res.status(500).json({ error: "DB_ERROR", message: "Gagal mengambil data author" });
  }
});

// GET /api/stats/tags — top tags with counts
router.get("/stats/tags", async (req, res) => {
  try {
    const requestedLimit = Number(req.query.limit) || 20;
    const limit = Math.min(Math.max(requestedLimit, 1), 1000);
    const result = await db.execute(sql`
      SELECT tag, COUNT(*)::int AS count
      FROM snippets AS s
      CROSS JOIN LATERAL unnest(s.tags) AS tag
      WHERE s.status = 'approved'
      GROUP BY tag
      ORDER BY count DESC, tag ASC
      LIMIT ${limit}
    `);
    const rows = ((result as any).rows ?? result) as Array<{ tag: string; count: number | string }>;
    res.json(rows.map((row) => ({ tag: row.tag, count: Number(row.count) })));
  } catch (err) {
    logger.error({ err }, "[stats] GET /api/stats/tags failed");
    res.status(500).json({ error: "DB_ERROR", message: "Gagal mengambil data tag" });
  }
});

// GET /api/stats/top-viewed — most viewed snippets
router.get("/stats/top-viewed", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const rows = await db
      .select()
      .from(snippetsTable)
      .where(eq(snippetsTable.status, "approved"))
      .orderBy(desc(snippetsTable.viewCount))
      .limit(limit);

    res.json(rows.map(formatSnippet));
  } catch (err) {
    logger.error({ err }, "[stats] GET /api/stats/top-viewed failed");
    res.status(500).json({ error: "DB_ERROR", message: "Gagal mengambil data views" });
  }
});

// GET /api/stats/top-copied — most copied snippets
router.get("/stats/top-copied", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const rows = await db
      .select()
      .from(snippetsTable)
      .where(eq(snippetsTable.status, "approved"))
      .orderBy(desc(snippetsTable.copyCount))
      .limit(limit);

    res.json(rows.map(formatSnippet));
  } catch (err) {
    logger.error({ err }, "[stats] GET /api/stats/top-copied failed");
    res.status(500).json({ error: "DB_ERROR", message: "Gagal mengambil data salinan" });
  }
});

// GET /api/stats/timeline — monthly submission counts for last 12 months
router.get("/stats/timeline", async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM') AS month,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'approved')::int AS approved
      FROM snippets
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY month
      ORDER BY month ASC
    `) as any;
    res.json(result?.rows ?? result ?? []);
  } catch (err) {
    logger.error({ err }, "[stats] GET /api/stats/timeline failed");
    res.status(500).json({ error: "DB_ERROR", message: "Gagal mengambil data timeline" });
  }
});

// GET /api/stats/engagement — avg views, copies, engagement metrics
router.get("/stats/engagement", async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COALESCE(AVG(view_count), 0)::float AS avg_views,
        COALESCE(AVG(copy_count), 0)::float AS avg_copies,
        COALESCE(SUM(view_count), 0)::int AS total_views,
        COALESCE(SUM(copy_count), 0)::int AS total_copies,
        COALESCE(
          CASE WHEN SUM(view_count) > 0
            THEN (SUM(copy_count)::float / SUM(view_count)::float) * 100
            ELSE 0 END,
          0
        )::float AS engagement_rate,
        MAX(view_count)::int AS max_views,
        MAX(copy_count)::int AS max_copies
      FROM snippets
      WHERE status = 'approved'
    `) as any;
    const data = result?.rows?.[0] ?? result?.[0] ?? {};
    res.json({
      totalSnippets: Number(data?.total ?? 0),
      avgViews: Math.round(Number(data?.avg_views ?? 0) * 10) / 10,
      avgCopies: Math.round(Number(data?.avg_copies ?? 0) * 10) / 10,
      totalViews: Number(data?.total_views ?? 0),
      totalCopies: Number(data?.total_copies ?? 0),
      engagementRate: Math.round(Number(data?.engagement_rate ?? 0) * 10) / 10,
      maxViews: Number(data?.max_views ?? 0),
      maxCopies: Number(data?.max_copies ?? 0),
    });
  } catch (err) {
    logger.error({ err }, "[stats] GET /api/stats/engagement failed");
    res.status(500).json({ error: "DB_ERROR", message: "Gagal mengambil data engagement" });
  }
});

// GET /api/stats/trending — snippets with high recent engagement (views+copies in last 7d)
router.get("/stats/trending", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 5, 20);
    const rows = await db
      .select()
      .from(snippetsTable)
      .where(eq(snippetsTable.status, "approved"))
      .orderBy(desc(sql`(${snippetsTable.viewCount} + ${snippetsTable.copyCount} * 3)`))
      .limit(limit);
    res.json(rows.map(formatSnippet));
  } catch (err) {
    logger.error({ err }, "[stats] GET /api/stats/trending failed");
    res.status(500).json({ error: "DB_ERROR" });
  }
});

export default router;
