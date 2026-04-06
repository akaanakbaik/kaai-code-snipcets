import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import {
  adminUsersTable,
  adminSessionsTable,
  adminOtpsTable,
  ipBansTable,
  emailBansTable,
  loginAttemptsTable,
  broadcastLogsTable,
  snippetsTable,
} from "@workspace/db/schema";
import { eq, and, gt, desc, sum } from "drizzle-orm";
import crypto from "node:crypto";
import {
  sendOtpEmail,
  sendApprovalEmail,
  sendRejectionEmail,
  sendBroadcastEmail,
  sendTestEmail,
} from "../lib/mailer";
import { logger } from "../lib/logger";
import { adminLoginRateLimit, getClientIp } from "../middlewares/security";
import {
  listApiKeys,
  createApiKey,
  updateApiKey,
  deleteApiKey,
  listIpWhitelist,
  addIpWhitelist,
  updateIpWhitelist,
  deleteIpWhitelist,
  getRequestLogs,
} from "./api-keys";

const router = Router();

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_ADMIN_EMAILS = [
  "akaanakbaik17@proton.me",
  "yaudahpakeaja6@gmail.com",
  "kelvdra46@gmail.com",
  "clpmadang@gmail.com",
];

const EMAIL_BAN_DURATION_MS          = 5 * 60 * 1000;        // 5 minutes
const IP_BAN_DURATION_MS             = 24 * 60 * 60 * 1000;  // 24 hours
const SESSION_DURATION_MS            = 24 * 60 * 60 * 1000;  // 24 hours
const OTP_DURATION_MS                = 5 * 60 * 1000;        // 5 minutes
const MAX_FAILED_ATTEMPTS_BEFORE_BAN = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateOtp(): string {
  // 6-digit OTP (100000–999999) using crypto for security
  return String(100000 + (crypto.randomInt(900000)));
}

function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim().replace(/[^a-z0-9@._+-]/g, "");
}

// ─── Session middleware ───────────────────────────────────────────────────────

