import { Router, type Request, type Response } from "express";
import { db, dbSupabase1 } from "../lib/db.js";
import {
  adminUsersTable, adminSessionsTable, adminOtpsTable,
  ipBansTable, emailBansTable, loginAttemptsTable,
  broadcastLogsTable, snippetsTable,
} from "../lib/schema.js";
import { eq, and, gt, desc, sum, count } from "drizzle-orm";
import crypto from "node:crypto";
import {
  sendOtpEmail, sendApprovalEmail, sendRejectionEmail, sendBroadcastEmail, sendTestEmail,
} from "../lib/mailer.js";
import { logger } from "../lib/logger.js";
import { adminLoginRateLimit, getClientIp } from "../middleware/security.js";
import {
  listApiKeys, createApiKey, updateApiKey, deleteApiKey,
  listIpWhitelist, addIpWhitelist, updateIpWhitelist, deleteIpWhitelist,
  getRequestLogs,
} from "./api-keys.js";

const router = Router();

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_ADMIN_EMAILS = [
  "akaanakbaik17@proton.me",
  "yaudahpakeaja6@gmail.com",
  "kelvdra46@gmail.com",
  "clpmadang@gmail.com",
];

const SESSION_DURATION_MS            = 24 * 60 * 60 * 1000;    // 24h
const OTP_DURATION_MS                = 5 * 60 * 1000;           // 5m
const EMAIL_BAN_DURATION_MS          = 10 * 60 * 1000;          // 10m
const IP_BAN_DURATION_MS             = 24 * 60 * 60 * 1000;     // 24h
const MAX_FAILED_ATTEMPTS_BEFORE_BAN = 5;

// ─── Cookie helpers ───────────────────────────────────────────────────────────

const SESSION_COOKIE = "admin_session";

function getSessionCookie(req: Request): string | undefined {
  // Use plain cookie (HttpOnly + HTTPS = secure enough)
  return (req.cookies?.[SESSION_COOKIE] as string | undefined) || undefined;
}

function setSessionCookie(res: Response, sessionId: string, expiresAt: Date): void {
  // Simple HttpOnly cookie — HTTPS provides transport security, no need for signed cookies
  res.cookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: true,          // Always secure (site is HTTPS only)
    sameSite: "lax",       // lax to allow navigation from email links
    expires: expiresAt,
    path: "/",
  });
}

// ─── OTP generator (5 digits to match frontend) ───────────────────────────────

function generateOtp(): string {
  return String(10000 + crypto.randomInt(90000)); // 10000–99999 → always 5 digits
}

function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim().replace(/[^a-z0-9@._+-]/g, "");
}

// ─── Session check ────────────────────────────────────────────────────────────

async function getSession(req: Request) {
  const token = getSessionCookie(req);
  if (!token) return null;
  try {
    const [session] = await db
      .select()
      .from(adminSessionsTable)
      .where(and(eq(adminSessionsTable.id, token), gt(adminSessionsTable.expiresAt, new Date())))
      .limit(1);
    return session ?? null;
  } catch {
    return null;
  }
}

