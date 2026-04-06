/**
 * Auto-sync service:
 * - Keeps Supabase 1 & 2 alive (ping every 4 min)
 * - Syncs approved snippets to both Supabase instances (every 30 min)
 *   → Tries direct PostgreSQL connection first (DATABASE_URL_SUPABASE_1/2)
 *   → Falls back to REST API (VITE_SUPABASE_URL_1/2 + VITE_SUPABASE_KEY_1/2)
 * - Backs up all snippets to GitHub as JSON (every 2 hours)
 */

import { db, snippetsTable, poolSupabase1, poolSupabase2 } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import type { Pool } from "pg";

// ─── Environment ─────────────────────────────────────────────────────────────

const SUPABASE_URL_1  = process.env.VITE_SUPABASE_URL_1  ?? "";
const SUPABASE_KEY_1  = process.env.VITE_SUPABASE_KEY_1  ?? "";
const SUPABASE_URL_2  = process.env.VITE_SUPABASE_URL_2  ?? "";
const SUPABASE_KEY_2  = process.env.VITE_SUPABASE_KEY_2  ?? "";
const GITHUB_TOKEN    = process.env.VITE_GITHUB_TOKEN     ?? "";
const GITHUB_REPO     = process.env.VITE_GITHUB_REPO      ?? "";

const PING_INTERVAL_MS         = 4  * 60 * 1000;  // 4 minutes
const SYNC_INTERVAL_MS         = 30 * 60 * 1000;  // 30 minutes
const GITHUB_BACKUP_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours

// Fixed system user_id for Supabase 1 (matches the Kaai System user created there)
const SUPABASE1_SYSTEM_USER_ID = "a3b80d67-bd78-4223-89af-3be743fd6b98";

// ─── Types ────────────────────────────────────────────────────────────────────

type SnippetRow = {
  id: string;
  title: string;
  description: string;
  language: string;
  tags: string[] | null;
  code: string;
  authorName: string;
  authorEmail: string | null;
  status: string;
  rejectReason: string | null;
  viewCount: number | null;
  copyCount: number | null;
  createdAt: Date;
  updatedAt: Date;
};

// ─── REST API helpers ─────────────────────────────────────────────────────────

async function restPing(url: string, key: string, label: string): Promise<void> {
  if (!url || !key) return;
  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok || res.status === 200 || res.status === 404) {
      logger.info(`[sync] Supabase ${label} REST ping OK`);
    } else {
      logger.warn(`[sync] Supabase ${label} REST ping ${res.status}`);
    }
  } catch (err) {
    logger.warn(`[sync] Supabase ${label} REST ping failed: ${(err as Error).message}`);
  }
}

async function restUpsertBatch(
  url: string,
  key: string,
  label: string,
  table: string,
  rows: object[],
  onConflict: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${url}/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
      signal: AbortSignal.timeout(20_000),
    });
    if (res.ok || res.status === 201) return true;
    const text = await res.text().catch(() => "");
    logger.warn(`[sync] Supabase ${label} REST ${table} ${res.status}: ${text.slice(0, 180)}`);
    return false;
  } catch (err) {
    logger.warn(`[sync] Supabase ${label} REST ${table} error: ${(err as Error).message}`);
    return false;
  }
}

// ─── Direct PostgreSQL helpers (Supabase 1) ───────────────────────────────────