async function requireAdminSession(
  req: Request,
  res: Response,
  next: (req: Request, res: Response) => Promise<void> | void,
): Promise<void> {
  const token = req.cookies?.["admin_session"];
  if (!token) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Not authenticated" });
    return;
  }

  try {
    const [session] = await db
      .select()
      .from(adminSessionsTable)
      .where(
        and(
          eq(adminSessionsTable.id, token),
          gt(adminSessionsTable.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!session) {
      res.clearCookie("admin_session", { path: "/" });
      res.status(401).json({ error: "UNAUTHORIZED", message: "Session expired or invalid" });
      return;
    }

    (req as any).adminEmail = session.email;

    try {
      await next(req, res);
    } catch (err) {
      logger.error(`[admin] Route handler error: ${(err as Error).message}`);
      if (!res.headersSent) {
        res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
      }
    }
  } catch (err) {
    logger.error(`[admin] Session check failed: ${(err as Error).message}`);
    res.status(500).json({ error: "SERVER_ERROR", message: "Session check failed" });
  }
}

// ─── IP/Email ban helpers ─────────────────────────────────────────────────────

async function checkIpBan(ip: string): Promise<string | null> {
  try {
    const [ipBan] = await db
      .select()
      .from(ipBansTable)
      .where(eq(ipBansTable.ipAddress, ip))
      .limit(1);
    if (ipBan && ipBan.bannedUntil > new Date()) {
      const min = Math.ceil((ipBan.bannedUntil.getTime() - Date.now()) / 60000);
      return `IP anda diblokir selama ${min} menit lagi karena terlalu banyak percobaan masuk.`;
    }
  } catch {/* ignore */}
  return null;
}

async function checkEmailBan(email: string): Promise<string | null> {
  try {
    const [emailBan] = await db
      .select()
      .from(emailBansTable)
      .where(eq(emailBansTable.email, email))
      .limit(1);
    if (emailBan && emailBan.bannedUntil > new Date()) {
      const min = Math.ceil((emailBan.bannedUntil.getTime() - Date.now()) / 60000);
      return `Email ini diblokir selama ${min} menit. Silahkan coba lagi nanti.`;
    }
  } catch {/* ignore */}
  return null;
}

async function recordFailedAttempt(ip: string, email: string): Promise<boolean> {
  try {
    const [existing] = await db
      .select()
      .from(loginAttemptsTable)
      .where(eq(loginAttemptsTable.ipAddress, ip))
      .limit(1);

    let newCount = 1;
    if (existing) {
      newCount = existing.attemptCount + 1;
      await db
        .update(loginAttemptsTable)
        .set({ attemptCount: newCount, lastAttemptAt: new Date() })
        .where(eq(loginAttemptsTable.id, existing.id));
    } else {
      await db.insert(loginAttemptsTable).values({
        id: crypto.randomUUID(),
        ipAddress: ip,
        email,
        attemptCount: 1,
        lastAttemptAt: new Date(),
      });
    }

    if (newCount >= MAX_FAILED_ATTEMPTS_BEFORE_BAN) {
      await db
        .insert(ipBansTable)
        .values({
          id: crypto.randomUUID(),
          ipAddress: ip,
          bannedUntil: new Date(Date.now() + IP_BAN_DURATION_MS),
          reason: "Terlalu banyak percobaan login gagal",
        })
        .onConflictDoUpdate({
          target: ipBansTable.ipAddress,
          set: { bannedUntil: new Date(Date.now() + IP_BAN_DURATION_MS) },
        });
      return true; // banned
    }
  } catch {/* ignore */}
  return false;
}

// ─── Auth Routes ──────────────────────────────────────────────────────────────

// POST /api/admin/login — Step 1: request OTP
router.post("/admin/login", adminLoginRateLimit, async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const rawEmail = req.body?.email;

  if (!rawEmail || typeof rawEmail !== "string") {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Email wajib diisi" });
    return;
  }

  const email = sanitizeEmail(rawEmail);

  // Check bans
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

  // Check admin whitelist
  if (!ALLOWED_ADMIN_EMAILS.includes(email)) {
    const banned = await recordFailedAttempt(ip, email);
    if (banned) {
      res.status(403).json({
        error: "IP_BANNED",
        message: "IP anda diblokir selama 24 jam karena terlalu banyak percobaan login.",
      });
      return;
    }
    res.status(403).json({
      error: "EMAIL_NOT_ALLOWED",
      message: "Email ini tidak terdaftar sebagai admin. Akses ditolak.",
    });
    return;
  }

  // Generate OTP
  const otp = generateOtp();
  const otpId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + OTP_DURATION_MS);

  try {
    // Invalidate previous OTPs
    await db
      .update(adminOtpsTable)
      .set({ used: true })
      .where(and(eq(adminOtpsTable.email, email), eq(adminOtpsTable.used, false)));

    // Save new OTP
    await db.insert(adminOtpsTable).values({
      id: otpId,
      email,
      otp,
      used: false,
      expiresAt,
      createdAt: new Date(),
    });

    // Send OTP email — if it fails, tell the user
    try {
      await sendOtpEmail(email, otp);
    } catch (mailErr) {
      logger.error(`[admin] OTP email failed for ${email}: ${(mailErr as Error).message}`);
      // OTP is saved in DB, but email failed — mark it used so it can't be exploited
      await db
        .update(adminOtpsTable)
        .set({ used: true })
        .where(eq(adminOtpsTable.id, otpId));

      res.status(503).json({
        error: "EMAIL_SEND_FAILED",
        message: "Gagal mengirim email OTP. Silahkan coba beberapa saat lagi.",
      });
      return;
    }

    // Clear failed attempts on successful OTP send
    await db.delete(loginAttemptsTable).where(eq(loginAttemptsTable.ipAddress, ip)).catch(() => {});

    logger.info(`[admin] OTP sent to ${email} from IP ${ip}`);
    res.json({ success: true, message: "OTP telah dikirim ke email anda. Berlaku 5 menit." });
  } catch (err) {
    logger.error(`[admin] Login error: ${(err as Error).message}`);
    res.status(500).json({ error: "SERVER_ERROR", message: "Gagal memproses login" });
  }
});