async function requireAdminSession(
  req: Request,
  res: Response,
  next: (req: Request, res: Response) => Promise<void> | void,
): Promise<void> {
  const session = await getSession(req);
  if (!session) {
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.status(401).json({ error: "UNAUTHORIZED", message: "Not authenticated" });
    return;
  }
  (req as any).adminEmail = session.email;
  try {
    await next(req, res);
  } catch (err) {
    logger.error(`[admin] Route error: ${(err as Error).message}`);
    if (!res.headersSent) res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
}

// ─── Ban checks ───────────────────────────────────────────────────────────────

async function checkIpBan(ip: string): Promise<string | null> {
  try {
    const [ban] = await db.select().from(ipBansTable).where(eq(ipBansTable.ipAddress, ip)).limit(1);
    if (ban && ban.bannedUntil > new Date()) {
      const min = Math.ceil((ban.bannedUntil.getTime() - Date.now()) / 60000);
      return `IP anda diblokir selama ${min} menit lagi karena terlalu banyak percobaan masuk.`;
    }
  } catch { /* ignore */ }
  return null;
}

async function checkEmailBan(email: string): Promise<string | null> {
  try {
    const [ban] = await db.select().from(emailBansTable).where(eq(emailBansTable.email, email)).limit(1);
    if (ban && ban.bannedUntil > new Date()) {
      const min = Math.ceil((ban.bannedUntil.getTime() - Date.now()) / 60000);
      return `Email anda diblokir selama ${min} menit lagi. Coba lagi nanti.`;
    }
  } catch { /* ignore */ }
  return null;
}

async function recordFailedAttempt(ip: string, email: string): Promise<void> {
  try {
    const [existing] = await db.select().from(loginAttemptsTable).where(eq(loginAttemptsTable.ipAddress, ip)).limit(1);
    const count = (existing?.attemptCount ?? 0) + 1;

    if (existing) {
      await db.update(loginAttemptsTable).set({ attemptCount: count, lastAttemptAt: new Date() }).where(eq(loginAttemptsTable.id, existing.id));
    } else {
      await db.insert(loginAttemptsTable).values({ id: crypto.randomUUID(), ipAddress: ip, email, attemptCount: count, lastAttemptAt: new Date() });
    }

    if (count >= MAX_FAILED_ATTEMPTS_BEFORE_BAN) {
      const bannedUntil = new Date(Date.now() + IP_BAN_DURATION_MS);
      await db.insert(ipBansTable).values({ id: crypto.randomUUID(), ipAddress: ip, bannedUntil, reason: "Too many failed login attempts", createdAt: new Date() })
        .onConflictDoUpdate({ target: ipBansTable.ipAddress, set: { bannedUntil } });
      const emailBannedUntil = new Date(Date.now() + EMAIL_BAN_DURATION_MS);
      await db.insert(emailBansTable).values({ id: crypto.randomUUID(), email, bannedUntil: emailBannedUntil, reason: "Too many failed login attempts", createdAt: new Date() })
        .onConflictDoUpdate({ target: emailBansTable.email, set: { bannedUntil: emailBannedUntil } });
    }
  } catch { /* ignore */ }
}

async function resetFailedAttempts(ip: string, email: string): Promise<void> {
  try {
    await Promise.all([
      db.delete(loginAttemptsTable).where(eq(loginAttemptsTable.ipAddress, ip)),
      db.delete(ipBansTable).where(eq(ipBansTable.ipAddress, ip)),
      db.delete(emailBansTable).where(eq(emailBansTable.email, email)),
    ]);
  } catch { /* ignore */ }
}

// ─── Seed admin users in Supabase 1 ──────────────────────────────────────────
// Called on startup: ensures admin emails exist in admin_users table on Supabase 1

const ADMIN_NAMES: Record<string, string> = {
  "akaanakbaik17@proton.me": "aka",
  "yaudahpakeaja6@gmail.com": "youso",
  "kelvdra46@gmail.com": "hydra",
  "clpmadang@gmail.com": "udin",
};

export async function seedAdminUsers(): Promise<void> {
  const targets = [db, dbSupabase1].filter(Boolean) as typeof db[];

  for (const targetDb of targets) {
    for (const email of ALLOWED_ADMIN_EMAILS) {
      const name = ADMIN_NAMES[email] ?? email.split("@")[0];
      try {
        await targetDb
          .insert(adminUsersTable)
          .values({ id: crypto.randomUUID(), email, name, isActive: true, createdAt: new Date() })
          .onConflictDoUpdate({ target: adminUsersTable.email, set: { name } });
      } catch { /* ignore if table/row already exists or column mismatch */ }
    }
  }
  logger.info(`[admin] Admin users seeded into ${targets.length} DB(s) with correct names`);
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// Session check — used by both admin-login.tsx and admin.tsx
// Returns { authenticated: bool, email?: string }
router.get("/admin/session", async (req: Request, res: Response) => {
  const session = await getSession(req);
  if (!session) {
    res.status(401).json({ authenticated: false });
    return;
  }
  res.json({ authenticated: true, email: session.email, expiresAt: session.expiresAt.toISOString() });
});

// Request OTP — aliased to match frontend (/admin/login)
async function handleRequestOtp(req: Request, res: Response): Promise<void> {
  const raw = req.body?.email;
  if (!raw || typeof raw !== "string") {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Email is required" });
    return;
  }

  const email = sanitizeEmail(raw);
  const ip = getClientIp(req);

  const ipBanMsg = await checkIpBan(ip);
  if (ipBanMsg) { res.status(403).json({ error: "IP_BANNED", message: ipBanMsg }); return; }

  const emailBanMsg = await checkEmailBan(email);
  if (emailBanMsg) { res.status(403).json({ error: "EMAIL_BANNED", message: emailBanMsg }); return; }

  if (!ALLOWED_ADMIN_EMAILS.includes(email)) {
    await recordFailedAttempt(ip, email);
    res.status(403).json({ error: "FORBIDDEN", message: "Email tidak terdaftar sebagai admin." });
    return;
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_DURATION_MS);

  // Delete existing OTP and insert new one inside try-catch
  try {
    await db.delete(adminOtpsTable).where(eq(adminOtpsTable.email, email));
    await db.insert(adminOtpsTable).values({
      id: crypto.randomUUID(),
      email,
      otp,
      used: false,
      expiresAt,
      createdAt: new Date(),
    });
    logger.info(`[admin] OTP stored for ${email} — expires ${expiresAt.toISOString()}`);
  } catch (err) {
    logger.error(`[admin] Failed to store OTP for ${email}: ${(err as Error).message}`);
    res.status(500).json({ error: "DB_ERROR", message: "Gagal menyimpan OTP. Coba lagi." });
    return;
  }

  try {
    await sendOtpEmail(email, otp);
    logger.info(`[admin] OTP email sent to ${email} from IP ${ip}`);
  } catch (err) {
    logger.error(`[admin] Failed to send OTP email to ${email}: ${(err as Error).message}`);
    // OTP is in DB but email failed — clean up
    await db.delete(adminOtpsTable).where(eq(adminOtpsTable.email, email)).catch(() => {});
    res.status(500).json({ error: "MAIL_ERROR", message: "Gagal mengirim OTP ke email. Coba lagi." });
    return;
  }

  res.json({ success: true, message: "OTP dikirim ke email kamu." });
}

// Verify OTP — aliased to match frontend (/admin/verify)
async function handleVerifyOtp(req: Request, res: Response): Promise<void> {
  const raw = req.body?.email;
  const otpInput = req.body?.otp;

  if (!raw || !otpInput) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Email dan OTP diperlukan" });
    return;
  }

  const email = sanitizeEmail(raw);
  // Normalize OTP: strip whitespace, take only digits
  const otpClean = String(otpInput).replace(/\D/g, "").trim();
  const ip = getClientIp(req);

  const ipBanMsg = await checkIpBan(ip);
  if (ipBanMsg) { res.status(403).json({ error: "IP_BANNED", message: ipBanMsg }); return; }

  if (!ALLOWED_ADMIN_EMAILS.includes(email)) {
    res.status(403).json({ error: "FORBIDDEN", message: "Email tidak terdaftar" });
    return;
  }

  try {
    // Step 1: Find latest OTP for this email (diagnose exactly why it fails)
    const [latestOtp] = await db
      .select()
      .from(adminOtpsTable)
      .where(eq(adminOtpsTable.email, email))
      .orderBy(desc(adminOtpsTable.createdAt))
      .limit(1);

    if (!latestOtp) {
      logger.warn(`[admin] Verify: no OTP found in DB for ${email}`);
      await recordFailedAttempt(ip, email);
      res.status(401).json({ error: "INVALID_OTP", message: "OTP tidak ditemukan. Minta OTP baru." });
      return;
    }

    // Step 2: Check each condition and give precise error
    const now = new Date();
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

    // OTP is valid — mark as used
    await db.update(adminOtpsTable).set({ used: true }).where(eq(adminOtpsTable.id, latestOtp.id));
    await resetFailedAttempts(ip, email);

    // Create session
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    await db.insert(adminSessionsTable).values({
      id: sessionId,
      email,
      expiresAt,
      createdAt: new Date(),
    });

    setSessionCookie(res, sessionId, expiresAt);
    logger.info(`[admin] ✅ Login sukses: ${email} from IP ${ip} — session ${sessionId.slice(0, 8)}...`);
    res.json({ success: true, email });
  } catch (err) {
    const errMsg = (err as Error).message;
    logger.error(`[admin] OTP verify error for ${email}: ${errMsg}`);
    res.status(500).json({ error: "SERVER_ERROR", message: `Gagal verifikasi: ${errMsg.slice(0, 100)}` });
  }
}

// Frontend-facing routes (short names used by admin-login.tsx and admin.tsx)
router.post("/admin/login", adminLoginRateLimit, handleRequestOtp);
router.post("/admin/verify", adminLoginRateLimit, handleVerifyOtp);

// Legacy aliases (auth/*)
router.post("/admin/auth/request-otp", adminLoginRateLimit, handleRequestOtp);
router.post("/admin/auth/verify-otp", adminLoginRateLimit, handleVerifyOtp);

// Logout
async function handleLogout(req: Request, res: Response): Promise<void> {
  const token = getSessionCookie(req);
  if (token) await db.delete(adminSessionsTable).where(eq(adminSessionsTable.id, token)).catch(() => {});
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.json({ success: true });
}
router.post("/admin/logout", handleLogout);
router.post("/admin/auth/logout", handleLogout);

// Legacy session check alias
router.get("/admin/auth/me", async (req: Request, res: Response) => {
  const session = await getSession(req);
  if (!session) { res.status(401).json({ error: "UNAUTHORIZED" }); return; }
  res.json({ email: session.email, expiresAt: session.expiresAt.toISOString() });
});

// ─────────────────────────────────────────────────────────────────────────────
// SNIPPET MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/pending — pending snippets for review tab
router.get("/admin/pending", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (_req, res) => {
    try {
      const snippets = await db.select().from(snippetsTable).where(eq(snippetsTable.status, "pending")).orderBy(desc(snippetsTable.createdAt)).limit(100);
      res.json({ data: snippets.map(s => ({ ...s, tags: s.tags ?? [], createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString() })) });
    } catch {
      res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch pending snippets" });
    }
  });
});

