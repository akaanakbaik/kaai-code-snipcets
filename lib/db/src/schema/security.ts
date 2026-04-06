import { pgTable, text, timestamp, boolean, integer, bigint } from "drizzle-orm/pg-core";

// ─── API Keys ─────────────────────────────────────────────────────────────────

export const apiKeysTable = pgTable("api_keys", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),           // SHA-256 hash of raw key
  keyPrefix: text("key_prefix").notNull(),       // first 12 chars shown in UI
  name: text("name").notNull(),
  ownerEmail: text("owner_email").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  rateLimitPerSecond: integer("rate_limit_per_second").notNull().default(10),
  rateLimitPerDay: integer("rate_limit_per_day").notNull().default(1000),
  rateLimitPerMonth: integer("rate_limit_per_month").notNull().default(10000),
  totalRequests: integer("total_requests").notNull().default(0),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Admin IP Whitelist ───────────────────────────────────────────────────────

export const adminIpWhitelistTable = pgTable("admin_ip_whitelist", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  ipAddress: text("ip_address").notNull(),
  label: text("label"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Request Logs (rolling security log) ─────────────────────────────────────

export const requestLogsTable = pgTable("request_logs", {
  id: text("id").primaryKey(),
  ipAddress: text("ip_address").notNull(),
  method: text("method").notNull(),
  path: text("path").notNull(),
  statusCode: integer("status_code"),
  apiKeyId: text("api_key_id"),
  apiKeyPrefix: text("api_key_prefix"),
  blocked: boolean("blocked").notNull().default(false),
  blockReason: text("block_reason"),
  responseTimeMs: integer("response_time_ms"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── API Key Usage Counters (in-memory friendly; cleared per day/month) ───────

export const apiKeyUsageTable = pgTable("api_key_usage", {
  id: text("id").primaryKey(),
  apiKeyId: text("api_key_id").notNull(),
  date: text("date").notNull(),          // YYYY-MM-DD
  month: text("month").notNull(),        // YYYY-MM
  requestsToday: integer("requests_today").notNull().default(0),
  requestsMonth: integer("requests_month").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type ApiKey = typeof apiKeysTable.$inferSelect;
export type AdminIpWhitelist = typeof adminIpWhitelistTable.$inferSelect;
export type RequestLog = typeof requestLogsTable.$inferSelect;
export type ApiKeyUsage = typeof apiKeyUsageTable.$inferSelect;
