import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { globalRateLimit, securityHeaders, safeErrorHandler } from "./middlewares/security";
import { requestLogger } from "./middlewares/request-logger";
import { pool } from "@workspace/db";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Security headers
app.use(securityHeaders);

// CORS - allow credentials from frontend + X-API-Key for external consumers
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Webhook-Secret", "X-API-Key"],
  }),
);

// Cookie parser
app.use(cookieParser());

// Body parsers
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// Global rate limiting
app.use(globalRateLimit);

// Request logging for security dashboard
app.use(requestLogger);

// Routes
app.use("/api", router);

// Safe error handler — never leaks stack traces or env info
app.use(safeErrorHandler as any);

// ─── Auto-Migration ───────────────────────────────────────────────────────────
// Creates any missing tables in production (idempotent, fire-and-forget)
// This ensures the Vercel production DB is always schema-compatible.

async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    const migrations = [
      `CREATE TABLE IF NOT EXISTS snippets (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        code TEXT NOT NULL,
        language TEXT NOT NULL,
        author_name TEXT NOT NULL,
        author_email TEXT NOT NULL,
        tags TEXT[] DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'pending',
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
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        recipient_count INTEGER NOT NULL DEFAULT 0,
        sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
        email TEXT NOT NULL,
        attempt_count INTEGER NOT NULL DEFAULT 1,
        last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS request_logs (
        id TEXT PRIMARY KEY,
        ip_address TEXT NOT NULL,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        status_code INTEGER NOT NULL,
        api_key_id TEXT,
        api_key_prefix TEXT,
        blocked BOOLEAN NOT NULL DEFAULT FALSE,
        block_reason TEXT,
        response_time_ms INTEGER,
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        key_prefix TEXT NOT NULL,
        key_hash TEXT NOT NULL UNIQUE,
        permissions TEXT[] DEFAULT '{}',
        rate_limit_per_min INTEGER NOT NULL DEFAULT 60,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        last_used_at TIMESTAMPTZ,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ
      )`,
      `CREATE TABLE IF NOT EXISTS api_key_usage (
        id TEXT PRIMARY KEY,
        api_key_id TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        method TEXT NOT NULL,
        status_code INTEGER NOT NULL,
        response_time_ms INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS admin_ip_whitelist (
        id TEXT PRIMARY KEY,
        ip_address TEXT NOT NULL UNIQUE,
        label TEXT,
        added_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      // Seed admin users
      `INSERT INTO admin_users (id, email, name, is_active) VALUES
        (gen_random_uuid()::text, 'akaanakbaik17@proton.me', 'Aka', TRUE),
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
        // Table may already exist with different schema — ignore
      }
    }
    logger.info(`[migration] Completed: ${ok}/${migrations.length} statements OK`);
  } catch (err) {
    logger.warn({ err }, "[migration] Migration batch failed — continuing anyway");
  } finally {
    client.release();
  }
}

// Run migrations on module load (non-blocking)
runMigrations().catch((err) => {
  logger.warn({ err }, "[migration] Failed to run migrations");
});

export default app;