// POST /api/admin/verify — Step 2: verify OTP
router.post("/admin/verify", adminLoginRateLimit, async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const rawEmail = req.body?.email;
  const rawOtp = req.body?.otp;

  if (!rawEmail || !rawOtp) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Email dan OTP diperlukan" });
    return;
  }

  const email = sanitizeEmail(rawEmail);
  const otpInput = String(rawOtp).trim().replace(/\D/g, "");

  // Check IP ban
  const ipBanMsg = await checkIpBan(ip);
  if (ipBanMsg) {
    res.status(403).json({ error: "IP_BANNED", message: ipBanMsg });
    return;
  }

  try {
    const [otpRecord] = await db
      .select()
      .from(adminOtpsTable)
      .where(
        and(
          eq(adminOtpsTable.email, email),
          eq(adminOtpsTable.used, false),
          gt(adminOtpsTable.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(adminOtpsTable.createdAt))
      .limit(1);

    if (!otpRecord || otpRecord.otp !== otpInput) {
      const banned = await recordFailedAttempt(ip, email);
      if (banned) {
        res.status(403).json({
          error: "IP_BANNED",
          message: "IP anda diblokir 24 jam karena terlalu banyak percobaan OTP gagal.",
        });
        return;
      }
      res.status(401).json({ error: "INVALID_OTP", message: "OTP tidak valid atau sudah expired." });
      return;
    }

    // Mark OTP as used
    await db.update(adminOtpsTable).set({ used: true }).where(eq(adminOtpsTable.id, otpRecord.id));

    // Create session
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    await db.insert(adminSessionsTable).values({
      id: sessionToken,
      email,
      expiresAt,
      createdAt: new Date(),
    });

    // Clear failed attempts
    await db.delete(loginAttemptsTable).where(eq(loginAttemptsTable.ipAddress, ip)).catch(() => {});

    res.cookie("admin_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_DURATION_MS,
      path: "/",
    });

    logger.info(`[admin] Login success: ${email} from IP ${ip}`);
    res.json({ success: true, email, message: "Login berhasil." });
  } catch (err) {
    logger.error(`[admin] Verify error: ${(err as Error).message}`);
    res.status(500).json({ error: "SERVER_ERROR", message: "Gagal verifikasi OTP" });
  }
});

// GET /api/admin/session — Check session
router.get("/admin/session", async (req: Request, res: Response) => {
  const token = req.cookies?.["admin_session"];
  if (!token) { res.json({ authenticated: false }); return; }

  try {
    const [session] = await db
      .select()
      .from(adminSessionsTable)
      .where(and(eq(adminSessionsTable.id, token), gt(adminSessionsTable.expiresAt, new Date())))
      .limit(1);

    if (!session) {
      res.clearCookie("admin_session", { path: "/" });
      res.json({ authenticated: false });
      return;
    }

    res.json({ authenticated: true, email: session.email });
  } catch {
    res.json({ authenticated: false });
  }
});

// POST /api/admin/logout
router.post("/admin/logout", async (req: Request, res: Response) => {
  const token = req.cookies?.["admin_session"];
  if (token) {
    await db.delete(adminSessionsTable).where(eq(adminSessionsTable.id, token)).catch(() => {});
  }
  res.clearCookie("admin_session", { path: "/" });
  res.json({ success: true });
});

// ─── Protected Routes ─────────────────────────────────────────────────────────

// POST /api/admin/test-email — send test email to current admin
router.post("/admin/test-email", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (req, res) => {
    const adminEmail = (req as any).adminEmail as string;
    const targetEmail = req.body?.email || adminEmail;

    try {
      await sendTestEmail(targetEmail);
      res.json({ success: true, message: `Test email berhasil dikirim ke ${targetEmail}` });
    } catch (err) {
      logger.error(`[admin] Test email failed: ${(err as Error).message}`);
      res.status(503).json({
        error: "EMAIL_SEND_FAILED",
        message: `Gagal mengirim test email: ${(err as Error).message}`,
      });
    }
  });
});

// GET /api/admin/pending — pending snippets
router.get("/admin/pending", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (_req, res) => {
    const rows = await db
      .select()
      .from(snippetsTable)
      .where(eq(snippetsTable.status, "pending"))
      .orderBy(desc(snippetsTable.createdAt));

    res.json({
      data: rows.map((s) => ({ ...s, tags: s.tags ?? [], createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString() })),
      total: rows.length,
    });
  });
});