// GET /api/admin/all-snippets — all snippets for snippets tab
router.get("/admin/all-snippets", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (req, res) => {
    const status = req.query.status as string | undefined;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;
    try {
      const where = status ? eq(snippetsTable.status, status as any) : undefined;
      const [snippets, [{ total }]] = await Promise.all([
        db.select().from(snippetsTable).where(where).orderBy(desc(snippetsTable.createdAt)).limit(limit).offset(offset),
        db.select({ total: sum(snippetsTable.id) }).from(snippetsTable).where(where),
      ]);
      res.json({
        data: snippets.map(s => ({ ...s, tags: s.tags ?? [], createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString() })),
        pagination: { page, limit, total: Number(total ?? 0), totalPages: Math.ceil(Number(total ?? 0) / limit) },
      });
    } catch {
      res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch snippets" });
    }
  });
});

// GET /api/admin/snippets — same as all-snippets (legacy alias)
router.get("/admin/snippets", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (req, res) => {
    const status = req.query.status as string | undefined;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;
    try {
      const where = status ? eq(snippetsTable.status, status as any) : undefined;
      const [snippets, [{ total }]] = await Promise.all([
        db.select().from(snippetsTable).where(where).orderBy(desc(snippetsTable.createdAt)).limit(limit).offset(offset),
        db.select({ total: sum(snippetsTable.id) }).from(snippetsTable).where(where),
      ]);
      res.json({
        data: snippets.map(s => ({ ...s, tags: s.tags ?? [], createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString() })),
        pagination: { page, limit, total: Number(total ?? 0), totalPages: Math.ceil(Number(total ?? 0) / limit) },
      });
    } catch {
      res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch snippets" });
    }
  });
});