async function directSyncSupabase1(pool: Pool, snippets: SnippetRow[]): Promise<boolean> {
  const client = await pool.connect().catch(() => null);
  if (!client) return false;

  try {
    const BATCH = 50;
    let synced = 0;

    for (let i = 0; i < snippets.length; i += BATCH) {
      const slice = snippets.slice(i, i + BATCH);
      const values: unknown[] = [];
      const placeholders: string[] = [];

      slice.forEach((s, idx) => {
        const base = idx * 11;
        placeholders.push(
          `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11})`
        );
        values.push(
          s.id,                                    // snippet_unique_id
          SUPABASE1_SYSTEM_USER_ID,                // user_id
          s.authorEmail ?? "",                     // author_email
          s.authorName,                            // author_name
          s.title,                                 // title
          s.description,                           // description
          s.language,                              // language
          JSON.stringify(s.tags ?? []),            // tags (json)
          s.status,                                // status
          s.rejectReason ?? null,                  // reject_reason
          s.updatedAt.toISOString(),               // updated_at
        );
      });

      await client.query(
        `INSERT INTO snippet_metadata
          (snippet_unique_id, user_id, author_email, author_name, title, description,
           language, tags, status, reject_reason, updated_at)
         VALUES ${placeholders.join(",")}
         ON CONFLICT (snippet_unique_id) DO UPDATE SET
           user_id      = EXCLUDED.user_id,
           author_email = EXCLUDED.author_email,
           author_name  = EXCLUDED.author_name,
           title        = EXCLUDED.title,
           description  = EXCLUDED.description,
           language     = EXCLUDED.language,
           tags         = EXCLUDED.tags,
           status       = EXCLUDED.status,
           reject_reason = EXCLUDED.reject_reason,
           updated_at   = EXCLUDED.updated_at`,
        values
      );
      synced += slice.length;
    }

    logger.info(`[sync] Supabase 1 (direct) synced ${synced}/${snippets.length}`);
    return true;
  } catch (err) {
    logger.warn(`[sync] Supabase 1 direct sync error: ${(err as Error).message}`);
    return false;
  } finally {
    client.release();
  }
}

// ─── Direct PostgreSQL helpers (Supabase 2) ───────────────────────────────────

async function directSyncSupabase2(pool: Pool, snippets: SnippetRow[]): Promise<boolean> {
  const client = await pool.connect().catch(() => null);
  if (!client) return false;

  try {
    const BATCH = 50;
    let synced = 0;

    for (let i = 0; i < snippets.length; i += BATCH) {
      const slice = snippets.slice(i, i + BATCH);
      const values: unknown[] = [];
      const placeholders: string[] = [];

      slice.forEach((s, idx) => {
        const base = idx * 14;
        placeholders.push(
          `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11},$${base + 12},$${base + 13},$${base + 14})`
        );
        values.push(
          s.id,
          s.title,
          s.description,
          s.language,
          JSON.stringify(s.tags ?? []),
          s.code,
          s.authorName,
          s.authorEmail ?? "",
          s.status,
          s.rejectReason ?? null,
          s.viewCount ?? 0,
          s.copyCount ?? 0,
          s.createdAt.toISOString(),
          s.updatedAt.toISOString(),
        );
      });

      await client.query(
        `INSERT INTO snippets
          (id, title, description, language, tags, code, author_name, author_email,
           status, reject_reason, view_count, copy_count, created_at, updated_at)
         VALUES ${placeholders.join(",")}
         ON CONFLICT (id) DO UPDATE SET
           title        = EXCLUDED.title,
           description  = EXCLUDED.description,
           language     = EXCLUDED.language,
           tags         = EXCLUDED.tags,
           code         = EXCLUDED.code,
           author_name  = EXCLUDED.author_name,
           author_email = EXCLUDED.author_email,
           status       = EXCLUDED.status,
           reject_reason = EXCLUDED.reject_reason,
           view_count   = EXCLUDED.view_count,
           copy_count   = EXCLUDED.copy_count,
           updated_at   = EXCLUDED.updated_at`,
        values
      );
      synced += slice.length;
    }

    logger.info(`[sync] Supabase 2 (direct) synced ${synced}/${snippets.length}`);
    return true;
  } catch (err) {
    logger.warn(`[sync] Supabase 2 direct sync error: ${(err as Error).message}`);
    return false;
  } finally {
    client.release();
  }
}

// ─── REST API fallback sync ───────────────────────────────────────────────────

