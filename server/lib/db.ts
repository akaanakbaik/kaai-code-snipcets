import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

const { Pool } = pg;

// ─── Main Database (source of truth) ─────────────────────────────────────────

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error(
    "[db] WARNING: DATABASE_URL is not set. All database operations will fail. " +
      "Set DATABASE_URL in your environment (Vercel dashboard or .env)."
  );
}

export const pool = new Pool({
  connectionString: dbUrl ?? "postgres://placeholder:placeholder@localhost:5432/placeholder",
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  max: 3,
  ssl:
    dbUrl?.includes("supabase.co") || dbUrl?.includes("neon.tech")
      ? { rejectUnauthorized: false }
      : undefined,
});

export const db = drizzle(pool, { schema });

// ─── Supabase 1 (admin/metadata mirror) ──────────────────────────────────────

const dbUrl1 = process.env.DATABASE_URL_SUPABASE_1;

export const poolSupabase1 = dbUrl1
  ? new Pool({
      connectionString: dbUrl1,
      connectionTimeoutMillis: 8_000,
      idleTimeoutMillis: 20_000,
      max: 2,
      ssl: { rejectUnauthorized: false },
    })
  : null;

export const dbSupabase1 = poolSupabase1 ? drizzle(poolSupabase1, { schema }) : null;

// ─── Supabase 2 (snippets full mirror) ───────────────────────────────────────

const dbUrl2 = process.env.DATABASE_URL_SUPABASE_2;

export const poolSupabase2 = dbUrl2
  ? new Pool({
      connectionString: dbUrl2,
      connectionTimeoutMillis: 8_000,
      idleTimeoutMillis: 20_000,
      max: 2,
      ssl: { rejectUnauthorized: false },
    })
  : null;

export const dbSupabase2 = poolSupabase2 ? drizzle(poolSupabase2, { schema }) : null;
