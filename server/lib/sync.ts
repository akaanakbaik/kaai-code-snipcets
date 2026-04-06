/**
 * Auto-sync service:
 * - Keeps Supabase 1 & 2 alive (ping every 4 min)
 * - Syncs approved snippets to both Supabase instances (every 30 min)
 *   → Direct PostgreSQL first, falls back to REST API
 * - Backs up all snippets to GitHub as JSON (every 2 hours)
 */

import { db, poolSupabase1, poolSupabase2 } from "./db.js";
import { snippetsTable } from "./schema.js";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";
import type { Pool } from "pg";

const SUPABASE_URL_1  = process.env.VITE_SUPABASE_URL_1  ?? "";
const SUPABASE_KEY_1  = process.env.VITE_SUPABASE_KEY_1  ?? "";
const SUPABASE_URL_2  = process.env.VITE_SUPABASE_URL_2  ?? "";
const SUPABASE_KEY_2  = process.env.VITE_SUPABASE_KEY_2  ?? "";
const GITHUB_TOKEN    = process.env.VITE_GITHUB_TOKEN     ?? "";
const GITHUB_REPO     = process.env.VITE_GITHUB_REPO      ?? "";

const PING_INTERVAL_MS          = 4  * 60 * 1000;
const SYNC_INTERVAL_MS          = 30 * 60 * 1000;
const GITHUB_BACKUP_INTERVAL_MS = 2  * 60 * 60 * 1000;

const SUPABASE1_SYSTEM_USER_ID = "a3b80d67-bd78-4223-89af-3be743fd6b98";

type SnippetRow = {
  id: string; title: string; description: string; language: string;
  tags: string[] | null; code: string; authorName: string; authorEmail: string | null;
  status: string; rejectReason: string | null; viewCount: number | null;
  copyCount: number | null; createdAt: Date; updatedAt: Date;
};

async function restPing(url: string, key: string, label: string): Promise<void> {
  if (!url || !key) return;
  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8_000),
    });
    logger.info(`[sync] Supabase ${label} REST ping ${res.status}`);
  } catch (err) {
    logger.warn(`[sync] Supabase ${label} REST ping failed: ${(err as Error).message}`);
  }
}

async function restUpsertBatch(url: string, key: string, label: string, table: string, rows: object[], onConflict: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
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
        placeholders.push(`($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10},$${base+11})`);
        values.push(s.id, s.title, s.description, s.language, s.tags ?? [], s.code, s.authorName, s.viewCount ?? 0, s.copyCount ?? 0, s.createdAt, s.updatedAt);
      });

      await client.query(
        `INSERT INTO snippets (id,title,description,language,tags,code,author_name,view_count,copy_count,created_at,updated_at)
         VALUES ${placeholders.join(",")}
         ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title,view_count=EXCLUDED.view_count,copy_count=EXCLUDED.copy_count,updated_at=EXCLUDED.updated_at`,
        values,
      );
      synced += slice.length;
    }

    logger.info(`[sync] Supabase 1 direct sync: ${synced} snippets`);
    return true;
  } catch (err) {
    logger.warn(`[sync] Supabase 1 direct sync failed: ${(err as Error).message}`);
    return false;
  } finally {
    client.release();
  }
}

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
        const base = idx * 13;
        placeholders.push(`($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10},$${base+11},$${base+12},$${base+13})`);
        values.push(s.id, s.title, s.description, s.language, s.tags ?? [], s.code, s.authorName, s.authorEmail, s.status, s.viewCount ?? 0, s.copyCount ?? 0, s.createdAt, s.updatedAt);
      });

      await client.query(
        `INSERT INTO snippets (id,title,description,language,tags,code,author_name,author_email,status,view_count,copy_count,created_at,updated_at)
         VALUES ${placeholders.join(",")}
         ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title,status=EXCLUDED.status,view_count=EXCLUDED.view_count,copy_count=EXCLUDED.copy_count,updated_at=EXCLUDED.updated_at`,
        values,
      );
      synced += slice.length;
    }

    logger.info(`[sync] Supabase 2 direct sync: ${synced} snippets`);
    return true;
  } catch (err) {
    logger.warn(`[sync] Supabase 2 direct sync failed: ${(err as Error).message}`);
    return false;
  } finally {
    client.release();
  }
}