// GET /api/admin/all-snippets — all snippets
router.get("/admin/all-snippets", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (_req, res) => {
    const rows = await db.select().from(snippetsTable).orderBy(desc(snippetsTable.createdAt));
    res.json({
      data: rows.map((s) => ({ ...s, tags: s.tags ?? [], createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString() })),
      total: rows.length,
    });
  });
});

// POST /api/admin/snippets/:id/approve
router.post("/admin/snippets/:id/approve", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (req, res) => {
    const { id } = req.params;
    const [existing] = await db.select().from(snippetsTable).where(eq(snippetsTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "NOT_FOUND", message: "Snippet not found" }); return; }

    const [updated] = await db
      .update(snippetsTable)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(snippetsTable.id, id))
      .returning();

    // Stats for notification email
    const authorSnippets = await db
      .select({ viewCount: snippetsTable.viewCount })
      .from(snippetsTable)
      .where(and(eq(snippetsTable.authorEmail, existing.authorEmail), eq(snippetsTable.status, "approved")));

    const totalViews = authorSnippets.reduce((acc, s) => acc + (s.viewCount || 0), 0);
    const allAuthors = await db
      .select({ email: snippetsTable.authorEmail, views: sum(snippetsTable.viewCount) })
      .from(snippetsTable)
      .where(eq(snippetsTable.status, "approved"))
      .groupBy(snippetsTable.authorEmail)
      .orderBy(desc(sum(snippetsTable.viewCount)));
    const rank = allAuthors.findIndex((a) => a.email === existing.authorEmail) + 1;

    sendApprovalEmail({
      to: existing.authorEmail,
      authorName: existing.authorName,
      snippetTitle: existing.title,
      totalUploaded: authorSnippets.length,
      totalViews,
      rank: rank || 1,
    }).catch((e) => logger.warn(`[admin] Approval email failed: ${e.message}`));

    res.json({ ...updated, tags: updated?.tags ?? [], createdAt: updated?.createdAt.toISOString(), updatedAt: updated?.updatedAt.toISOString() });
  });
});

// POST /api/admin/snippets/:id/reject
router.post("/admin/snippets/:id/reject", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (req, res) => {
    const { id } = req.params;
    const reason = req.body?.reason || undefined;

    const [existing] = await db.select().from(snippetsTable).where(eq(snippetsTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "NOT_FOUND", message: "Snippet not found" }); return; }

    const [updated] = await db
      .update(snippetsTable)
      .set({ status: "rejected", rejectReason: reason ?? null, updatedAt: new Date() })
      .where(eq(snippetsTable.id, id))
      .returning();

    sendRejectionEmail({
      to: existing.authorEmail,
      authorName: existing.authorName,
      snippetTitle: existing.title,
      reason,
    }).catch((e) => logger.warn(`[admin] Rejection email failed: ${e.message}`));

    res.json({ ...updated, tags: updated?.tags ?? [], createdAt: updated?.createdAt.toISOString(), updatedAt: updated?.updatedAt.toISOString() });
  });
});

// DELETE /api/admin/snippets/:id
router.delete("/admin/snippets/:id", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (req, res) => {
    await db.delete(snippetsTable).where(eq(snippetsTable.id, req.params.id));
    res.json({ success: true });
  });
});

// POST /api/admin/ban-email
router.post("/admin/ban-email", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (req, res) => {
    const rawEmail = req.body?.email;
    const reason = req.body?.reason || "Diblokir oleh admin";
    if (!rawEmail) { res.status(400).json({ error: "VALIDATION_ERROR", message: "Email diperlukan" }); return; }

    const email = rawEmail.toLowerCase().trim();
    const bannedUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    await db
      .insert(emailBansTable)
      .values({ id: crypto.randomUUID(), email, bannedUntil, reason, createdAt: new Date() })
      .onConflictDoUpdate({ target: emailBansTable.email, set: { bannedUntil, reason } });

    res.json({ success: true, message: `Email ${email} telah diblokir.` });
  });
});

