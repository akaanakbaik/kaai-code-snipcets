/**
 * Auto-sync service:
 * - Keeps Supabase 1 & 2 alive (ping every 3 min, multiple strategies)
 * - Syncs approved snippets to both Supabase instances (every 30 min)
 * - Backs up ALL snippets to GitHub as:
 *     1. JSON dump (backup/latest.json + dated file) — every 2h
 *     2. One file per snippet in backup/snippets/ — every 2h
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
const BACKUP_GITHUB_TOKEN = process.env.VITE_BACKUP_GITHUB_TOKEN ?? GITHUB_TOKEN;
const BACKUP_GITHUB_REPO  = process.env.VITE_BACKUP_GITHUB_REPO  ?? "aka-second/code-snipset";

// Intervals
const PING_INTERVAL_MS          = 3  * 60 * 1000;   // 3 min keep-alive
const SYNC_INTERVAL_MS          = 30 * 60 * 1000;   // 30 min sync
const GITHUB_BACKUP_INTERVAL_MS = 2  * 60 * 60 * 1000; // 2h backup

type SnippetRow = {
  id: string; title: string; description: string; language: string;
  tags: string[] | null; code: string; authorName: string; authorEmail: string | null;
  status: string; rejectReason: string | null; viewCount: number | null;
  copyCount: number | null; createdAt: Date; updatedAt: Date; slug: string | null;
};

// ─── Supabase Keep-Alive ───────────────────────────────────────────────────────

async function restPing(url: string, key: string, label: string): Promise<void> {
  if (!url || !key) return;
  try {
    // Strategy 1: REST metadata ping
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8_000),
    });
    logger.info(`[sync] Supabase ${label} REST ping ${res.status}`);
  } catch (err) {
    logger.warn(`[sync] Supabase ${label} REST ping failed: ${(err as Error).message}`);
  }
}

async function directPing(pool: Pool | null, label: string): Promise<void> {
  if (!pool) return;
  const client = await pool.connect().catch(() => null);
  if (!client) return;
  try {
    await client.query("SELECT 1");
    logger.info(`[sync] Supabase ${label} direct ping OK`);
  } catch (err) {
    logger.warn(`[sync] Supabase ${label} direct ping failed: ${(err as Error).message}`);
  } finally {
    client.release();
  }
}

async function pingSupabase(): Promise<void> {
  await Promise.all([
    restPing(SUPABASE_URL_1, SUPABASE_KEY_1, "1"),
    restPing(SUPABASE_URL_2, SUPABASE_KEY_2, "2"),
    directPing(poolSupabase1, "1-direct"),
    directPing(poolSupabase2, "2-direct"),
  ]);
}

// ─── Supabase Sync ────────────────────────────────────────────────────────────

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

// ─── GitHub Helpers ───────────────────────────────────────────────────────────

async function pushToGithub(token: string, repo: string, path: string, content: string, message: string, retries = 2): Promise<void> {
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${path}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    // Get fresh SHA on every attempt (stale SHA causes 409)
    let sha: string | undefined;
    try {
      const getRes = await fetch(apiUrl, {
        headers: { Authorization: `token ${token}`, Accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(8_000),
      });
      if (getRes.ok) {
        const data = await getRes.json() as { sha?: string };
        sha = data.sha;
      }
    } catch { /* File doesn't exist */ }

    const body: Record<string, unknown> = { message, content };
    if (sha) body.sha = sha;

    const res = await fetch(apiUrl, {
      method: "PUT",
      headers: { Authorization: `token ${token}`, "Content-Type": "application/json", Accept: "application/vnd.github+json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });

    if (res.ok || res.status === 201) {
      logger.info(`[sync] GitHub pushed: ${repo}/${path}`);
      return;
    }

    if (res.status === 409 && attempt < retries) {
      // SHA conflict — wait briefly and retry with fresh SHA
      await new Promise((r) => setTimeout(r, 1_000 * (attempt + 1)));
      continue;
    }

    const text = await res.text().catch(() => "");
    logger.warn(`[sync] GitHub push failed ${repo}/${path} ${res.status}: ${text.slice(0, 120)}`);
    return;
  }
}

/** Sanitize a title to a safe filename (preserve extension-friendly chars) */
function titleToFilename(title: string, ext: string): string {
  return title
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) + "." + ext;
}

