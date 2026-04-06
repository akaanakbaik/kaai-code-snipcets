import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Snippets ─────────────────────────────────────────────────────────────────

export const snippetStatusEnum = pgEnum("snippet_status", [
  "pending",
  "approved",
  "rejected",
]);

export const snippetsTable = pgTable("snippets", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  language: text("language").notNull(),
  tags: text("tags").array().notNull().default([]),
  code: text("code").notNull(),
  authorName: text("author_name").notNull(),
  authorEmail: text("author_email").notNull(),
  status: snippetStatusEnum("status").notNull().default("pending"),
  rejectReason: text("reject_reason"),
  viewCount: integer("view_count").notNull().default(0),
  copyCount: integer("copy_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSnippetSchema = createInsertSchema(snippetsTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertSnippet = z.infer<typeof insertSnippetSchema>;
export type Snippet = typeof snippetsTable.$inferSelect;

// ─── Admin ────────────────────────────────────────────────────────────────────

export const adminUsersTable = pgTable("admin_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminSessionsTable = pgTable("admin_sessions", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminOtpsTable = pgTable("admin_otps", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  otp: text("otp").notNull(),
  used: boolean("used").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ipBansTable = pgTable("ip_bans", {
  id: text("id").primaryKey(),
  ipAddress: text("ip_address").notNull().unique(),
  bannedUntil: timestamp("banned_until", { withTimezone: true }).notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emailBansTable = pgTable("email_bans", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  bannedUntil: timestamp("banned_until", { withTimezone: true }).notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const loginAttemptsTable = pgTable("login_attempts", {
  id: text("id").primaryKey(),
  ipAddress: text("ip_address").notNull(),
  email: text("email"),
  attemptCount: integer("attempt_count").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }).notNull().defaultNow(),
});

export const broadcastLogsTable = pgTable("broadcast_logs", {
  id: text("id").primaryKey(),
  adminEmail: text("admin_email").notNull(),
  adminInitial: text("admin_initial"),
  targetEmail: text("target_email"),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  recipientCount: integer("recipient_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Security / API Keys ──────────────────────────────────────────────────────

export const apiKeysTable = pgTable("api_keys", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  keyPrefix: text("key_prefix").notNull(),
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

export const adminIpWhitelistTable = pgTable("admin_ip_whitelist", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  ipAddress: text("ip_address").notNull(),
  label: text("label"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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

export const apiKeyUsageTable = pgTable("api_key_usage", {
  id: text("id").primaryKey(),
  apiKeyId: text("api_key_id").notNull(),
  date: text("date").notNull(),
  month: text("month").notNull(),
  requestsToday: integer("requests_today").notNull().default(0),
  requestsMonth: integer("requests_month").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdminUser = typeof adminUsersTable.$inferSelect;
export type AdminSession = typeof adminSessionsTable.$inferSelect;
export type AdminOtp = typeof adminOtpsTable.$inferSelect;
export type IpBan = typeof ipBansTable.$inferSelect;
export type EmailBan = typeof emailBansTable.$inferSelect;
export type LoginAttempt = typeof loginAttemptsTable.$inferSelect;
export type BroadcastLog = typeof broadcastLogsTable.$inferSelect;
export type ApiKey = typeof apiKeysTable.$inferSelect;
export type RequestLog = typeof requestLogsTable.$inferSelect;
