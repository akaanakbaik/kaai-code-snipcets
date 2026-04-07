"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc5) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc5 = __getOwnPropDesc(from, key)) || desc5.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server/app.ts
var app_exports = {};
__export(app_exports, {
  default: () => app_default
});
module.exports = __toCommonJS(app_exports);
var import_express6 = __toESM(require("express"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_cookie_parser = __toESM(require("cookie-parser"), 1);
var import_pino_http = __toESM(require("pino-http"), 1);

// server/routes/index.ts
var import_express5 = require("express");

// server/routes/health.ts
var import_express = require("express");

// server/lib/db.ts
var import_node_postgres = require("drizzle-orm/node-postgres");
var import_pg = __toESM(require("pg"), 1);

// server/lib/schema.ts
var schema_exports = {};
__export(schema_exports, {
  adminIpWhitelistTable: () => adminIpWhitelistTable,
  adminOtpsTable: () => adminOtpsTable,
  adminSessionsTable: () => adminSessionsTable,
  adminUsersTable: () => adminUsersTable,
  apiKeyUsageTable: () => apiKeyUsageTable,
  apiKeysTable: () => apiKeysTable,
  broadcastLogsTable: () => broadcastLogsTable,
  emailBansTable: () => emailBansTable,
  insertSnippetSchema: () => insertSnippetSchema,
  ipBansTable: () => ipBansTable,
  loginAttemptsTable: () => loginAttemptsTable,
  requestLogsTable: () => requestLogsTable,
  snippetStatusEnum: () => snippetStatusEnum,
  snippetsTable: () => snippetsTable
});
var import_pg_core = require("drizzle-orm/pg-core");
var import_drizzle_zod = require("drizzle-zod");
var snippetStatusEnum = (0, import_pg_core.pgEnum)("snippet_status", [
  "pending",
  "approved",
  "rejected"
]);
var snippetsTable = (0, import_pg_core.pgTable)("snippets", {
  id: (0, import_pg_core.text)("id").primaryKey(),
  title: (0, import_pg_core.text)("title").notNull(),
  description: (0, import_pg_core.text)("description").notNull(),
  language: (0, import_pg_core.text)("language").notNull(),
  tags: (0, import_pg_core.text)("tags").array().notNull().default([]),
  code: (0, import_pg_core.text)("code").notNull(),
  authorName: (0, import_pg_core.text)("author_name").notNull(),
  authorEmail: (0, import_pg_core.text)("author_email").notNull(),
  status: snippetStatusEnum("status").notNull().default("pending"),
  rejectReason: (0, import_pg_core.text)("reject_reason"),
  viewCount: (0, import_pg_core.integer)("view_count").notNull().default(0),
  copyCount: (0, import_pg_core.integer)("copy_count").notNull().default(0),
  createdAt: (0, import_pg_core.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at", { withTimezone: true }).notNull().defaultNow()
});
var insertSnippetSchema = (0, import_drizzle_zod.createInsertSchema)(snippetsTable).omit({
  createdAt: true,
  updatedAt: true
});
var adminUsersTable = (0, import_pg_core.pgTable)("admin_users", {
  id: (0, import_pg_core.text)("id").primaryKey(),
  email: (0, import_pg_core.text)("email").notNull().unique(),
  name: (0, import_pg_core.text)("name"),
  isActive: (0, import_pg_core.boolean)("is_active").notNull().default(true),
  createdAt: (0, import_pg_core.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow()
});
var adminSessionsTable = (0, import_pg_core.pgTable)("admin_sessions", {
  id: (0, import_pg_core.text)("id").primaryKey(),
  email: (0, import_pg_core.text)("email").notNull(),
  expiresAt: (0, import_pg_core.timestamp)("expires_at", { withTimezone: true }).notNull(),
  createdAt: (0, import_pg_core.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow()
});
var adminOtpsTable = (0, import_pg_core.pgTable)("admin_otps", {
  id: (0, import_pg_core.text)("id").primaryKey(),
  email: (0, import_pg_core.text)("email").notNull(),
  otp: (0, import_pg_core.text)("otp").notNull(),
  used: (0, import_pg_core.boolean)("used").notNull().default(false),
  expiresAt: (0, import_pg_core.timestamp)("expires_at", { withTimezone: true }).notNull(),
  createdAt: (0, import_pg_core.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow()
});
var ipBansTable = (0, import_pg_core.pgTable)("ip_bans", {
  id: (0, import_pg_core.text)("id").primaryKey(),
  ipAddress: (0, import_pg_core.text)("ip_address").notNull().unique(),
  bannedUntil: (0, import_pg_core.timestamp)("banned_until", { withTimezone: true }).notNull(),
  reason: (0, import_pg_core.text)("reason"),
  createdAt: (0, import_pg_core.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow()
});
var emailBansTable = (0, import_pg_core.pgTable)("email_bans", {
  id: (0, import_pg_core.text)("id").primaryKey(),
  email: (0, import_pg_core.text)("email").notNull().unique(),
  bannedUntil: (0, import_pg_core.timestamp)("banned_until", { withTimezone: true }).notNull(),
  reason: (0, import_pg_core.text)("reason"),
  createdAt: (0, import_pg_core.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow()
});
var loginAttemptsTable = (0, import_pg_core.pgTable)("login_attempts", {
  id: (0, import_pg_core.text)("id").primaryKey(),
  ipAddress: (0, import_pg_core.text)("ip_address").notNull(),
  email: (0, import_pg_core.text)("email"),
  attemptCount: (0, import_pg_core.integer)("attempt_count").notNull().default(0),
  lastAttemptAt: (0, import_pg_core.timestamp)("last_attempt_at", { withTimezone: true }).notNull().defaultNow()
});
var broadcastLogsTable = (0, import_pg_core.pgTable)("broadcast_logs", {
  id: (0, import_pg_core.text)("id").primaryKey(),
  adminEmail: (0, import_pg_core.text)("admin_email").notNull(),
  adminInitial: (0, import_pg_core.text)("admin_initial"),
  targetEmail: (0, import_pg_core.text)("target_email"),
  subject: (0, import_pg_core.text)("subject").notNull(),
  message: (0, import_pg_core.text)("message").notNull(),
  recipientCount: (0, import_pg_core.integer)("recipient_count").notNull().default(0),
  createdAt: (0, import_pg_core.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow()
});
var apiKeysTable = (0, import_pg_core.pgTable)("api_keys", {
  id: (0, import_pg_core.text)("id").primaryKey(),
  key: (0, import_pg_core.text)("key").notNull().unique(),
  keyPrefix: (0, import_pg_core.text)("key_prefix").notNull(),
  name: (0, import_pg_core.text)("name").notNull(),
  ownerEmail: (0, import_pg_core.text)("owner_email").notNull(),
  isActive: (0, import_pg_core.boolean)("is_active").notNull().default(true),
  rateLimitPerSecond: (0, import_pg_core.integer)("rate_limit_per_second").notNull().default(10),
  rateLimitPerDay: (0, import_pg_core.integer)("rate_limit_per_day").notNull().default(1e3),
  rateLimitPerMonth: (0, import_pg_core.integer)("rate_limit_per_month").notNull().default(1e4),
  totalRequests: (0, import_pg_core.integer)("total_requests").notNull().default(0),
  lastUsedAt: (0, import_pg_core.timestamp)("last_used_at"),
  createdAt: (0, import_pg_core.timestamp)("created_at").notNull().defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").notNull().defaultNow()
});
var adminIpWhitelistTable = (0, import_pg_core.pgTable)("admin_ip_whitelist", {
  id: (0, import_pg_core.text)("id").primaryKey(),
  email: (0, import_pg_core.text)("email").notNull(),
  ipAddress: (0, import_pg_core.text)("ip_address").notNull(),
  label: (0, import_pg_core.text)("label"),
  isActive: (0, import_pg_core.boolean)("is_active").notNull().default(true),
  createdAt: (0, import_pg_core.timestamp)("created_at").notNull().defaultNow()
});
var requestLogsTable = (0, import_pg_core.pgTable)("request_logs", {
  id: (0, import_pg_core.text)("id").primaryKey(),
  ipAddress: (0, import_pg_core.text)("ip_address").notNull(),
  method: (0, import_pg_core.text)("method").notNull(),
  path: (0, import_pg_core.text)("path").notNull(),
  statusCode: (0, import_pg_core.integer)("status_code"),
  apiKeyId: (0, import_pg_core.text)("api_key_id"),
  apiKeyPrefix: (0, import_pg_core.text)("api_key_prefix"),
  blocked: (0, import_pg_core.boolean)("blocked").notNull().default(false),
  blockReason: (0, import_pg_core.text)("block_reason"),
  responseTimeMs: (0, import_pg_core.integer)("response_time_ms"),
  userAgent: (0, import_pg_core.text)("user_agent"),
  createdAt: (0, import_pg_core.timestamp)("created_at").notNull().defaultNow()
});
var apiKeyUsageTable = (0, import_pg_core.pgTable)("api_key_usage", {
  id: (0, import_pg_core.text)("id").primaryKey(),
  apiKeyId: (0, import_pg_core.text)("api_key_id").notNull(),
  date: (0, import_pg_core.text)("date").notNull(),
  month: (0, import_pg_core.text)("month").notNull(),
  requestsToday: (0, import_pg_core.integer)("requests_today").notNull().default(0),
  requestsMonth: (0, import_pg_core.integer)("requests_month").notNull().default(0),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").notNull().defaultNow()
});

// server/lib/db.ts
var { Pool } = import_pg.default;
function sslFor(url) {
  if (!url) return void 0;
  if (url.includes("supabase.co") || url.includes("supabase.com") || url.includes("neon.tech")) {
    return { rejectUnauthorized: false };
  }
  return void 0;
}
var dbUrl = process.env.DATABASE_SUPABASE_POLLER_URL_2 ?? process.env.DATABASE_URL ?? void 0;
if (!dbUrl) {
  console.error(
    "[db] CRITICAL: No primary database URL found. Set DATABASE_SUPABASE_POLLER_URL_2 (production) or DATABASE_URL (dev)."
  );
}
var pool = new Pool({
  connectionString: dbUrl ?? "postgres://placeholder:placeholder@localhost:5432/placeholder",
  connectionTimeoutMillis: 1e4,
  idleTimeoutMillis: 3e4,
  // Keep small pool size for serverless — each function instance creates its own pool.
  // Supabase Transaction pooler supports unlimited clients but limits concurrent txns.
  max: 2,
  ssl: sslFor(dbUrl)
});
var db = (0, import_node_postgres.drizzle)(pool, { schema: schema_exports });
var dbUrl1 = process.env.DATABASE_SUPABASE_POLLER_URL_1 ?? process.env.DATABASE_URL_SUPABASE_1 ?? void 0;
var poolSupabase1 = dbUrl1 ? new Pool({
  connectionString: dbUrl1,
  connectionTimeoutMillis: 8e3,
  idleTimeoutMillis: 2e4,
  max: 1,
  ssl: sslFor(dbUrl1)
}) : null;
var dbSupabase1 = poolSupabase1 ? (0, import_node_postgres.drizzle)(poolSupabase1, { schema: schema_exports }) : null;
var dbUrl2 = process.env.DATABASE_SUPABASE_POLLER_URL_2 ?? process.env.DATABASE_URL_SUPABASE_2 ?? void 0;
var poolSupabase2 = dbUrl2 ? new Pool({
  connectionString: dbUrl2,
  connectionTimeoutMillis: 8e3,
  idleTimeoutMillis: 2e4,
  max: 1,
  ssl: sslFor(dbUrl2)
}) : null;
var dbSupabase2 = poolSupabase2 ? (0, import_node_postgres.drizzle)(poolSupabase2, { schema: schema_exports }) : null;

// server/routes/health.ts
var import_zod = require("zod");
var router = (0, import_express.Router)();
var HealthCheckResponse = import_zod.z.object({ status: import_zod.z.literal("ok") });
function maskUrl(url) {
  if (!url) return "(not set)";
  return url.replace(/\/\/[^@]+@/, "//***@").slice(0, 80);
}
router.get("/healthz", (_req, res) => {
  res.json(HealthCheckResponse.parse({ status: "ok" }));
});
router.get("/healthz/db", async (_req, res) => {
  const start = Date.now();
  const primaryUrl = process.env.DATABASE_SUPABASE_POLLER_URL_2 ?? process.env.DATABASE_URL ?? void 0;
  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    client.release();
    res.json({
      status: "ok",
      latencyMs: Date.now() - start,
      tables: result.rows.map((r) => r.table_name),
      nodeEnv: process.env.NODE_ENV,
      primaryDb: maskUrl(primaryUrl),
      supabase1Connected: poolSupabase1 !== null,
      supabase2Connected: poolSupabase2 !== null
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      latencyMs: Date.now() - start,
      error: err.message,
      nodeEnv: process.env.NODE_ENV,
      primaryDb: maskUrl(primaryUrl),
      supabase1Connected: poolSupabase1 !== null,
      supabase2Connected: poolSupabase2 !== null
    });
  }
});
router.get("/healthz/db/supabase1", async (_req, res) => {
  if (!poolSupabase1) {
    return res.status(503).json({ status: "disabled", reason: "DATABASE_SUPABASE_POLLER_URL_1 and DATABASE_URL_SUPABASE_1 not set" });
  }
  const start = Date.now();
  try {
    const client = await poolSupabase1.connect();
    await client.query("SELECT 1");
    client.release();
    res.json({ status: "ok", latencyMs: Date.now() - start });
  } catch (err) {
    res.status(500).json({ status: "error", latencyMs: Date.now() - start, error: err.message });
  }
});
router.get("/healthz/db/supabase2", async (_req, res) => {
  if (!poolSupabase2) {
    return res.status(503).json({ status: "disabled", reason: "DATABASE_SUPABASE_POLLER_URL_2 and DATABASE_URL_SUPABASE_2 not set" });
  }
  const start = Date.now();
  try {
    const client = await poolSupabase2.connect();
    await client.query("SELECT 1");
    client.release();
    res.json({ status: "ok", latencyMs: Date.now() - start });
  } catch (err) {
    res.status(500).json({ status: "error", latencyMs: Date.now() - start, error: err.message });
  }
});
var health_default = router;

// server/routes/snippets.ts
var import_express2 = require("express");
var import_drizzle_orm = require("drizzle-orm");
var import_zod2 = require("zod");
var router2 = (0, import_express2.Router)();
function generateId() {
  const digits = Array.from({ length: 5 }, () => Math.floor(Math.random() * 10)).join("");
  const letters = Array.from(
    { length: 5 },
    () => String.fromCharCode(65 + Math.floor(Math.random() * 26))
  ).join("");
  return digits + letters;
}
function formatSnippet(snippet, hideEmail = true) {
  const result = {
    ...snippet,
    tags: snippet.tags ?? [],
    createdAt: snippet.createdAt.toISOString(),
    updatedAt: snippet.updatedAt.toISOString()
  };
  if (hideEmail) delete result.authorEmail;
  return result;
}
async function sendToBot(snippet) {
  const botUrl = process.env.VITE_BOT_WEBHOOK_URL;
  const secret = process.env.VITE_WEBHOOK_SECRET;
  if (!botUrl) return;
  try {
    await fetch(botUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Webhook-Secret": secret ?? "" },
      body: JSON.stringify({
        id: snippet.id,
        nama: snippet.authorName,
        email: snippet.authorEmail,
        namacode: snippet.title,
        tagcode: snippet.tags?.join(","),
        code: snippet.code
      }),
      signal: AbortSignal.timeout(5e3)
    });
  } catch {
  }
}
var CreateSnippetBody = import_zod2.z.object({
  title: import_zod2.z.string().min(1).max(100),
  description: import_zod2.z.string().max(500).default(""),
  language: import_zod2.z.string().min(1).max(50),
  tags: import_zod2.z.array(import_zod2.z.string()).max(10).default([]),
  code: import_zod2.z.string().min(1).max(5e4),
  authorName: import_zod2.z.string().min(1).max(100),
  authorEmail: import_zod2.z.string().email().max(200)
});
var ListSnippetsQuery = import_zod2.z.object({
  page: import_zod2.z.coerce.number().min(1).default(1),
  limit: import_zod2.z.coerce.number().min(1).max(50).default(12),
  q: import_zod2.z.string().optional(),
  language: import_zod2.z.string().optional(),
  tag: import_zod2.z.string().optional(),
  sort: import_zod2.z.enum(["newest", "oldest", "popular", "copies"]).default("newest")
});
router2.get("/snippets/popular", async (req, res) => {
  try {
    const [mostViewed, mostCopied] = await Promise.all([
      db.select().from(snippetsTable).where((0, import_drizzle_orm.eq)(snippetsTable.status, "approved")).orderBy((0, import_drizzle_orm.desc)(snippetsTable.viewCount)).limit(6),
      db.select().from(snippetsTable).where((0, import_drizzle_orm.eq)(snippetsTable.status, "approved")).orderBy((0, import_drizzle_orm.desc)(snippetsTable.copyCount)).limit(6)
    ]);
    res.json({ mostViewed: mostViewed.map((s) => formatSnippet(s)), mostCopied: mostCopied.map((s) => formatSnippet(s)) });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch popular snippets" });
  }
});
router2.get("/snippets/tags", async (req, res) => {
  try {
    const rows = await db.select({ tags: snippetsTable.tags }).from(snippetsTable).where((0, import_drizzle_orm.eq)(snippetsTable.status, "approved"));
    const tagCounts = {};
    rows.forEach((r) => {
      (r.tags ?? []).forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([tag, count3]) => ({ tag, count: count3 }));
    res.json({ data: sorted });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch tags" });
  }
});
router2.post("/snippets/:id/view", async (req, res) => {
  try {
    await db.update(snippetsTable).set({ viewCount: import_drizzle_orm.sql`${snippetsTable.viewCount} + 1` }).where((0, import_drizzle_orm.and)((0, import_drizzle_orm.eq)(snippetsTable.id, req.params.id), (0, import_drizzle_orm.eq)(snippetsTable.status, "approved")));
    res.json({ success: true });
  } catch {
    res.json({ success: false });
  }
});
router2.post("/snippets/:id/copy", async (req, res) => {
  try {
    await db.update(snippetsTable).set({ copyCount: import_drizzle_orm.sql`${snippetsTable.copyCount} + 1` }).where((0, import_drizzle_orm.and)((0, import_drizzle_orm.eq)(snippetsTable.id, req.params.id), (0, import_drizzle_orm.eq)(snippetsTable.status, "approved")));
    res.json({ success: true });
  } catch {
    res.json({ success: false });
  }
});
router2.get("/snippets", async (req, res) => {
  const parsed = ListSnippetsQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid query params" });
    return;
  }
  const { page, limit, q, language, tag, sort } = parsed.data;
  const offset = (page - 1) * limit;
  try {
    const conditions = [(0, import_drizzle_orm.eq)(snippetsTable.status, "approved")];
    if (q) conditions.push((0, import_drizzle_orm.or)((0, import_drizzle_orm.ilike)(snippetsTable.title, `%${q}%`), (0, import_drizzle_orm.ilike)(snippetsTable.code, `%${q}%`), (0, import_drizzle_orm.ilike)(snippetsTable.description, `%${q}%`)));
    if (language) conditions.push((0, import_drizzle_orm.eq)(snippetsTable.language, language));
    if (tag) conditions.push(import_drizzle_orm.sql`${snippetsTable.tags} @> ARRAY[${tag}]::text[]`);
    const where = (0, import_drizzle_orm.and)(...conditions);
    const orderBy = sort === "newest" ? [(0, import_drizzle_orm.desc)(snippetsTable.createdAt)] : sort === "oldest" ? [(0, import_drizzle_orm.asc)(snippetsTable.createdAt)] : sort === "popular" ? [(0, import_drizzle_orm.desc)(snippetsTable.viewCount)] : [(0, import_drizzle_orm.desc)(snippetsTable.copyCount)];
    const [snippets, [{ total }]] = await Promise.all([
      db.select().from(snippetsTable).where(where).orderBy(...orderBy).limit(limit).offset(offset),
      db.select({ total: (0, import_drizzle_orm.count)() }).from(snippetsTable).where(where)
    ]);
    res.json({
      data: snippets.map((s) => formatSnippet(s)),
      pagination: { page, limit, total: Number(total), totalPages: Math.ceil(Number(total) / limit) }
    });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch snippets" });
  }
});
router2.post("/snippets", async (req, res) => {
  const parsed = CreateSnippetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
    return;
  }
  const id = generateId();
  try {
    const [snippet] = await db.insert(snippetsTable).values({ id, ...parsed.data, status: "pending", createdAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }).returning();
    const full = { ...snippet, authorEmail: snippet.authorEmail };
    sendToBot(full).catch(() => {
    });
    res.status(201).json(formatSnippet(snippet));
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to create snippet" });
  }
});
router2.get("/snippets/:id", async (req, res) => {
  try {
    const [snippet] = await db.select().from(snippetsTable).where((0, import_drizzle_orm.and)((0, import_drizzle_orm.eq)(snippetsTable.id, req.params.id), (0, import_drizzle_orm.eq)(snippetsTable.status, "approved"))).limit(1);
    if (!snippet) {
      res.status(404).json({ error: "NOT_FOUND", message: "Snippet not found" });
      return;
    }
    res.json(formatSnippet(snippet));
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch snippet" });
  }
});
router2.post("/snippets/:id/approve", async (req, res) => {
  const secret = process.env.VITE_WEBHOOK_SECRET;
  if (secret && req.headers["x-webhook-secret"] !== secret) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }
  const [updated] = await db.update(snippetsTable).set({ status: "approved", updatedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm.eq)(snippetsTable.id, req.params.id)).returning();
  if (!updated) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  res.json(formatSnippet(updated));
});
router2.post("/snippets/:id/reject", async (req, res) => {
  const secret = process.env.VITE_WEBHOOK_SECRET;
  if (secret && req.headers["x-webhook-secret"] !== secret) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }
  const reason = req.body?.reason;
  const [updated] = await db.update(snippetsTable).set({ status: "rejected", rejectReason: reason ?? null, updatedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm.eq)(snippetsTable.id, req.params.id)).returning();
  if (!updated) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  res.json(formatSnippet(updated));
});
var snippets_default = router2;

// server/routes/stats.ts
var import_express3 = require("express");
var import_drizzle_orm2 = require("drizzle-orm");

// server/lib/logger.ts
var import_pino = __toESM(require("pino"), 1);
var isProduction = process.env.NODE_ENV === "production";
var logger = isProduction ? (0, import_pino.default)(
  {
    level: process.env.LOG_LEVEL ?? "info",
    redact: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']"
    ]
  },
  import_pino.default.destination({ dest: 1, sync: true })
) : (0, import_pino.default)({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']"
  ],
  transport: {
    target: "pino-pretty",
    options: { colorize: true }
  }
});

// server/routes/stats.ts
var router3 = (0, import_express3.Router)();
function formatSnippet2(snippet) {
  return {
    ...snippet,
    tags: snippet.tags ?? [],
    createdAt: snippet.createdAt.toISOString(),
    updatedAt: snippet.updatedAt.toISOString()
  };
}
router3.get("/stats", async (_req, res) => {
  try {
    const [total, pending, approved, rejected, authors, languages] = await Promise.all([
      db.select({ count: (0, import_drizzle_orm2.count)() }).from(snippetsTable),
      db.select({ count: (0, import_drizzle_orm2.count)() }).from(snippetsTable).where((0, import_drizzle_orm2.eq)(snippetsTable.status, "pending")),
      db.select({ count: (0, import_drizzle_orm2.count)() }).from(snippetsTable).where((0, import_drizzle_orm2.eq)(snippetsTable.status, "approved")),
      db.select({ count: (0, import_drizzle_orm2.count)() }).from(snippetsTable).where((0, import_drizzle_orm2.eq)(snippetsTable.status, "rejected")),
      db.select({ count: (0, import_drizzle_orm2.countDistinct)(snippetsTable.authorEmail) }).from(snippetsTable),
      db.selectDistinct({ language: snippetsTable.language }).from(snippetsTable).where((0, import_drizzle_orm2.eq)(snippetsTable.status, "approved"))
    ]);
    res.json({
      totalSnippets: Number(total[0]?.count ?? 0),
      pendingSnippets: Number(pending[0]?.count ?? 0),
      approvedSnippets: Number(approved[0]?.count ?? 0),
      rejectedSnippets: Number(rejected[0]?.count ?? 0),
      totalAuthors: Number(authors[0]?.count ?? 0),
      totalLanguages: languages.length
    });
  } catch (err) {
    logger.error({ err }, "[stats] GET /api/stats failed");
    res.status(500).json({ error: "DB_ERROR", message: "Gagal mengambil statistik" });
  }
});
router3.get("/stats/languages", async (_req, res) => {
  try {
    const rows = await db.select({ language: snippetsTable.language, count: (0, import_drizzle_orm2.count)() }).from(snippetsTable).where((0, import_drizzle_orm2.eq)(snippetsTable.status, "approved")).groupBy(snippetsTable.language).orderBy((0, import_drizzle_orm2.desc)((0, import_drizzle_orm2.count)()));
    res.json(rows.map((r) => ({ language: r.language, count: Number(r.count) })));
  } catch (err) {
    logger.error({ err }, "[stats] GET /api/stats/languages failed");
    res.status(500).json({ error: "DB_ERROR", message: "Gagal mengambil statistik bahasa" });
  }
});
router3.get("/stats/recent", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 5, 20);
    const rows = await db.select().from(snippetsTable).where((0, import_drizzle_orm2.eq)(snippetsTable.status, "approved")).orderBy((0, import_drizzle_orm2.desc)(snippetsTable.createdAt)).limit(limit);
    res.json(rows.map(formatSnippet2));
  } catch (err) {
    logger.error({ err }, "[stats] GET /api/stats/recent failed");
    res.status(500).json({ error: "DB_ERROR", message: "Gagal mengambil snippet terbaru" });
  }
});
var stats_default = router3;