/** Map language to file extension */
function langToExt(language: string): string {
  const map: Record<string, string> = {
    javascript: "js", typescript: "ts", python: "py", java: "java",
    kotlin: "kt", swift: "swift", "c#": "cs", csharp: "cs",
    "c++": "cpp", cpp: "cpp", c: "c", go: "go", rust: "rs",
    ruby: "rb", php: "php", html: "html", css: "css", scss: "scss",
    sql: "sql", bash: "sh", shell: "sh", powershell: "ps1",
    yaml: "yaml", json: "json", xml: "xml", markdown: "md",
    dart: "dart", r: "r", lua: "lua", scala: "scala", vue: "vue",
    jsx: "jsx", tsx: "tsx",
  };
  return map[language?.toLowerCase()] ?? "txt";
}

/** Build a comment block for metadata footer based on language */
function buildMetadataComment(snippet: SnippetRow, commentStyle: "hash" | "slash" | "html"): string {
  const tags = (snippet.tags ?? []).join(", ") || "-";
  const lines = [
    ``,
    `───────────────────────────────────────────────`,
    `  📦 Kaai Code Snippets — Metadata`,
    `───────────────────────────────────────────────`,
    `  ID       : ${snippet.id}`,
    `  Slug     : ${snippet.slug ?? "-"}`,
    `  Title    : ${snippet.title}`,
    `  Author   : ${snippet.authorName}`,
    `  Language : ${snippet.language}`,
    `  Tags     : ${tags}`,
    `  Desc     : ${snippet.description}`,
    `  Views    : ${snippet.viewCount ?? 0}`,
    `  Copies   : ${snippet.copyCount ?? 0}`,
    `  Created  : ${snippet.createdAt?.toISOString().slice(0, 10) ?? "-"}`,
    `  URL      : https://codes-snippet.kaai.my.id/snippet/${snippet.slug ?? snippet.id}`,
    `───────────────────────────────────────────────`,
  ];

  if (commentStyle === "hash") return lines.map((l) => `# ${l}`).join("\n");
  if (commentStyle === "html") return `<!--\n${lines.join("\n")}\n-->`;
  return `/*\n${lines.join("\n")}\n*/`;
}

function buildSnippetFileContent(snippet: SnippetRow): string {
  const ext = langToExt(snippet.language);
  const hashLangs = new Set(["python", "ruby", "bash", "shell", "yaml", "r", "sh"]);
  const htmlLangs = new Set(["html", "xml"]);
  const commentStyle = hashLangs.has(ext) ? "hash" : htmlLangs.has(ext) ? "html" : "slash";
  const metadata = buildMetadataComment(snippet, commentStyle);
  return `${snippet.code}\n${metadata}`;
}

// ─── GitHub Backup ────────────────────────────────────────────────────────────

/** Backup individual snippet as a file to backup repo.
 *  backup/snippets/{title}.{ext} */
async function backupSnippetFile(token: string, repo: string, snippet: SnippetRow): Promise<void> {
  const ext = langToExt(snippet.language);
  const filename = titleToFilename(snippet.title, ext);
  const path = `backup/snippets/${filename}`;
  const content = buildSnippetFileContent(snippet);
  const b64 = Buffer.from(content).toString("base64");
  await pushToGithub(token, repo, path, b64, `[Backup] ${snippet.title}`);
}