async function restSyncSupabase1(snippets: SnippetRow[]): Promise<void> {
  if (!SUPABASE_URL_1 || !SUPABASE_KEY_1) return;

  const BATCH = 50;
  let synced = 0;

  for (let i = 0; i < snippets.length; i += BATCH) {
    const slice = snippets.slice(i, i + BATCH);
    const metaBatch = slice.map((s) => ({
      snippet_unique_id: s.id,
      user_id: SUPABASE1_SYSTEM_USER_ID,
      author_email: s.authorEmail ?? "",
      author_name: s.authorName,
      title: s.title,
      description: s.description,
      language: s.language,
      tags: s.tags ?? [],
      status: s.status,
      reject_reason: s.rejectReason ?? null,
      created_at: s.createdAt.toISOString(),
      updated_at: s.updatedAt.toISOString(),
    }));

    const ok = await restUpsertBatch(
      SUPABASE_URL_1, SUPABASE_KEY_1, "1",
      "snippet_metadata", metaBatch, "snippet_unique_id",
    );
    if (ok) synced += slice.length;
  }

  logger.info(`[sync] Supabase 1 (REST fallback) synced ${synced}/${snippets.length}`);
}

async function restSyncSupabase2(snippets: SnippetRow[]): Promise<void> {
  if (!SUPABASE_URL_2 || !SUPABASE_KEY_2) return;

  const BATCH = 50;
  let synced = 0;

  for (let i = 0; i < snippets.length; i += BATCH) {
    const slice = snippets.slice(i, i + BATCH);
    const fullBatch = slice.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      language: s.language,
      tags: s.tags ?? [],
      code: s.code,
      author_name: s.authorName,
      author_email: s.authorEmail ?? "",
      status: s.status,
      reject_reason: s.rejectReason ?? null,
      view_count: s.viewCount ?? 0,
      copy_count: s.copyCount ?? 0,
      created_at: s.createdAt.toISOString(),
      updated_at: s.updatedAt.toISOString(),
    }));

    const ok = await restUpsertBatch(
      SUPABASE_URL_2, SUPABASE_KEY_2, "2",
      "snippets", fullBatch, "id",
    );
    if (ok) synced += slice.length;
  }

  logger.info(`[sync] Supabase 2 (REST fallback) synced ${synced}/${snippets.length}`);
}

// ─── Main sync orchestrator ───────────────────────────────────────────────────

async function syncToSupabase1(snippets: SnippetRow[]): Promise<void> {
  if (snippets.length === 0) return;

  // Try direct PostgreSQL first
  if (poolSupabase1) {
    const ok = await directSyncSupabase1(poolSupabase1, snippets);
    if (ok) return;
    logger.warn("[sync] Supabase 1 direct failed — falling back to REST API");
  }

  // Fall back to REST API
  await restSyncSupabase1(snippets);
}

async function syncToSupabase2(snippets: SnippetRow[]): Promise<void> {
  if (snippets.length === 0) return;

  // Try direct PostgreSQL first
  if (poolSupabase2) {
    const ok = await directSyncSupabase2(poolSupabase2, snippets);
    if (ok) return;
    logger.warn("[sync] Supabase 2 direct failed — falling back to REST API");
  }

  // Fall back to REST API
  await restSyncSupabase2(snippets);
}

// ─── Keep-alive ping (REST only — lightweight) ────────────────────────────────

async function pingSupabase(): Promise<void> {
  await Promise.allSettled([
    restPing(SUPABASE_URL_1, SUPABASE_KEY_1, "1"),
    restPing(SUPABASE_URL_2, SUPABASE_KEY_2, "2"),
  ]);
}

// ─── Full sync job ─────────────────────────────────────────────────────────────

async function runSync(): Promise<void> {
  try {
    const snippets = await db
      .select()
      .from(snippetsTable)
      .where(eq(snippetsTable.status, "approved"));

    logger.info(`[sync] Fetched ${snippets.length} approved snippets for sync`);

    await Promise.allSettled([
      syncToSupabase1(snippets),
      syncToSupabase2(snippets),
    ]);
  } catch (err) {
    logger.warn(`[sync] Sync run error: ${(err as Error).message}`);
  }
}