// POST /api/admin/snippets/:id/approve
router.post("/admin/snippets/:id/approve", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (req, res) => {
    try {
      const [snippet] = await db.select().from(snippetsTable).where(eq(snippetsTable.id, req.params.id)).limit(1);
      if (!snippet) { res.status(404).json({ error: "NOT_FOUND" }); return; }
      const [updated] = await db.update(snippetsTable).set({ status: "approved", rejectReason: null, updatedAt: new Date() }).where(eq(snippetsTable.id, req.params.id)).returning();
      sendApprovalEmail(snippet.authorEmail, snippet.title, snippet.id).catch(() => {});
      res.json({ ...updated, tags: updated.tags ?? [], createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
    } catch {
      res.status(500).json({ error: "SERVER_ERROR", message: "Failed to approve snippet" });
    }
  });
});

// POST /api/admin/snippets/:id/reject
router.post("/admin/snippets/:id/reject", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (req, res) => {
    const { reason } = req.body;
    try {
      const [snippet] = await db.select().from(snippetsTable).where(eq(snippetsTable.id, req.params.id)).limit(1);
      if (!snippet) { res.status(404).json({ error: "NOT_FOUND" }); return; }
      const [updated] = await db.update(snippetsTable).set({ status: "rejected", rejectReason: reason ?? null, updatedAt: new Date() }).where(eq(snippetsTable.id, req.params.id)).returning();
      sendRejectionEmail(snippet.authorEmail, snippet.title, reason).catch(() => {});
      res.json({ ...updated, tags: updated.tags ?? [], createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
    } catch {
      res.status(500).json({ error: "SERVER_ERROR", message: "Failed to reject snippet" });
    }
  });
});