// server/routes/admin.ts
var import_express4 = require("express");
var import_drizzle_orm5 = require("drizzle-orm");
var import_node_crypto2 = __toESM(require("node:crypto"), 1);

// server/lib/mailer.ts
var import_nodemailer = __toESM(require("nodemailer"), 1);
var _transporter = null;
function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_PASS;
  if (!user || !pass) {
    throw new Error("GMAIL_USER or GMAIL_PASS is not set.");
  }
  if (!_transporter) {
    _transporter = import_nodemailer.default.createTransport({
      service: "gmail",
      auth: { user, pass },
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
      rateDelta: 1e3,
      rateLimit: 3
    });
    logger.info(`[mailer] Transporter initialized \u2014 user: ${user}`);
  }
  return _transporter;
}
var FOOTER = `
<br/><br/>
<hr style="border:none;border-top:1px solid #1e2a3a;margin:20px 0"/>
<p style="color:#64748b;font-size:12px;margin:0">
  Layanan aduan dan balasan silahkan chat:
  <a href="https://t.me/akamodebaik" style="color:#3b82f6">t.me/akamodebaik</a>
</p>
`;
var BASE_STYLE = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #0f1623;
  color: #e2e8f0;
  padding: 32px;
  border-radius: 12px;
  max-width: 600px;
  margin: 0 auto;