async function pingSupabase(): Promise<void> {
  await Promise.all([
    restPing(SUPABASE_URL_1, SUPABASE_KEY_1, "1"),
    restPing(SUPABASE_URL_2, SUPABASE_KEY_2, "2"),
  ]);
}

async function runSync(): Promise<void> {
  try {
    const snippets = await db.select().from(snippetsTable).where(eq(snippetsTable.status, "approved"));
    if (snippets.length === 0) { logger.info("[sync] No approved snippets to sync"); return; }

    const rows = snippets as SnippetRow[];

    await Promise.all([
      poolSupabase1
        ? directSyncSupabase1(poolSupabase1, rows).then((ok) => {
            if (!ok && SUPABASE_URL_1 && SUPABASE_KEY_1) {
              return restUpsertBatch(SUPABASE_URL_1, SUPABASE_KEY_1, "1", "snippets", rows.map((s) => ({
                id: s.id, title: s.title, description: s.description, language: s.language,
                tags: s.tags ?? [], code: s.code, author_name: s.authorName,
                view_count: s.viewCount ?? 0, copy_count: s.copyCount ?? 0,
              })), "id");
            }
          })
        : Promise.resolve(),
      poolSupabase2
        ? directSyncSupabase2(poolSupabase2, rows).then((ok) => {
            if (!ok && SUPABASE_URL_2 && SUPABASE_KEY_2) {
              return restUpsertBatch(SUPABASE_URL_2, SUPABASE_KEY_2, "2", "snippets", rows.map((s) => ({
                id: s.id, title: s.title, description: s.description, language: s.language,
                tags: s.tags ?? [], code: s.code, author_name: s.authorName, author_email: s.authorEmail,
                status: s.status, view_count: s.viewCount ?? 0, copy_count: s.copyCount ?? 0,
              })), "id");
            }
          })
        : Promise.resolve(),
    ]);
  } catch (err) {
    logger.warn(`[sync] runSync failed: ${(err as Error).message}`);
  }
}

async function backupToGithub(): Promise<void> {
  if (!GITHUB_TOKEN || !GITHUB_REPO) return;
  try {
    const snippets = await db.select().from(snippetsTable);
    const content = Buffer.from(JSON.stringify(snippets, null, 2)).toString("base64");
    const filename = `backup-${new Date().toISOString().slice(0, 10)}.json`;
    const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/backups/${filename}`;

    const res = await fetch(apiUrl, {
      method: "PUT",
      headers: { Authorization: `token ${GITHUB_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: `Auto backup ${filename}`, content }),
      signal: AbortSignal.timeout(15_000),
    });

    if (res.ok || res.status === 201) {
      logger.info(`[sync] GitHub backup created: ${filename}`);
    } else {
      const text = await res.text().catch(() => "");
      logger.warn(`[sync] GitHub backup failed ${res.status}: ${text.slice(0, 120)}`);
    }
  } catch (err) {
    logger.warn(`[sync] GitHub backup error: ${(err as Error).message}`);
  }
}

async function ensureDbIndexes(): Promise<void> {
  try {
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_snippets_status ON snippets(status);
      CREATE INDEX IF NOT EXISTS idx_snippets_view_count ON snippets(view_count DESC);
      CREATE INDEX IF NOT EXISTS idx_snippets_created_at ON snippets(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_snippets_status_created ON snippets(status, created_at DESC);
    ` as any);
    logger.info("[sync] DB indexes ensured");
  } catch (err) {
    logger.warn(`[sync] DB index creation: ${(err as Error).message}`);
  }
}

export function startSyncCron(): void {
  ensureDbIndexes();

  const startupDelay = setTimeout(async () => {
    await pingSupabase();
    await runSync();
    await backupToGithub();
  }, 10_000);

  const pingInterval = setInterval(pingSupabase, PING_INTERVAL_MS);
  const syncInterval = setInterval(runSync, SYNC_INTERVAL_MS);
  const githubInterval = setInterval(backupToGithub, GITHUB_BACKUP_INTERVAL_MS);

  logger.info("[sync] Cron started — Supabase keep-alive: 4min | Sync: 30min | GitHub backup: 2h");

  process.on("SIGTERM", () => {
    clearTimeout(startupDelay);
    clearInterval(pingInterval);
    clearInterval(syncInterval);
    clearInterval(githubInterval);
  });
}