/** Full backup: JSON dumps + per-snippet files */
async function backupToGithub(): Promise<void> {
  const token = BACKUP_GITHUB_TOKEN || GITHUB_TOKEN;
  if (!token) return;

  try {
    const snippets = await db.select().from(snippetsTable);
    const approved = snippets.filter((s) => s.status === "approved") as SnippetRow[];
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);

    // Primary source repo: full JSON dump
    if (GITHUB_TOKEN && GITHUB_REPO) {
      const allContent = Buffer.from(JSON.stringify(snippets, null, 2)).toString("base64");
      const filename = `backup-${dateStr}.json`;
      await pushToGithub(GITHUB_TOKEN, GITHUB_REPO, `backups/${filename}`, allContent, `Auto backup ${filename}`).catch((err) => {
        logger.warn(`[sync] Primary repo backup failed: ${(err as Error).message}`);
      });
    }

    if (!BACKUP_GITHUB_TOKEN && !GITHUB_TOKEN) return;
    const bToken = BACKUP_GITHUB_TOKEN || GITHUB_TOKEN;

    // Backup repo: JSON dump (dated + latest)
    const payload = { exportedAt: now.toISOString(), totalSnippets: snippets.length, approvedSnippets: approved.length, snippets: approved };
    const payloadB64 = Buffer.from(JSON.stringify(payload, null, 2)).toString("base64");

    await Promise.all([
      pushToGithub(bToken, BACKUP_GITHUB_REPO, `backup/snippets-${dateStr}.json`, payloadB64, `[Auto] Backup ${approved.length} snippets — ${dateStr}`),
      pushToGithub(bToken, BACKUP_GITHUB_REPO, `backup/latest.json`, payloadB64, `[Auto] Update latest.json — ${timestamp}`),
    ]).catch((err) => logger.warn(`[sync] JSON backup failed: ${(err as Error).message}`));

    // Per-snippet files — push in batches to avoid rate limiting
    const BATCH = 5;
    for (let i = 0; i < approved.length; i += BATCH) {
      const slice = approved.slice(i, i + BATCH);
      await Promise.all(slice.map((s) => backupSnippetFile(bToken, BACKUP_GITHUB_REPO, s).catch((err) => {
        logger.warn(`[sync] Per-file backup failed for "${s.title}": ${(err as Error).message}`);
      })));
      // Small delay between batches to respect GitHub rate limits
      if (i + BATCH < approved.length) await new Promise((r) => setTimeout(r, 1_500));
    }

    logger.info(`[sync] Backup repo updated: ${approved.length} snippets (JSON + per-file) → ${BACKUP_GITHUB_REPO}`);
  } catch (err) {
    logger.warn(`[sync] GitHub backup error: ${(err as Error).message}`);
  }
}

/** One-time manual backup of ALL snippets as individual files.
 *  Called once on startup, then runs automatically every 2h. */
export async function runOneTimeFileBackup(): Promise<void> {
  const token = BACKUP_GITHUB_TOKEN || GITHUB_TOKEN;
  if (!token) { logger.warn("[sync] No GitHub token for one-time backup"); return; }
  logger.info("[sync] Starting one-time per-file backup of ALL snippets...");
  try {
    const snippets = (await db.select().from(snippetsTable).where(eq(snippetsTable.status, "approved"))) as SnippetRow[];
    const BATCH = 5;
    let done = 0;
    for (let i = 0; i < snippets.length; i += BATCH) {
      const slice = snippets.slice(i, i + BATCH);
      await Promise.all(slice.map((s) => backupSnippetFile(token, BACKUP_GITHUB_REPO, s).catch((err) => {
        logger.warn(`[sync] One-time backup failed "${s.title}": ${(err as Error).message}`);
      })));
      done += slice.length;
      if (i + BATCH < snippets.length) await new Promise((r) => setTimeout(r, 2_000));
    }
    logger.info(`[sync] One-time backup complete: ${done} snippets → ${BACKUP_GITHUB_REPO}/backup/snippets/`);
  } catch (err) {
    logger.warn(`[sync] One-time backup error: ${(err as Error).message}`);
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

// ─── Start Cron ───────────────────────────────────────────────────────────────

export function startSyncCron(): void {
  ensureDbIndexes();

  // Startup: delay 15s then ping, sync, and run one-time file backup
  const startupDelay = setTimeout(async () => {
    await pingSupabase();
    await runSync();
    // Run one-time backup 30s after startup so it doesn't block boot
    setTimeout(() => {
      runOneTimeFileBackup().catch(() => {});
      backupToGithub().catch(() => {});
    }, 30_000);
  }, 15_000);

  const pingInterval  = setInterval(pingSupabase,   PING_INTERVAL_MS);
  const syncInterval  = setInterval(runSync,         SYNC_INTERVAL_MS);
  const githubInterval = setInterval(backupToGithub, GITHUB_BACKUP_INTERVAL_MS);

  logger.info("[sync] Cron started — keep-alive: 3min | sync: 30min | backup: 2h");

  process.on("SIGTERM", () => {
    clearTimeout(startupDelay);
    clearInterval(pingInterval);
    clearInterval(syncInterval);
    clearInterval(githubInterval);
  });
}