// PATCH /api/admin/snippets/:id — generic status update
router.patch("/admin/snippets/:id", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (req, res) => {
    const { status, rejectReason } = req.body;
    if (!["approved", "rejected", "pending"].includes(status)) {
      res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid status" });
      return;
    }
    try {
      const [snippet] = await db.select().from(snippetsTable).where(eq(snippetsTable.id, req.params.id)).limit(1);
      if (!snippet) { res.status(404).json({ error: "NOT_FOUND" }); return; }
      const [updated] = await db.update(snippetsTable).set({ status, rejectReason: status === "rejected" ? (rejectReason ?? null) : null, updatedAt: new Date() }).where(eq(snippetsTable.id, req.params.id)).returning();
      if (status === "approved") sendApprovalEmail(snippet.authorEmail, snippet.title, snippet.id).catch(() => {});
      else if (status === "rejected") sendRejectionEmail(snippet.authorEmail, snippet.title, rejectReason).catch(() => {});
      res.json({ ...updated, tags: updated.tags ?? [], createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
    } catch {
      res.status(500).json({ error: "SERVER_ERROR", message: "Failed to update snippet" });
    }
  });
});

// PUT /api/admin/snippets/:id — full metadata update
router.put("/admin/snippets/:id", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (req, res) => {
    const { title, description, language, tags } = req.body;
    if (!title || !language) {
      res.status(400).json({ error: "VALIDATION_ERROR", message: "title and language required" });
      return;
    }
    try {
      const [snippet] = await db.select().from(snippetsTable).where(eq(snippetsTable.id, req.params.id)).limit(1);
      if (!snippet) { res.status(404).json({ error: "NOT_FOUND" }); return; }
      const [updated] = await db
        .update(snippetsTable)
        .set({ title: String(title).trim(), description: description ? String(description).trim() : snippet.description, language: String(language).toLowerCase().trim(), tags: Array.isArray(tags) ? tags : snippet.tags, updatedAt: new Date() })
        .where(eq(snippetsTable.id, req.params.id))
        .returning();
      res.json({ ...updated, tags: updated.tags ?? [], createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
    } catch {
      res.status(500).json({ error: "SERVER_ERROR", message: "Failed to update snippet" });
    }
  });
});

