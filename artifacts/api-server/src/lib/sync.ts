/**
 * Auto-sync service:
 * - Keeps Supabase 1 & 2 alive (ping every 4 min)
 * - Syncs approved snippets to both Supabase instances (every 30 min)
 * - Backs up all snippets to GitHub as JSON (every 2 hours)
 */

import { db, snippetsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const SUPABASE_URL_1 = process.env.VITE_SUPABASE_URL_1 ?? "";
const SUPABASE_KEY_1 = process.env.VITE_SUPABASE_KEY_1 ?? "";
const SUPABASE_URL_2 = process.env.VITE_SUPABASE_URL_2 ?? "";
const SUPABASE_KEY_2 = process.env.VITE_SUPABASE_KEY_2 ?? "";
const GITHUB_TOKEN = process.env.VITE_GITHUB_TOKEN ?? "";
const GITHUB_REPO = process.env.VITE_GITHUB_REPO ?? "";

const PING_INTERVAL_MS = 4 * 60 * 1000; // 4 minutes
const SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const GITHUB_BACKUP_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours

// ─── Supabase helpers ────────────────────────────────────────────────────────

async function supabasePing(url: string, key: string, label: string) {
  if (!url || !key) return;
  try {
    const res = await fetch(`${url}/rest/v1/snippets?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok || res.status === 404) {
      logger.info(`[sync] Supabase ${label} ping OK`);
    } else {
      logger.warn(`[sync] Supabase ${label} ping returned ${res.status}`);
    }
  } catch (err) {
    logger.warn(`[sync] Supabase ${label} ping failed: ${(err as Error).message}`);
  }
}

async function ensureSupabaseTable(url: string, key: string, label: string) {
  if (!url || !key) return;
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS snippets (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      language TEXT NOT NULL,
      tags TEXT[] DEFAULT '{}',
      code TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_email TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      reject_reason TEXT,
      view_count INTEGER NOT NULL DEFAULT 0,
      copy_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  try {
    await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: createTableSQL }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    // Table may already exist or RPC not available, continue
  }
}

async function upsertBatchToTable(
  url: string,
  key: string,
  label: string,
  tableName: string,
  batch: object[],
  onConflict?: string,
): Promise<boolean> {
  const endpoint = onConflict
    ? `${url}/rest/v1/${tableName}?on_conflict=${onConflict}`
    : `${url}/rest/v1/${tableName}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(batch),
    signal: AbortSignal.timeout(20000),
  });
  if (res.ok || res.status === 201) return true;
  const text = await res.text().catch(() => "");
  logger.warn(`[sync] Supabase ${label} table="${tableName}" ${res.status}: ${text.slice(0, 180)}`);
  return false;
}

async function syncToSupabase(url: string, key: string, label: string) {
  if (!url || !key) return;
  try {
    const snippets = await db
      .select()
      .from(snippetsTable)
      .where(eq(snippetsTable.status, "approved"));

    if (snippets.length === 0) return;

    const BATCH = 50;
    let synced = 0;
    for (let i = 0; i < snippets.length; i += BATCH) {
      // Full payload (for our "snippets" table)
      const fullBatch = snippets.slice(i, i + BATCH).map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        language: s.language,
        tags: s.tags ?? [],
        code: s.code,
        author_name: s.authorName,
        author_email: s.authorEmail,
        status: s.status,
        reject_reason: s.rejectReason ?? null,
        view_count: s.viewCount ?? 0,
        copy_count: s.copyCount ?? 0,
        created_at: s.createdAt.toISOString(),
        updated_at: s.updatedAt.toISOString(),
      }));

      // Payload mapped to "snippet_metadata" table schema (Supabase 1).
      // user_id uses the kaai-system user created on first sync.
      const SUPABASE1_SYSTEM_USER_ID = "a3b80d67-bd78-4223-89af-3be743fd6b98";
      const metaBatch = snippets.slice(i, i + BATCH).map((s) => ({
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

      // Try "snippets" table first (upsert on id), then "snippet_metadata" (upsert on snippet_unique_id)
      let ok = await upsertBatchToTable(url, key, label, "snippets", fullBatch, "id");
      if (!ok) {
        ok = await upsertBatchToTable(url, key, label, "snippet_metadata", metaBatch, "snippet_unique_id");
      }
      if (ok) synced += snippets.slice(i, i + BATCH).length;
    }

    logger.info(`[sync] Supabase ${label} synced ${synced}/${snippets.length} snippets`);
  } catch (err) {
    logger.warn(`[sync] Supabase ${label} sync failed: ${(err as Error).message}`);
  }
}

// ─── GitHub helpers ───────────────────────────────────────────────────────────

async function getGithubFileSha(repo: string, path: string, token: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      headers: {
        Authorization: `token ${token}`,
        "User-Agent": "kaai-code-snippet-backup",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const data = await res.json() as { sha?: string };
    return data.sha ?? null;
  } catch {
    return null;
  }
}

async function backupToGithub() {
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
        // NOTE: code and authorEmail included for full backup
        code: s.code,
        authorEmail: s.authorEmail,
      })),
    };

    const content = Buffer.from(JSON.stringify(payload, null, 2)).toString("base64");
    const path = "backup/snippets.json";
    const sha = await getGithubFileSha(GITHUB_REPO, path, GITHUB_TOKEN);

    const body: Record<string, unknown> = {
      message: `backup: auto sync ${new Date().toISOString().slice(0, 16)}`,
      content,
      committer: { name: "Kaai Bot", email: "kaai-bot@akadev.me" },
    };
    if (sha) body.sha = sha;

    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": "kaai-code-snippet-backup",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });

    if (res.ok || res.status === 201) {
      logger.info(`[sync] GitHub backup OK — ${snippets.length} snippets → ${GITHUB_REPO}/${path}`);
    } else {
      const text = await res.text().catch(() => "");
      logger.warn(`[sync] GitHub backup failed ${res.status}: ${text.slice(0, 300)}`);
    }
  } catch (err) {
    logger.warn(`[sync] GitHub backup error: ${(err as Error).message}`);
  }
}

