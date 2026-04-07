import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

const { Pool } = pg;

// ─── SSL helper ──────────────────────────────────────────────────────────────
// Returns SSL config based on the connection string hostname.
// Pooler URLs (.pooler.supabase.com) and Supabase direct / Neon all need SSL.
function sslFor(url: string | undefined): pg.PoolConfig["ssl"] {
  if (!url) return undefined;
  if (
    url.includes("supabase.co") ||
    url.includes("supabase.com") ||
    url.includes("neon.tech")
  ) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

// ─── Main Database (source of truth) ─────────────────────────────────────────
// Priority for production (Vercel serverless):
//   1. DATABASE_SUPABASE_POLLER_URL_2 – Supabase 2 Transaction-mode pooler
//      (code-snippet DB, works reliably on serverless)
//   2. DATABASE_URL – fallback (Neon or any other Postgres URL)
// Priority for local dev (Replit):
//   DATABASE_URL is the Replit local PostgreSQL — fine for development.

const dbUrl =
  process.env.DATABASE_SUPABASE_POLLER_URL_2 ??
  process.env.DATABASE_URL ??
  undefined;

if (!dbUrl) {
  console.error(
    "[db] CRITICAL: No primary database URL found. " +
      "Set DATABASE_SUPABASE_POLLER_URL_2 (production) or DATABASE_URL (dev)."
  );
}

export const pool = new Pool({
  connectionString: dbUrl ?? "postgres://placeholder:placeholder@localhost:5432/placeholder",
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  // Keep small pool size for serverless — each function instance creates its own pool.
  // Supabase Transaction pooler supports unlimited clients but limits concurrent txns.
  max: 2,
  ssl: sslFor(dbUrl),
});

export const db = drizzle(pool, { schema });

// ─── Supabase 1 (admin / metadata mirror) ────────────────────────────────────
// Priority: POLLER URL (Transaction mode) → direct URL
const dbUrl1 =
  process.env.DATABASE_SUPABASE_POLLER_URL_1 ??
  process.env.DATABASE_URL_SUPABASE_1 ??
  undefined;

export const poolSupabase1 = dbUrl1
  ? new Pool({
      connectionString: dbUrl1,
      connectionTimeoutMillis: 8_000,
      idleTimeoutMillis: 20_000,
      max: 1,
      ssl: sslFor(dbUrl1),
    })
  : null;

export const dbSupabase1 = poolSupabase1 ? drizzle(poolSupabase1, { schema }) : null;

// ─── Supabase 2 (code snippets full mirror) ───────────────────────────────────
// Priority: POLLER URL (Transaction mode) → direct URL
const dbUrl2 =
  process.env.DATABASE_SUPABASE_POLLER_URL_2 ??
  process.env.DATABASE_URL_SUPABASE_2 ??
  undefined;

export const poolSupabase2 = dbUrl2
  ? new Pool({
      connectionString: dbUrl2,
      connectionTimeoutMillis: 8_000,
      idleTimeoutMillis: 20_000,
      max: 1,
      ssl: sslFor(dbUrl2),
    })
  : null;

export const dbSupabase2 = poolSupabase2 ? drizzle(poolSupabase2, { schema }) : null;