// DELETE /api/admin/snippets/:id
router.delete("/admin/snippets/:id", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (req, res) => {
    try {
      await db.delete(snippetsTable).where(eq(snippetsTable.id, req.params.id));
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "SERVER_ERROR", message: "Failed to delete snippet" });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY / BAN MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/admin/ban-email — ban email permanently or with duration
router.post("/admin/ban-email", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (req, res) => {
    const { email, reason, durationMs } = req.body;
    if (!email) { res.status(400).json({ error: "VALIDATION_ERROR", message: "Email required" }); return; }
    const sanitized = sanitizeEmail(email);
    const bannedUntil = new Date(Date.now() + (durationMs ?? 365 * 24 * 60 * 60 * 1000)); // default 1 year
    try {
      await db.insert(emailBansTable).values({ id: crypto.randomUUID(), email: sanitized, bannedUntil, reason: reason ?? "Diblokir oleh admin", createdAt: new Date() })
        .onConflictDoUpdate({ target: emailBansTable.email, set: { bannedUntil, reason: reason ?? "Diblokir oleh admin" } });
      logger.info(`[admin] Email banned: ${sanitized}`);
      res.json({ success: true, message: `Email ${sanitized} telah diblokir.` });
    } catch {
      res.status(500).json({ error: "SERVER_ERROR", message: "Gagal memblokir email" });
    }
  });
});

router.get("/admin/security/bans", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (_req, res) => {
    try {
      const [ipBans, emailBans] = await Promise.all([
        db.select().from(ipBansTable).orderBy(desc(ipBansTable.createdAt)),
        db.select().from(emailBansTable).orderBy(desc(emailBansTable.createdAt)),
      ]);
      res.json({
        ipBans: ipBans.map(b => ({ ...b, bannedUntil: b.bannedUntil.toISOString(), createdAt: b.createdAt.toISOString() })),
        emailBans: emailBans.map(b => ({ ...b, bannedUntil: b.bannedUntil.toISOString(), createdAt: b.createdAt.toISOString() })),
      });
    } catch {
      res.status(500).json({ error: "SERVER_ERROR" });
    }
  });
});

router.delete("/admin/security/bans/ip/:id", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (req, res) => {
    await db.delete(ipBansTable).where(eq(ipBansTable.id, req.params.id)).catch(() => {});
    res.json({ success: true });
  });
});

router.delete("/admin/security/bans/email/:id", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (req, res) => {
    await db.delete(emailBansTable).where(eq(emailBansTable.id, req.params.id)).catch(() => {});
    res.json({ success: true });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────

router.get("/admin/analytics", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (_req, res) => {
    try {
      const [snippetCounts, recentSnippets] = await Promise.all([
        db.select({
          status: snippetsTable.status,
          total: count(),
        }).from(snippetsTable).groupBy(snippetsTable.status),
        db.select({ createdAt: snippetsTable.createdAt }).from(snippetsTable).orderBy(desc(snippetsTable.createdAt)).limit(200),
      ]);

      const totals: Record<string, number> = {};
      for (const row of snippetCounts) {
        totals[row.status] = Number(row.total);
      }

      // Submissions per day (last 14 days)
      const last14: Record<string, number> = {};
      const now = new Date();
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        last14[d.toISOString().slice(0, 10)] = 0;
      }
      for (const s of recentSnippets) {
        const day = s.createdAt.toISOString().slice(0, 10);
        if (day in last14) last14[day]++;
      }

      const submissionsPerDay = Object.entries(last14).map(([date, count]) => ({ date, count }));

      res.json({
        totals: {
          total: (totals.pending ?? 0) + (totals.approved ?? 0) + (totals.rejected ?? 0),
          pending: totals.pending ?? 0,
          approved: totals.approved ?? 0,
          rejected: totals.rejected ?? 0,
        },
        submissionsPerDay,
      });
    } catch {
      res.status(500).json({ error: "SERVER_ERROR" });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BROADCAST
// ─────────────────────────────────────────────────────────────────────────────

async function handleBroadcast(req: Request, res: Response, targetEmail?: string): Promise<void> {
  const { subject, message, adminInitial } = req.body;
  const adminEmail = (req as any).adminEmail as string;

  if (!subject || !message) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "subject and message required" });
    return;
  }

  let recipients: string[];
  if (targetEmail) {
    recipients = [targetEmail];
  } else {
    const authors = await db.selectDistinct({ email: snippetsTable.authorEmail }).from(snippetsTable);
    recipients = authors.map(a => a.authorEmail).filter(Boolean);
  }

  if (recipients.length === 0) {
    res.status(400).json({ error: "NO_RECIPIENTS", message: "Tidak ada penerima." });
    return;
  }

  let sent = 0; let failed = 0;
  await Promise.allSettled(
    recipients.map(r => sendBroadcastEmail(r, subject, message).then(() => { sent++; }).catch(() => { failed++; }))
  );

  await db.insert(broadcastLogsTable).values({
    id: crypto.randomUUID(),
    adminEmail,
    adminInitial: adminInitial ?? adminEmail[0]?.toUpperCase() ?? "A",
    targetEmail: targetEmail ?? null,
    subject,
    message,
    recipientCount: sent,
    createdAt: new Date(),
  }).catch(() => {});

  res.json({ success: true, sent, failed, recipientCount: sent });
}

// Broadcast to all
router.post("/admin/broadcast/all", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (req, res) => {
    try {
      await handleBroadcast(req, res);
    } catch (err) {
      logger.error(`[admin] Broadcast all failed: ${(err as Error).message}`);
      res.status(500).json({ error: "MAIL_ERROR", message: "Gagal mengirim broadcast." });
    }
  });
});

