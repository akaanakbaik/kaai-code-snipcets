import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { pool } from "./lib/db.js";
import {
  globalRateLimit,
  securityHeaders,
  safeErrorHandler,
} from "./middleware/security.js";
import { requestLogger } from "./middleware/request-logger.js";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) { return { id: req.id, method: req.method, url: req.url?.split("?")[0] }; },
      res(res) { return { statusCode: res.statusCode }; },
    },
  }),
);

app.use(securityHeaders);

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Webhook-Secret", "X-API-Key", "X-Unlock-Token"],
  }),
);

app.use(cookieParser(process.env.SESSION_SECRET || "kaai-fallback-secret-change-me"));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(globalRateLimit);
app.use(requestLogger);
app.use("/api", router);
app.use(safeErrorHandler as any);

// ─── Auto-Migration ───────────────────────────────────────────────────────────
// Creates missing tables on startup (idempotent). Ensures Vercel prod DB is ready.

async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    const migrations = [
      `CREATE TABLE IF NOT EXISTS snippets (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        language TEXT NOT NULL,
        tags TEXT[] NOT NULL DEFAULT '{}',
        code TEXT NOT NULL,
        author_name TEXT NOT NULL,
        author_email TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        reject_reason TEXT,
        view_count INTEGER NOT NULL DEFAULT 0,
        copy_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS admin_users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS admin_sessions (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS admin_otps (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        otp TEXT NOT NULL,
        used BOOLEAN NOT NULL DEFAULT FALSE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS broadcast_logs (
        id TEXT PRIMARY KEY,
        admin_email TEXT NOT NULL,
        admin_initial TEXT,
        target_email TEXT,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        recipient_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS ip_bans (
        id TEXT PRIMARY KEY,
        ip_address TEXT NOT NULL UNIQUE,
        banned_until TIMESTAMPTZ NOT NULL,
        reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS email_bans (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        banned_until TIMESTAMPTZ NOT NULL,
        reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS login_attempts (
        id TEXT PRIMARY KEY,
        ip_address TEXT NOT NULL,
        email TEXT,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        key_prefix TEXT NOT NULL,
        name TEXT NOT NULL,
        owner_email TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        rate_limit_per_second INTEGER NOT NULL DEFAULT 10,
        rate_limit_per_day INTEGER NOT NULL DEFAULT 1000,
        rate_limit_per_month INTEGER NOT NULL DEFAULT 10000,
        total_requests INTEGER NOT NULL DEFAULT 0,
        last_used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS api_key_usage (
        id TEXT PRIMARY KEY,
        api_key_id TEXT NOT NULL,
        date TEXT NOT NULL,
        month TEXT NOT NULL,
        requests_today INTEGER NOT NULL DEFAULT 0,
        requests_month INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS request_logs (
        id TEXT PRIMARY KEY,
        ip_address TEXT NOT NULL,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        status_code INTEGER,
        api_key_id TEXT,
        api_key_prefix TEXT,
        blocked BOOLEAN NOT NULL DEFAULT FALSE,
        block_reason TEXT,
        response_time_ms INTEGER,
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS admin_ip_whitelist (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        label TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      // Lock columns for snippets
      `ALTER TABLE snippets ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE`,
      `ALTER TABLE snippets ADD COLUMN IF NOT EXISTS lock_type TEXT`,
      `ALTER TABLE snippets ADD COLUMN IF NOT EXISTS lock_hash TEXT`,
      `ALTER TABLE snippets ADD COLUMN IF NOT EXISTS lock_salt TEXT`,
      // Snippet lock attempts table
      `CREATE TABLE IF NOT EXISTS snippet_lock_attempts (
        id TEXT PRIMARY KEY,
        snippet_id TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        banned_until TIMESTAMPTZ
      )`,
      `CREATE INDEX IF NOT EXISTS idx_snippet_lock_attempts_snippet_ip ON snippet_lock_attempts (snippet_id, ip_address)`,
      `ALTER TABLE snippets ADD COLUMN IF NOT EXISTS lock_disabled_at TIMESTAMPTZ`,
      `CREATE TABLE IF NOT EXISTS snippet_disable_lock_otps (
        id TEXT PRIMARY KEY,
        snippet_id TEXT NOT NULL,
        author_email TEXT NOT NULL,
        otp TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_sdlo_snippet ON snippet_disable_lock_otps (snippet_id)`,
      `INSERT INTO admin_users (id, email, name, is_active) VALUES
        (gen_random_uuid()::text, 'akaanakbaik17@proton.me', 'Superadmin', TRUE),
        (gen_random_uuid()::text, 'yaudahpakeaja6@gmail.com', 'Admin', TRUE),
        (gen_random_uuid()::text, 'kelvdra46@gmail.com', 'Kelv', TRUE),
        (gen_random_uuid()::text, 'clpmadang@gmail.com', 'Admin', TRUE)
       ON CONFLICT (email) DO NOTHING`,
    ];

    let ok = 0;
    for (const sql of migrations) {
      try {
        await client.query(sql);
        ok++;
      } catch {
        // Table may already exist — ignore
      }
    }
    logger.info(`[migration] Completed: ${ok}/${migrations.length} statements OK`);
  } catch (err) {
    logger.warn({ err }, "[migration] Migration batch failed — continuing anyway");
  } finally {
    client.release();
  }
}

runMigrations().catch((err) => {
  logger.warn({ err }, "[migration] Failed to run migrations");
});

export default app;