// ─── DB index optimization ────────────────────────────────────────────────────

async function ensureDbIndexes() {
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

export function startSyncCron() {
  // Ensure DB indexes on startup
  ensureDbIndexes();

  // Initial sync on startup (after 10 seconds)
  const startupDelay = setTimeout(async () => {
    await supabasePing(SUPABASE_URL_1, SUPABASE_KEY_1, "1");
    await supabasePing(SUPABASE_URL_2, SUPABASE_KEY_2, "2");
    await syncToSupabase(SUPABASE_URL_1, SUPABASE_KEY_1, "1");
    await syncToSupabase(SUPABASE_URL_2, SUPABASE_KEY_2, "2");
    await backupToGithub();
  }, 10_000);

  // Keep-alive pings every 4 minutes
  const pingInterval = setInterval(async () => {
    await supabasePing(SUPABASE_URL_1, SUPABASE_KEY_1, "1");
    await supabasePing(SUPABASE_URL_2, SUPABASE_KEY_2, "2");
  }, PING_INTERVAL_MS);

  // Full data sync every 30 minutes
  const syncInterval = setInterval(async () => {
    await syncToSupabase(SUPABASE_URL_1, SUPABASE_KEY_1, "1");
    await syncToSupabase(SUPABASE_URL_2, SUPABASE_KEY_2, "2");
  }, SYNC_INTERVAL_MS);

  // GitHub backup every 2 hours
  const githubInterval = setInterval(backupToGithub, GITHUB_BACKUP_INTERVAL_MS);

  logger.info("[sync] Cron started — Supabase keep-alive: 4min | Sync: 30min | GitHub backup: 2h");

  // Graceful shutdown
  process.on("SIGTERM", () => {
    clearTimeout(startupDelay);
    clearInterval(pingInterval);
    clearInterval(syncInterval);
    clearInterval(githubInterval);
  });
}