// GET /api/admin/banned-emails
router.get("/admin/banned-emails", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (_req, res) => {
    const rows = await db
      .select()
      .from(emailBansTable)
      .where(gt(emailBansTable.bannedUntil, new Date()))
      .orderBy(desc(emailBansTable.createdAt));
    res.json({ data: rows.map((r) => ({ ...r, bannedUntil: r.bannedUntil.toISOString(), createdAt: r.createdAt.toISOString() })) });
  });
});

// DELETE /api/admin/ban-email/:email
router.delete("/admin/ban-email/:email", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (req, res) => {
    await db.delete(emailBansTable).where(eq(emailBansTable.email, req.params.email));
    res.json({ success: true });
  });
});

// GET /api/admin/all-emails
router.get("/admin/all-emails", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (_req, res) => {
    const rows = await db
      .selectDistinct({ email: snippetsTable.authorEmail, name: snippetsTable.authorName })
      .from(snippetsTable);
    res.json({ data: rows });
  });
});

// POST /api/admin/broadcast/all
router.post("/admin/broadcast/all", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (req, res) => {
    const { subject, message, adminInitial } = req.body;
    if (!subject || !message) {
      res.status(400).json({ error: "VALIDATION_ERROR", message: "Subject dan message diperlukan" });
      return;
    }

    const rows = await db.selectDistinct({ email: snippetsTable.authorEmail }).from(snippetsTable);
    const emails = rows.map((r) => r.email).filter(Boolean);

    let sent = 0;
    let failed = 0;
    for (let i = 0; i < emails.length; i += 10) {
      const batch = emails.slice(i, i + 10);
      const results = await Promise.allSettled(
        batch.map((email) => sendBroadcastEmail({ to: email, subject, message, adminInitial })),
      );
      results.forEach((r) => (r.status === "fulfilled" ? sent++ : failed++));
    }

    const adminEmail = (req as any).adminEmail;
    await db.insert(broadcastLogsTable).values({
      id: crypto.randomUUID(),
      adminEmail,
      adminInitial: adminInitial || "Admin",
      targetEmail: null,
      subject,
      message,
      recipientCount: emails.length,
      createdAt: new Date(),
    }).catch(() => {});

    res.json({ success: true, recipientCount: emails.length, sent, failed });
  });
});

// POST /api/admin/broadcast/one
router.post("/admin/broadcast/one", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (req, res) => {
    const { targetEmail, message, adminInitial, subject } = req.body;
    if (!targetEmail || !message || !subject) {
      res.status(400).json({ error: "VALIDATION_ERROR", message: "Email, subject, dan message diperlukan" });
      return;
    }

    try {
      await sendBroadcastEmail({ to: targetEmail, subject, message, adminInitial });
    } catch (err) {
      res.status(503).json({ error: "EMAIL_SEND_FAILED", message: `Gagal mengirim email: ${(err as Error).message}` });
      return;
    }

    const adminEmail = (req as any).adminEmail;
    await db.insert(broadcastLogsTable).values({
      id: crypto.randomUUID(),
      adminEmail,
      adminInitial: adminInitial || "Admin",
      targetEmail,
      subject,
      message,
      recipientCount: 1,
      createdAt: new Date(),
    }).catch(() => {});

    res.json({ success: true });
  });
});

// ─── API Key Management (protected) ──────────────────────────────────────────

router.get("/admin/api-keys", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, (req, res) => listApiKeys(req, res));
});

router.post("/admin/api-keys", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, (req, res) => createApiKey(req, res));
});

router.patch("/admin/api-keys/:id", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, (req, res) => updateApiKey(req, res));
});

router.delete("/admin/api-keys/:id", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, (req, res) => deleteApiKey(req, res));
});

// ─── IP Whitelist (protected) ────────────────────────────────────────────────

router.get("/admin/ip-whitelist", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, (req, res) => listIpWhitelist(req, res));
});

router.post("/admin/ip-whitelist", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, (req, res) => addIpWhitelist(req, res));
});

router.patch("/admin/ip-whitelist/:id", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, (req, res) => updateIpWhitelist(req, res));
});

router.delete("/admin/ip-whitelist/:id", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, (req, res) => deleteIpWhitelist(req, res));
});

// ─── Request Logs (protected) ────────────────────────────────────────────────

router.get("/admin/request-logs", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, (req, res) => getRequestLogs(req, res));
});

export default router;
