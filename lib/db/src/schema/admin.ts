import { pgTable, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const adminUsersTable = pgTable("admin_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const adminSessionsTable = pgTable("admin_sessions", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const adminOtpsTable = pgTable("admin_otps", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  otp: text("otp").notNull(),
  used: boolean("used").notNull().default(false),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ipBansTable = pgTable("ip_bans", {
  id: text("id").primaryKey(),
  ipAddress: text("ip_address").notNull().unique(),
  bannedUntil: timestamp("banned_until").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const emailBansTable = pgTable("email_bans", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  bannedUntil: timestamp("banned_until").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const loginAttemptsTable = pgTable("login_attempts", {
  id: text("id").primaryKey(),
  ipAddress: text("ip_address").notNull(),
  email: text("email"),
  attemptCount: integer("attempt_count").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at").notNull().defaultNow(),
});

export const broadcastLogsTable = pgTable("broadcast_logs", {
  id: text("id").primaryKey(),
  adminEmail: text("admin_email").notNull(),
  adminInitial: text("admin_initial"),
  targetEmail: text("target_email"),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  recipientCount: integer("recipient_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AdminUser = typeof adminUsersTable.$inferSelect;
export type AdminSession = typeof adminSessionsTable.$inferSelect;
export type AdminOtp = typeof adminOtpsTable.$inferSelect;
export type IpBan = typeof ipBansTable.$inferSelect;
export type EmailBan = typeof emailBansTable.$inferSelect;
export type LoginAttempt = typeof loginAttemptsTable.$inferSelect;
export type BroadcastLog = typeof broadcastLogsTable.$inferSelect;