`;
async function sendOtpEmail(to, otp) {
  const t = getTransporter();
  await t.sendMail({
    from: `"Kaai Admin" <${process.env.GMAIL_USER}>`,
    to,
    subject: "Kode OTP Login Admin \u2014 Kaai Code Snippet",
    html: `
      <div style="${BASE_STYLE}">
        <h2 style="color:#3b82f6;margin-top:0">Kode OTP Login</h2>
        <p>Gunakan kode berikut untuk login ke panel admin:</p>
        <div style="background:#1e2a3a;border:1px solid #2d3f55;border-radius:8px;padding:20px;text-align:center;margin:24px 0">
          <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#3b82f6;font-family:monospace">${otp}</span>
        </div>
        <p style="color:#94a3b8;font-size:14px">Kode ini berlaku selama <strong>5 menit</strong>. Jangan bagikan ke siapapun.</p>
        ${FOOTER}
      </div>
    `
  });
}
async function sendApprovalEmail(to, snippetTitle, snippetId) {
  const t = getTransporter();
  const url = `${process.env.APP_URL ?? "https://kaai.vercel.app"}/snippet/${snippetId}`;
  await t.sendMail({
    from: `"Kaai Code Snippet" <${process.env.GMAIL_USER}>`,
    to,
    subject: `\u2705 Snippet kamu disetujui: ${snippetTitle}`,
    html: `
      <div style="${BASE_STYLE}">
        <h2 style="color:#22c55e;margin-top:0">Snippet Disetujui!</h2>
        <p>Snippet <strong>${snippetTitle}</strong> sudah disetujui dan bisa dilihat publik.</p>
        <a href="${url}" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px">Lihat Snippet</a>
        ${FOOTER}
      </div>
    `
  });
}
async function sendRejectionEmail(to, snippetTitle, reason) {
  const t = getTransporter();
  await t.sendMail({
    from: `"Kaai Code Snippet" <${process.env.GMAIL_USER}>`,
    to,
    subject: `\u274C Snippet kamu ditolak: ${snippetTitle}`,
    html: `
      <div style="${BASE_STYLE}">
        <h2 style="color:#ef4444;margin-top:0">Snippet Ditolak</h2>
        <p>Snippet <strong>${snippetTitle}</strong> ditolak oleh admin.</p>
        ${reason ? `<p style="color:#94a3b8">Alasan: ${reason}</p>` : ""}
        <p style="color:#94a3b8;font-size:14px">Kamu bisa upload ulang setelah diperbaiki.</p>
        ${FOOTER}
      </div>
    `
  });
}
async function sendBroadcastEmail(to, subject, message) {
  const t = getTransporter();
  const recipients = Array.isArray(to) ? to : [to];
  await Promise.all(
    recipients.map(
      (recipient) => t.sendMail({
        from: `"Kaai Admin" <${process.env.GMAIL_USER}>`,
        to: recipient,
        subject,
        html: `
          <div style="${BASE_STYLE}">
            <h2 style="color:#3b82f6;margin-top:0">${subject}</h2>
            <div style="white-space:pre-wrap;color:#e2e8f0">${message}</div>
            ${FOOTER}
          </div>
        `
      })
    )
  );
}
async function sendTestEmail(to) {
  const t = getTransporter();
  await t.sendMail({
    from: `"Kaai Admin" <${process.env.GMAIL_USER}>`,
    to,
    subject: "Test Email \u2014 Kaai Code Snippet",
    html: `
      <div style="${BASE_STYLE}">
        <h2 style="color:#3b82f6;margin-top:0">Test Email</h2>
        <p>Email SMTP berfungsi dengan baik \u2705</p>
        ${FOOTER}
      </div>
    `
  });
}

// server/middleware/security.ts
var import_express_rate_limit = __toESM(require("express-rate-limit"), 1);
var import_drizzle_orm3 = require("drizzle-orm");
function getClientIp(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
}
var globalRateLimit = (0, import_express_rate_limit.default)({
  windowMs: 1e3,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "RATE_LIMITED", message: "Too many requests. Please slow down." },
  keyGenerator: (req) => getClientIp(req)
});
var adminLoginRateLimit = (0, import_express_rate_limit.default)({
  windowMs: 60 * 1e3,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "RATE_LIMITED", message: "Too many login attempts. Try again later." },
  keyGenerator: (req) => getClientIp(req)
});
function securityHeaders(req, res, next) {
  res.removeHeader("X-Powered-By");
  res.removeHeader("Server");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://raw.githubusercontent.com",
      "connect-src 'self'",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'"
    ].join("; ")
  );
  next();
}
function safeErrorHandler(err, req, res, _next) {
  const status = err.status ?? err.statusCode ?? 500;
  logger.error(
    { err: { message: err.message, name: err.name }, method: req.method, path: req.path, status },
    "[error-handler] Unhandled route error"
  );
  if (res.headersSent) return;
  res.status(status).json({
    error: status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR",
    message: status >= 500 ? "An unexpected error occurred." : err.message ?? "Bad request."
  });
}

// server/routes/api-keys.ts
var import_drizzle_orm4 = require("drizzle-orm");
var import_node_crypto = __toESM(require("node:crypto"), 1);
function hashKey(raw) {
  return import_node_crypto.default.createHash("sha256").update(raw).digest("hex");
}
function generateRawKey() {
  const rand = import_node_crypto.default.randomBytes(24).toString("base64url");
  return `kaai_${rand}`;
}
async function listApiKeys(req, res) {
  try {
    const keys = await db.select().from(apiKeysTable).orderBy((0, import_drizzle_orm4.desc)(apiKeysTable.createdAt));
    res.json({
      data: keys.map((k) => ({
        id: k.id,
        keyPrefix: k.keyPrefix,
        name: k.name,
        ownerEmail: k.ownerEmail,
        isActive: k.isActive,
        rateLimitPerSecond: k.rateLimitPerSecond,
        rateLimitPerDay: k.rateLimitPerDay,
        rateLimitPerMonth: k.rateLimitPerMonth,
        totalRequests: k.totalRequests,
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
        createdAt: k.createdAt.toISOString(),
        updatedAt: k.updatedAt.toISOString()
      }))
    });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to list API keys" });
  }
}
async function createApiKey(req, res) {
  const { name, ownerEmail, rateLimitPerSecond, rateLimitPerDay, rateLimitPerMonth } = req.body;
  if (!name || !ownerEmail) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "name and ownerEmail required" });
    return;
  }
  const rawKey = generateRawKey();
  const hashed = hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 14);
  try {
    const [created] = await db.insert(apiKeysTable).values({
      id: import_node_crypto.default.randomUUID(),
      key: hashed,
      keyPrefix,
      name: name.trim(),
      ownerEmail: ownerEmail.toLowerCase().trim(),
      isActive: true,
      rateLimitPerSecond: Number(rateLimitPerSecond) || 10,
      rateLimitPerDay: Number(rateLimitPerDay) || 1e3,
      rateLimitPerMonth: Number(rateLimitPerMonth) || 1e4,
      totalRequests: 0,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    }).returning();
    res.status(201).json({
      id: created.id,
      key: rawKey,
      keyPrefix,
      name: created.name,
      ownerEmail: created.ownerEmail,
      isActive: created.isActive,
      rateLimitPerSecond: created.rateLimitPerSecond,
      rateLimitPerDay: created.rateLimitPerDay,
      rateLimitPerMonth: created.rateLimitPerMonth,
      createdAt: created.createdAt.toISOString(),
      message: "\u26A0\uFE0F Save this key now \u2014 it will NOT be shown again."
    });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to create API key" });
  }
}
async function updateApiKey(req, res) {
  const { id } = req.params;
  const { name, isActive, rateLimitPerSecond, rateLimitPerDay, rateLimitPerMonth } = req.body;
  try {
    const updates = { updatedAt: /* @__PURE__ */ new Date() };
    if (name !== void 0) updates.name = name.trim();
    if (isActive !== void 0) updates.isActive = Boolean(isActive);
    if (rateLimitPerSecond !== void 0) updates.rateLimitPerSecond = Number(rateLimitPerSecond);
    if (rateLimitPerDay !== void 0) updates.rateLimitPerDay = Number(rateLimitPerDay);
    if (rateLimitPerMonth !== void 0) updates.rateLimitPerMonth = Number(rateLimitPerMonth);
    const [updated] = await db.update(apiKeysTable).set(updates).where((0, import_drizzle_orm4.eq)(apiKeysTable.id, id)).returning();
    if (!updated) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    res.json({ id: updated.id, name: updated.name, isActive: updated.isActive, updatedAt: updated.updatedAt.toISOString() });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to update API key" });
  }
}
async function deleteApiKey(req, res) {
  const { id } = req.params;
  try {
    await db.delete(apiKeyUsageTable).where((0, import_drizzle_orm4.eq)(apiKeyUsageTable.apiKeyId, id));
    await db.delete(apiKeysTable).where((0, import_drizzle_orm4.eq)(apiKeysTable.id, id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to delete API key" });
  }
}
async function listIpWhitelist(req, res) {
  try {
    const rows = await db.select().from(adminIpWhitelistTable).orderBy((0, import_drizzle_orm4.desc)(adminIpWhitelistTable.createdAt));
    res.json({ data: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to list IPs" });
  }
}
async function addIpWhitelist(req, res) {
  const { ipAddress, label, email } = req.body;
  if (!ipAddress || !email) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "ipAddress and email required" });
    return;
  }
  try {
    const [created] = await db.insert(adminIpWhitelistTable).values({ id: import_node_crypto.default.randomUUID(), email, ipAddress, label: label ?? null, isActive: true, createdAt: /* @__PURE__ */ new Date() }).returning();
    res.status(201).json({ ...created, createdAt: created.createdAt.toISOString() });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to add IP" });
  }
}
async function updateIpWhitelist(req, res) {
  const { id } = req.params;
  const { label, isActive } = req.body;
  try {
    const updates = {};
    if (label !== void 0) updates.label = label;
    if (isActive !== void 0) updates.isActive = Boolean(isActive);
    const [updated] = await db.update(adminIpWhitelistTable).set(updates).where((0, import_drizzle_orm4.eq)(adminIpWhitelistTable.id, id)).returning();
    if (!updated) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    res.json({ success: true, ...updated, createdAt: updated.createdAt.toISOString() });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to update IP" });
  }
}
async function deleteIpWhitelist(req, res) {
  const { id } = req.params;
  try {
    await db.delete(adminIpWhitelistTable).where((0, import_drizzle_orm4.eq)(adminIpWhitelistTable.id, id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to delete IP" });
  }
}
async function getRequestLogs(req, res) {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const onlyBlocked = req.query.blocked === "true";
  try {
    const rows = await db.select().from(requestLogsTable).orderBy((0, import_drizzle_orm4.desc)(requestLogsTable.createdAt)).limit(limit);
    const filtered = onlyBlocked ? rows.filter((r) => r.blocked) : rows;
    res.json({ data: filtered.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })), total: filtered.length });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch logs" });
  }
}

// server/routes/admin.ts
var router4 = (0, import_express4.Router)();
var ALLOWED_ADMIN_EMAILS = [
  "akaanakbaik17@proton.me",
  "yaudahpakeaja6@gmail.com",
  "kelvdra46@gmail.com",
  "clpmadang@gmail.com"
];
var SESSION_DURATION_MS = 24 * 60 * 60 * 1e3;
var OTP_DURATION_MS = 5 * 60 * 1e3;
var EMAIL_BAN_DURATION_MS = 10 * 60 * 1e3;
var IP_BAN_DURATION_MS = 24 * 60 * 60 * 1e3;
var MAX_FAILED_ATTEMPTS_BEFORE_BAN = 5;
var SESSION_COOKIE = "admin_session";
function getSessionCookie(req) {
  return req.cookies?.[SESSION_COOKIE] || void 0;
}
function setSessionCookie(res, sessionId, expiresAt) {
  res.cookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: true,
    // Always secure (site is HTTPS only)
    sameSite: "lax",
    // lax to allow navigation from email links
    expires: expiresAt,
    path: "/"
  });
}
function generateOtp() {
  return String(1e4 + import_node_crypto2.default.randomInt(9e4));
}
function sanitizeEmail(email) {
  return email.toLowerCase().trim().replace(/[^a-z0-9@._+-]/g, "");
}
async function getSession(req) {
  const token = getSessionCookie(req);
  if (!token) return null;
  try {
    const [session] = await db.select().from(adminSessionsTable).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(adminSessionsTable.id, token), (0, import_drizzle_orm5.gt)(adminSessionsTable.expiresAt, /* @__PURE__ */ new Date()))).limit(1);
    return session ?? null;
  } catch {
    return null;
  }
}
async function requireAdminSession(req, res, next) {
  const session = await getSession(req);
  if (!session) {
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.status(401).json({ error: "UNAUTHORIZED", message: "Not authenticated" });
    return;
  }
  req.adminEmail = session.email;
  try {
    await next(req, res);
  } catch (err) {
    logger.error(`[admin] Route error: ${err.message}`);
    if (!res.headersSent) res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
}
async function checkIpBan(ip) {
  try {
    const [ban] = await db.select().from(ipBansTable).where((0, import_drizzle_orm5.eq)(ipBansTable.ipAddress, ip)).limit(1);
    if (ban && ban.bannedUntil > /* @__PURE__ */ new Date()) {
      const min = Math.ceil((ban.bannedUntil.getTime() - Date.now()) / 6e4);
      return `IP anda diblokir selama ${min} menit lagi karena terlalu banyak percobaan masuk.`;
    }
  } catch {
  }
  return null;
}
async function checkEmailBan(email) {
  try {
    const [ban] = await db.select().from(emailBansTable).where((0, import_drizzle_orm5.eq)(emailBansTable.email, email)).limit(1);
    if (ban && ban.bannedUntil > /* @__PURE__ */ new Date()) {
      const min = Math.ceil((ban.bannedUntil.getTime() - Date.now()) / 6e4);
      return `Email anda diblokir selama ${min} menit lagi. Coba lagi nanti.`;
    }
  } catch {
  }
  return null;
}
async function recordFailedAttempt(ip, email) {
  try {
    const [existing] = await db.select().from(loginAttemptsTable).where((0, import_drizzle_orm5.eq)(loginAttemptsTable.ipAddress, ip)).limit(1);
    const count3 = (existing?.attemptCount ?? 0) + 1;
    if (existing) {
      await db.update(loginAttemptsTable).set({ attemptCount: count3, lastAttemptAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm5.eq)(loginAttemptsTable.id, existing.id));
    } else {
      await db.insert(loginAttemptsTable).values({ id: import_node_crypto2.default.randomUUID(), ipAddress: ip, email, attemptCount: count3, lastAttemptAt: /* @__PURE__ */ new Date() });
    }
    if (count3 >= MAX_FAILED_ATTEMPTS_BEFORE_BAN) {
      const bannedUntil = new Date(Date.now() + IP_BAN_DURATION_MS);
      await db.insert(ipBansTable).values({ id: import_node_crypto2.default.randomUUID(), ipAddress: ip, bannedUntil, reason: "Too many failed login attempts", createdAt: /* @__PURE__ */ new Date() }).onConflictDoUpdate({ target: ipBansTable.ipAddress, set: { bannedUntil } });
      const emailBannedUntil = new Date(Date.now() + EMAIL_BAN_DURATION_MS);
      await db.insert(emailBansTable).values({ id: import_node_crypto2.default.randomUUID(), email, bannedUntil: emailBannedUntil, reason: "Too many failed login attempts", createdAt: /* @__PURE__ */ new Date() }).onConflictDoUpdate({ target: emailBansTable.email, set: { bannedUntil: emailBannedUntil } });
    }
  } catch {
  }
}
async function resetFailedAttempts(ip, email) {
  try {
    await Promise.all([
      db.delete(loginAttemptsTable).where((0, import_drizzle_orm5.eq)(loginAttemptsTable.ipAddress, ip)),
      db.delete(ipBansTable).where((0, import_drizzle_orm5.eq)(ipBansTable.ipAddress, ip)),
      db.delete(emailBansTable).where((0, import_drizzle_orm5.eq)(emailBansTable.email, email))
    ]);
  } catch {
  }
}
router4.get("/admin/session", async (req, res) => {
  const session = await getSession(req);
  if (!session) {
    res.status(401).json({ authenticated: false });
    return;
  }
  res.json({ authenticated: true, email: session.email, expiresAt: session.expiresAt.toISOString() });
});
async function handleRequestOtp(req, res) {
  const raw = req.body?.email;
  if (!raw || typeof raw !== "string") {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Email is required" });
    return;
  }
  const email = sanitizeEmail(raw);
  const ip = getClientIp(req);
  const ipBanMsg = await checkIpBan(ip);
  if (ipBanMsg) {
    res.status(403).json({ error: "IP_BANNED", message: ipBanMsg });
    return;
  }
  const emailBanMsg = await checkEmailBan(email);
  if (emailBanMsg) {
    res.status(403).json({ error: "EMAIL_BANNED", message: emailBanMsg });
    return;
  }
  if (!ALLOWED_ADMIN_EMAILS.includes(email)) {
    await recordFailedAttempt(ip, email);
    res.status(403).json({ error: "FORBIDDEN", message: "Email tidak terdaftar sebagai admin." });
    return;
  }
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_DURATION_MS);
  try {
    await db.delete(adminOtpsTable).where((0, import_drizzle_orm5.eq)(adminOtpsTable.email, email));
    await db.insert(adminOtpsTable).values({
      id: import_node_crypto2.default.randomUUID(),
      email,
      otp,
      used: false,
      expiresAt,
      createdAt: /* @__PURE__ */ new Date()
    });
    logger.info(`[admin] OTP stored for ${email} \u2014 expires ${expiresAt.toISOString()}`);
  } catch (err) {
    logger.error(`[admin] Failed to store OTP for ${email}: ${err.message}`);
    res.status(500).json({ error: "DB_ERROR", message: "Gagal menyimpan OTP. Coba lagi." });
    return;
  }
  try {
    await sendOtpEmail(email, otp);
    logger.info(`[admin] OTP email sent to ${email} from IP ${ip}`);
  } catch (err) {
    logger.error(`[admin] Failed to send OTP email to ${email}: ${err.message}`);
    await db.delete(adminOtpsTable).where((0, import_drizzle_orm5.eq)(adminOtpsTable.email, email)).catch(() => {
    });
    res.status(500).json({ error: "MAIL_ERROR", message: "Gagal mengirim OTP ke email. Coba lagi." });
    return;
  }
  res.json({ success: true, message: "OTP dikirim ke email kamu." });
}
async function handleVerifyOtp(req, res) {
  const raw = req.body?.email;
  const otpInput = req.body?.otp;
  if (!raw || !otpInput) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Email dan OTP diperlukan" });
    return;
  }
  const email = sanitizeEmail(raw);
  const otpClean = String(otpInput).replace(/\D/g, "").trim();
  const ip = getClientIp(req);
  const ipBanMsg = await checkIpBan(ip);
  if (ipBanMsg) {
    res.status(403).json({ error: "IP_BANNED", message: ipBanMsg });
    return;
  }
  if (!ALLOWED_ADMIN_EMAILS.includes(email)) {
    res.status(403).json({ error: "FORBIDDEN", message: "Email tidak terdaftar" });
    return;
  }
  try {
    const [latestOtp] = await db.select().from(adminOtpsTable).where((0, import_drizzle_orm5.eq)(adminOtpsTable.email, email)).orderBy((0, import_drizzle_orm5.desc)(adminOtpsTable.createdAt)).limit(1);
    if (!latestOtp) {
      logger.warn(`[admin] Verify: no OTP found in DB for ${email}`);
      await recordFailedAttempt(ip, email);
      res.status(401).json({ error: "INVALID_OTP", message: "OTP tidak ditemukan. Minta OTP baru." });
      return;
    }
    const now = /* @__PURE__ */ new Date();
    if (latestOtp.used) {
      logger.warn(`[admin] Verify: OTP already used for ${email}`);
      await recordFailedAttempt(ip, email);
      res.status(401).json({ error: "OTP_USED", message: "OTP sudah digunakan. Minta OTP baru." });
      return;
    }
    if (latestOtp.expiresAt <= now) {
      logger.warn(`[admin] Verify: OTP expired for ${email} (expired ${latestOtp.expiresAt.toISOString()})`);
      await recordFailedAttempt(ip, email);
      res.status(401).json({ error: "OTP_EXPIRED", message: "OTP sudah kadaluarsa. Minta OTP baru." });
      return;
    }
    if (latestOtp.otp !== otpClean) {
      logger.warn(`[admin] Verify: OTP mismatch for ${email} (input length: ${otpClean.length})`);
      await recordFailedAttempt(ip, email);
      res.status(401).json({ error: "INVALID_OTP", message: "Kode OTP salah." });
      return;
    }
    await db.update(adminOtpsTable).set({ used: true }).where((0, import_drizzle_orm5.eq)(adminOtpsTable.id, latestOtp.id));
    await resetFailedAttempts(ip, email);
    const sessionId = import_node_crypto2.default.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    await db.insert(adminSessionsTable).values({
      id: sessionId,
      email,
      expiresAt,
      createdAt: /* @__PURE__ */ new Date()
    });
    setSessionCookie(res, sessionId, expiresAt);
    logger.info(`[admin] \u2705 Login sukses: ${email} from IP ${ip} \u2014 session ${sessionId.slice(0, 8)}...`);
    res.json({ success: true, email });
  } catch (err) {
    const errMsg = err.message;
    logger.error(`[admin] OTP verify error for ${email}: ${errMsg}`);
    res.status(500).json({ error: "SERVER_ERROR", message: `Gagal verifikasi: ${errMsg.slice(0, 100)}` });
  }
}
router4.post("/admin/login", adminLoginRateLimit, handleRequestOtp);
router4.post("/admin/verify", adminLoginRateLimit, handleVerifyOtp);
router4.post("/admin/auth/request-otp", adminLoginRateLimit, handleRequestOtp);
router4.post("/admin/auth/verify-otp", adminLoginRateLimit, handleVerifyOtp);
async function handleLogout(req, res) {
  const token = getSessionCookie(req);
  if (token) await db.delete(adminSessionsTable).where((0, import_drizzle_orm5.eq)(adminSessionsTable.id, token)).catch(() => {
  });
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.json({ success: true });
}
router4.post("/admin/logout", handleLogout);
router4.post("/admin/auth/logout", handleLogout);
router4.get("/admin/auth/me", async (req, res) => {
  const session = await getSession(req);
  if (!session) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }
  res.json({ email: session.email, expiresAt: session.expiresAt.toISOString() });
});
router4.get("/admin/pending", async (req, res) => {
  await requireAdminSession(req, res, async (_req, res2) => {
    try {
      const snippets = await db.select().from(snippetsTable).where((0, import_drizzle_orm5.eq)(snippetsTable.status, "pending")).orderBy((0, import_drizzle_orm5.desc)(snippetsTable.createdAt)).limit(100);
      res2.json({ data: snippets.map((s) => ({ ...s, tags: s.tags ?? [], createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString() })) });
    } catch {
      res2.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch pending snippets" });
    }
  });
});
router4.get("/admin/all-snippets", async (req, res) => {
  await requireAdminSession(req, res, async (req2, res2) => {
    const status = req2.query.status;
    const limit = Math.min(Number(req2.query.limit) || 50, 200);
    const page = Math.max(Number(req2.query.page) || 1, 1);
    const offset = (page - 1) * limit;
    try {
      const where = status ? (0, import_drizzle_orm5.eq)(snippetsTable.status, status) : void 0;
      const [snippets, [{ total }]] = await Promise.all([
        db.select().from(snippetsTable).where(where).orderBy((0, import_drizzle_orm5.desc)(snippetsTable.createdAt)).limit(limit).offset(offset),
        db.select({ total: (0, import_drizzle_orm5.sum)(snippetsTable.id) }).from(snippetsTable).where(where)
      ]);
      res2.json({
        data: snippets.map((s) => ({ ...s, tags: s.tags ?? [], createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString() })),
        pagination: { page, limit, total: Number(total ?? 0), totalPages: Math.ceil(Number(total ?? 0) / limit) }
      });
    } catch {
      res2.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch snippets" });
    }
  });
});
router4.get("/admin/snippets", async (req, res) => {
  await requireAdminSession(req, res, async (req2, res2) => {
    const status = req2.query.status;
    const limit = Math.min(Number(req2.query.limit) || 50, 200);
    const page = Math.max(Number(req2.query.page) || 1, 1);
    const offset = (page - 1) * limit;
    try {
      const where = status ? (0, import_drizzle_orm5.eq)(snippetsTable.status, status) : void 0;
      const [snippets, [{ total }]] = await Promise.all([
        db.select().from(snippetsTable).where(where).orderBy((0, import_drizzle_orm5.desc)(snippetsTable.createdAt)).limit(limit).offset(offset),
        db.select({ total: (0, import_drizzle_orm5.sum)(snippetsTable.id) }).from(snippetsTable).where(where)
      ]);
      res2.json({
        data: snippets.map((s) => ({ ...s, tags: s.tags ?? [], createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString() })),
        pagination: { page, limit, total: Number(total ?? 0), totalPages: Math.ceil(Number(total ?? 0) / limit) }
      });
    } catch {
      res2.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch snippets" });
    }
  });
});
router4.post("/admin/snippets/:id/approve", async (req, res) => {
  await requireAdminSession(req, res, async (req2, res2) => {
    try {
      const [snippet] = await db.select().from(snippetsTable).where((0, import_drizzle_orm5.eq)(snippetsTable.id, req2.params.id)).limit(1);
      if (!snippet) {
        res2.status(404).json({ error: "NOT_FOUND" });
        return;
      }
      const [updated] = await db.update(snippetsTable).set({ status: "approved", rejectReason: null, updatedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm5.eq)(snippetsTable.id, req2.params.id)).returning();
      sendApprovalEmail(snippet.authorEmail, snippet.title, snippet.id).catch(() => {
      });
      res2.json({ ...updated, tags: updated.tags ?? [], createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
    } catch {
      res2.status(500).json({ error: "SERVER_ERROR", message: "Failed to approve snippet" });
    }
  });
});
router4.post("/admin/snippets/:id/reject", async (req, res) => {
  await requireAdminSession(req, res, async (req2, res2) => {
    const { reason } = req2.body;
    try {
      const [snippet] = await db.select().from(snippetsTable).where((0, import_drizzle_orm5.eq)(snippetsTable.id, req2.params.id)).limit(1);
      if (!snippet) {
        res2.status(404).json({ error: "NOT_FOUND" });
        return;
      }
      const [updated] = await db.update(snippetsTable).set({ status: "rejected", rejectReason: reason ?? null, updatedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm5.eq)(snippetsTable.id, req2.params.id)).returning();
      sendRejectionEmail(snippet.authorEmail, snippet.title, reason).catch(() => {
      });
      res2.json({ ...updated, tags: updated.tags ?? [], createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
    } catch {
      res2.status(500).json({ error: "SERVER_ERROR", message: "Failed to reject snippet" });
    }
  });
});
router4.patch("/admin/snippets/:id", async (req, res) => {
  await requireAdminSession(req, res, async (req2, res2) => {
    const { status, rejectReason } = req2.body;
    if (!["approved", "rejected", "pending"].includes(status)) {
      res2.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid status" });
      return;
    }
    try {
      const [snippet] = await db.select().from(snippetsTable).where((0, import_drizzle_orm5.eq)(snippetsTable.id, req2.params.id)).limit(1);
      if (!snippet) {
        res2.status(404).json({ error: "NOT_FOUND" });
        return;
      }
      const [updated] = await db.update(snippetsTable).set({ status, rejectReason: status === "rejected" ? rejectReason ?? null : null, updatedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm5.eq)(snippetsTable.id, req2.params.id)).returning();
      if (status === "approved") sendApprovalEmail(snippet.authorEmail, snippet.title, snippet.id).catch(() => {
      });
      else if (status === "rejected") sendRejectionEmail(snippet.authorEmail, snippet.title, rejectReason).catch(() => {
      });
      res2.json({ ...updated, tags: updated.tags ?? [], createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
    } catch {
      res2.status(500).json({ error: "SERVER_ERROR", message: "Failed to update snippet" });
    }
  });
});
router4.delete("/admin/snippets/:id", async (req, res) => {
  await requireAdminSession(req, res, async (req2, res2) => {
    try {
      await db.delete(snippetsTable).where((0, import_drizzle_orm5.eq)(snippetsTable.id, req2.params.id));
      res2.json({ success: true });
    } catch {
      res2.status(500).json({ error: "SERVER_ERROR", message: "Failed to delete snippet" });
    }
  });
});
router4.post("/admin/ban-email", async (req, res) => {
  await requireAdminSession(req, res, async (req2, res2) => {
    const { email, reason, durationMs } = req2.body;
    if (!email) {
      res2.status(400).json({ error: "VALIDATION_ERROR", message: "Email required" });
      return;
    }
    const sanitized = sanitizeEmail(email);
    const bannedUntil = new Date(Date.now() + (durationMs ?? 365 * 24 * 60 * 60 * 1e3));
    try {
      await db.insert(emailBansTable).values({ id: import_node_crypto2.default.randomUUID(), email: sanitized, bannedUntil, reason: reason ?? "Diblokir oleh admin", createdAt: /* @__PURE__ */ new Date() }).onConflictDoUpdate({ target: emailBansTable.email, set: { bannedUntil, reason: reason ?? "Diblokir oleh admin" } });
      logger.info(`[admin] Email banned: ${sanitized}`);
      res2.json({ success: true, message: `Email ${sanitized} telah diblokir.` });
    } catch {
      res2.status(500).json({ error: "SERVER_ERROR", message: "Gagal memblokir email" });
    }
  });
});
router4.get("/admin/security/bans", async (req, res) => {
  await requireAdminSession(req, res, async (_req, res2) => {
    try {
      const [ipBans, emailBans] = await Promise.all([
        db.select().from(ipBansTable).orderBy((0, import_drizzle_orm5.desc)(ipBansTable.createdAt)),
        db.select().from(emailBansTable).orderBy((0, import_drizzle_orm5.desc)(emailBansTable.createdAt))
      ]);
      res2.json({
        ipBans: ipBans.map((b) => ({ ...b, bannedUntil: b.bannedUntil.toISOString(), createdAt: b.createdAt.toISOString() })),
        emailBans: emailBans.map((b) => ({ ...b, bannedUntil: b.bannedUntil.toISOString(), createdAt: b.createdAt.toISOString() }))
      });
    } catch {
      res2.status(500).json({ error: "SERVER_ERROR" });
    }
  });
});
router4.delete("/admin/security/bans/ip/:id", async (req, res) => {
  await requireAdminSession(req, res, async (req2, res2) => {
    await db.delete(ipBansTable).where((0, import_drizzle_orm5.eq)(ipBansTable.id, req2.params.id)).catch(() => {
    });
    res2.json({ success: true });
  });
});
router4.delete("/admin/security/bans/email/:id", async (req, res) => {
  await requireAdminSession(req, res, async (req2, res2) => {
    await db.delete(emailBansTable).where((0, import_drizzle_orm5.eq)(emailBansTable.id, req2.params.id)).catch(() => {
    });
    res2.json({ success: true });
  });
});
async function handleBroadcast(req, res, targetEmail) {
  const { subject, message, adminInitial } = req.body;
  const adminEmail = req.adminEmail;
  if (!subject || !message) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "subject and message required" });
    return;
  }
  let recipients;
  if (targetEmail) {
    recipients = [targetEmail];
  } else {
    const authors = await db.selectDistinct({ email: snippetsTable.authorEmail }).from(snippetsTable);
    recipients = authors.map((a) => a.authorEmail).filter(Boolean);
  }
  if (recipients.length === 0) {
    res.status(400).json({ error: "NO_RECIPIENTS", message: "Tidak ada penerima." });
    return;
  }
  let sent = 0;
  let failed = 0;
  await Promise.allSettled(
    recipients.map((r) => sendBroadcastEmail(r, subject, message).then(() => {
      sent++;
    }).catch(() => {
      failed++;
    }))
  );
  await db.insert(broadcastLogsTable).values({
    id: import_node_crypto2.default.randomUUID(),
    adminEmail,
    adminInitial: adminInitial ?? adminEmail[0]?.toUpperCase() ?? "A",
    targetEmail: targetEmail ?? null,
    subject,
    message,
    recipientCount: sent,
    createdAt: /* @__PURE__ */ new Date()
  }).catch(() => {
  });
  res.json({ success: true, sent, failed, recipientCount: sent });
}
router4.post("/admin/broadcast/all", async (req, res) => {
  await requireAdminSession(req, res, async (req2, res2) => {
    try {
      await handleBroadcast(req2, res2);
    } catch (err) {
      logger.error(`[admin] Broadcast all failed: ${err.message}`);
      res2.status(500).json({ error: "MAIL_ERROR", message: "Gagal mengirim broadcast." });
    }
  });
});
router4.post("/admin/broadcast/one", async (req, res) => {
  await requireAdminSession(req, res, async (req2, res2) => {
    const { targetEmail } = req2.body;
    if (!targetEmail) {
      res2.status(400).json({ error: "VALIDATION_ERROR", message: "targetEmail required" });
      return;
    }
    try {
      await handleBroadcast(req2, res2, targetEmail);
    } catch (err) {
      logger.error(`[admin] Broadcast one failed: ${err.message}`);
      res2.status(500).json({ error: "MAIL_ERROR", message: "Gagal mengirim email." });
    }
  });
});
router4.post("/admin/broadcast", async (req, res) => {
  await requireAdminSession(req, res, async (req2, res2) => {
    const targetEmail = req2.body?.targetEmail;
    try {
      await handleBroadcast(req2, res2, targetEmail);
    } catch (err) {
      logger.error(`[admin] Broadcast failed: ${err.message}`);
      res2.status(500).json({ error: "MAIL_ERROR", message: "Gagal mengirim broadcast." });
    }
  });
});
router4.get("/admin/broadcast-logs", async (req, res) => {
  await requireAdminSession(req, res, async (req2, res2) => {
    const limit = Math.min(Number(req2.query.limit) || 50, 200);
    try {
      const logs = await db.select().from(broadcastLogsTable).orderBy((0, import_drizzle_orm5.desc)(broadcastLogsTable.createdAt)).limit(limit);
      res2.json({ data: logs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })) });
    } catch {
      res2.status(500).json({ error: "SERVER_ERROR" });
    }
  });
});
router4.post("/admin/test-email", async (req, res) => {
  await requireAdminSession(req, res, async (req2, res2) => {
    const adminEmail = req2.adminEmail;
    try {
      await sendTestEmail(adminEmail);
      res2.json({ success: true });
    } catch (err) {
      res2.status(500).json({ error: "MAIL_ERROR", message: err.message });
    }
  });
});
router4.get("/admin/api-keys", async (req, res) => requireAdminSession(req, res, (req2, res2) => listApiKeys(req2, res2)));
router4.post("/admin/api-keys", async (req, res) => requireAdminSession(req, res, (req2, res2) => createApiKey(req2, res2)));
router4.patch("/admin/api-keys/:id", async (req, res) => requireAdminSession(req, res, (req2, res2) => updateApiKey(req2, res2)));
router4.delete("/admin/api-keys/:id", async (req, res) => requireAdminSession(req, res, (req2, res2) => deleteApiKey(req2, res2)));
router4.get("/admin/ip-whitelist", async (req, res) => requireAdminSession(req, res, (req2, res2) => listIpWhitelist(req2, res2)));
router4.post("/admin/ip-whitelist", async (req, res) => requireAdminSession(req, res, (req2, res2) => addIpWhitelist(req2, res2)));
router4.patch("/admin/ip-whitelist/:id", async (req, res) => requireAdminSession(req, res, (req2, res2) => updateIpWhitelist(req2, res2)));
router4.delete("/admin/ip-whitelist/:id", async (req, res) => requireAdminSession(req, res, (req2, res2) => deleteIpWhitelist(req2, res2)));
router4.get("/admin/request-logs", async (req, res) => requireAdminSession(req, res, (req2, res2) => getRequestLogs(req2, res2)));
var admin_default = router4;

// server/routes/index.ts
var router5 = (0, import_express5.Router)();
router5.use(health_default);
router5.use(admin_default);
router5.use(snippets_default);
router5.use(stats_default);
var routes_default = router5;

// server/middleware/request-logger.ts
var import_node_crypto3 = __toESM(require("node:crypto"), 1);
function requestLogger(req, res, next) {
  const start = Date.now();
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  res.on("finish", () => {
    const apiKey = req.apiKey;
    const responseTimeMs = Date.now() - start;
    const path = req.path.split("?")[0].slice(0, 200);
    if (!path.startsWith("/api")) return;
    db.insert(requestLogsTable).values({
      id: import_node_crypto3.default.randomUUID(),
      ipAddress: ip,
      method: req.method,
      path,
      statusCode: res.statusCode,
      apiKeyId: apiKey?.id ?? null,
      apiKeyPrefix: apiKey?.keyPrefix ?? null,
      blocked: res.statusCode === 403 || res.statusCode === 429,
      blockReason: res.statusCode === 429 ? "RATE_LIMITED" : res.statusCode === 403 ? "FORBIDDEN" : null,
      responseTimeMs,
      userAgent: req.headers["user-agent"]?.slice(0, 200) ?? null,
      createdAt: /* @__PURE__ */ new Date()
    }).catch(() => {
    });
  });
  next();
}

// server/app.ts
var app = (0, import_express6.default)();
app.set("trust proxy", 1);
app.use(
  (0, import_pino_http.default)({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      }
    }
  })
);
app.use(securityHeaders);
app.use(
  (0, import_cors.default)({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Webhook-Secret", "X-API-Key"]
  })
);
app.use((0, import_cookie_parser.default)(process.env.SESSION_SECRET || "kaai-fallback-secret-change-me"));
app.use(import_express6.default.json({ limit: "2mb" }));
app.use(import_express6.default.urlencoded({ extended: true, limit: "2mb" }));
app.use(globalRateLimit);
app.use(requestLogger);
app.use("/api", routes_default);
app.use(safeErrorHandler);
async function runMigrations() {
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
      `INSERT INTO admin_users (id, email, name, is_active) VALUES
        (gen_random_uuid()::text, 'akaanakbaik17@proton.me', 'Aka', TRUE),
        (gen_random_uuid()::text, 'yaudahpakeaja6@gmail.com', 'Admin', TRUE),
        (gen_random_uuid()::text, 'kelvdra46@gmail.com', 'Kelv', TRUE),
        (gen_random_uuid()::text, 'clpmadang@gmail.com', 'Admin', TRUE)
       ON CONFLICT (email) DO NOTHING`
    ];
    let ok = 0;
    for (const sql2 of migrations) {
      try {
        await client.query(sql2);
        ok++;
      } catch {
      }
    }
    logger.info(`[migration] Completed: ${ok}/${migrations.length} statements OK`);
  } catch (err) {
    logger.warn({ err }, "[migration] Migration batch failed \u2014 continuing anyway");
  } finally {
    client.release();
  }
}
runMigrations().catch((err) => {
  logger.warn({ err }, "[migration] Failed to run migrations");
});
var app_default = app;