// Broadcast to one
router.post("/admin/broadcast/one", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (req, res) => {
    const { targetEmail } = req.body;
    if (!targetEmail) { res.status(400).json({ error: "VALIDATION_ERROR", message: "targetEmail required" }); return; }
    try {
      await handleBroadcast(req, res, targetEmail);
    } catch (err) {
      logger.error(`[admin] Broadcast one failed: ${(err as Error).message}`);
      res.status(500).json({ error: "MAIL_ERROR", message: "Gagal mengirim email." });
    }
  });
});

// Legacy broadcast
router.post("/admin/broadcast", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (req, res) => {
    const targetEmail = req.body?.targetEmail;
    try {
      await handleBroadcast(req, res, targetEmail);
    } catch (err) {
      logger.error(`[admin] Broadcast failed: ${(err as Error).message}`);
      res.status(500).json({ error: "MAIL_ERROR", message: "Gagal mengirim broadcast." });
    }
  });
});

router.get("/admin/broadcast-logs", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    try {
      const logs = await db.select().from(broadcastLogsTable).orderBy(desc(broadcastLogsTable.createdAt)).limit(limit);
      res.json({ data: logs.map(l => ({ ...l, createdAt: l.createdAt.toISOString() })) });
    } catch {
      res.status(500).json({ error: "SERVER_ERROR" });
    }
  });
});

// Test email
router.post("/admin/test-email", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (req, res) => {
    const adminEmail = (req as any).adminEmail as string;
    try {
      await sendTestEmail(adminEmail);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "MAIL_ERROR", message: (err as Error).message });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// API KEYS & IP WHITELIST & REQUEST LOGS
// ─────────────────────────────────────────────────────────────────────────────

router.get("/admin/api-keys",         async (req, res) => requireAdminSession(req, res, (req, res) => listApiKeys(req, res)));
router.post("/admin/api-keys",        async (req, res) => requireAdminSession(req, res, (req, res) => createApiKey(req, res)));
router.patch("/admin/api-keys/:id",   async (req, res) => requireAdminSession(req, res, (req, res) => updateApiKey(req, res)));
router.delete("/admin/api-keys/:id",  async (req, res) => requireAdminSession(req, res, (req, res) => deleteApiKey(req, res)));

router.get("/admin/ip-whitelist",         async (req, res) => requireAdminSession(req, res, (req, res) => listIpWhitelist(req, res)));
router.post("/admin/ip-whitelist",        async (req, res) => requireAdminSession(req, res, (req, res) => addIpWhitelist(req, res)));
router.patch("/admin/ip-whitelist/:id",   async (req, res) => requireAdminSession(req, res, (req, res) => updateIpWhitelist(req, res)));
router.delete("/admin/ip-whitelist/:id",  async (req, res) => requireAdminSession(req, res, (req, res) => deleteIpWhitelist(req, res)));

router.get("/admin/request-logs", async (req, res) => requireAdminSession(req, res, (req, res) => getRequestLogs(req, res)));

export default router;