// ─── GitHub backup ─────────────────────────────────────────────────────────────

async function getGithubFileSha(repo: string, filePath: string, token: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
      headers: { Authorization: `token ${token}`, "User-Agent": "kaai-code-snippet-backup" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { sha?: string };
    return data.sha ?? null;
  } catch {
    return null;
  }
}

async function backupToGithub(): Promise<void> {
  if (!GITHUB_TOKEN || !GITHUB_REPO) return;
  try {
    const snippets = await db.select().from(snippetsTable);
    const payload = {
      exportedAt: new Date().toISOString(),
      count: snippets.length,
      snippets: snippets.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        language: s.language,
        tags: s.tags,
        authorName: s.authorName,
        status: s.status,
        viewCount: s.viewCount,
        copyCount: s.copyCount,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        code: s.code,
        authorEmail: s.authorEmail,
      })),
    };

    const content = Buffer.from(JSON.stringify(payload, null, 2)).toString("base64");
    const filePath = "backup/snippets.json";
    const sha = await getGithubFileSha(GITHUB_REPO, filePath, GITHUB_TOKEN);

    const body: Record<string, unknown> = {
      message: `backup: auto sync ${new Date().toISOString().slice(0, 16)}`,
      content,
      committer: { name: "Kaai Bot", email: "kaai-bot@akadev.me" },
    };
    if (sha) body.sha = sha;

    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`, {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": "kaai-code-snippet-backup",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });

    if (res.ok || res.status === 201) {
      logger.info(`[sync] GitHub backup OK — ${snippets.length} snippets → ${GITHUB_REPO}/${filePath}`);
    } else {
      const text = await res.text().catch(() => "");
      logger.warn(`[sync] GitHub backup failed ${res.status}: ${text.slice(0, 300)}`);
    }
  } catch (err) {
    logger.warn(`[sync] GitHub backup error: ${(err as Error).message}`);
  }
}

// ─── DB index optimization ────────────────────────────────────────────────────

async function ensureDbIndexes(): Promise<void> {
  try {
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_snippets_status ON snippets(status);
      CREATE INDEX IF NOT EXISTS idx_snippets_view_count ON snippets(view_count DESC);
      CREATE INDEX IF NOT EXISTS idx_snippets_created_at ON snippets(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_snippets_title ON snippets(title);
      CREATE INDEX IF NOT EXISTS idx_snippets_language ON snippets(language);
      CREATE INDEX IF NOT EXISTS idx_snippets_status_created ON snippets(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_snippets_status_views ON snippets(status, view_count DESC);
    `);
    logger.info("[sync] DB indexes ensured");
  } catch (err) {
    logger.warn(`[sync] DB index creation: ${(err as Error).message}`);
  }
}

// ─── Main cron loop ───────────────────────────────────────────────────────────

export function startSyncCron(): void {
  // Ensure DB indexes on startup
  ensureDbIndexes();

  // Initial sync on startup (after 10 seconds — let server settle first)
  const startupDelay = setTimeout(async () => {
    await pingSupabase();
    await runSync();
    await backupToGithub();
  }, 10_000);

  // Keep-alive pings every 4 minutes
  const pingInterval = setInterval(pingSupabase, PING_INTERVAL_MS);

  // Full data sync every 30 minutes
  const syncInterval = setInterval(runSync, SYNC_INTERVAL_MS);

  // GitHub backup every 2 hours
  const githubInterval = setInterval(backupToGithub, GITHUB_BACKUP_INTERVAL_MS);

  logger.info(
    `[sync] Cron started — ` +
    `Supabase keep-alive: 4min | Sync: 30min (direct+REST fallback) | GitHub backup: 2h`
  );

  // Graceful shutdown
  process.on("SIGTERM", () => {
    clearTimeout(startupDelay);
    clearInterval(pingInterval);
    clearInterval(syncInterval);
    clearInterval(githubInterval);
  });
}
