import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "../lib/db.js";
import {
  adminUsersTable, adminSessionsTable, adminOtpsTable,
  ipBansTable, emailBansTable, loginAttemptsTable,
  broadcastLogsTable, snippetsTable,
} from "../lib/schema.js";
import { eq, and, gt, desc, sum } from "drizzle-orm";
import crypto from "node:crypto";
import {
  sendOtpEmail, sendApprovalEmail, sendRejectionEmail,
  sendBroadcastEmail, sendTestEmail,
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

const EMAIL_BAN_DURATION_MS          = 5 * 60 * 1000;
const IP_BAN_DURATION_MS             = 24 * 60 * 60 * 1000;
const SESSION_DURATION_MS            = 24 * 60 * 60 * 1000;
const OTP_DURATION_MS                = 5 * 60 * 1000;
const MAX_FAILED_ATTEMPTS_BEFORE_BAN = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateOtp(): string {
  return String(100000 + crypto.randomInt(900000));
}

function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim().replace(/[^a-z0-9@._+-]/g, "");
}

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
      .where(and(eq(adminSessionsTable.id, token), gt(adminSessionsTable.expiresAt, new Date())))
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

async function checkIpBan(ip: string): Promise<string | null> {
  try {
    const [ipBan] = await db.select().from(ipBansTable).where(eq(ipBansTable.ipAddress, ip)).limit(1);
    if (ipBan && ipBan.bannedUntil > new Date()) {
      const min = Math.ceil((ipBan.bannedUntil.getTime() - Date.now()) / 60000);
      return `IP anda diblokir selama ${min} menit lagi karena terlalu banyak percobaan masuk.`;
    }
  } catch { /* ignore */ }
  return null;
}

async function checkEmailBan(email: string): Promise<string | null> {
  try {
    const [emailBan] = await db.select().from(emailBansTable).where(eq(emailBansTable.email, email)).limit(1);
    if (emailBan && emailBan.bannedUntil > new Date()) {
      const min = Math.ceil((emailBan.bannedUntil.getTime() - Date.now()) / 60000);
      return `Email anda diblokir selama ${min} menit lagi. Coba lagi nanti.`;
    }
  } catch { /* ignore */ }
  return null;
}

// ─── Auth routes ──────────────────────────────────────────────────────────────

router.post("/admin/auth/request-otp", adminLoginRateLimit, async (req: Request, res: Response) => {
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

  await db.delete(adminOtpsTable).where(eq(adminOtpsTable.email, email)).catch(() => {});

  await db.insert(adminOtpsTable).values({
    id: crypto.randomUUID(),
    email,
    otp,
    used: false,
    expiresAt,
    createdAt: new Date(),
  });

  try {
    await sendOtpEmail(email, otp);
    logger.info(`[admin] OTP sent to ${email}`);
  } catch (err) {
    logger.error(`[admin] Failed to send OTP to ${email}: ${(err as Error).message}`);
    res.status(500).json({ error: "MAIL_ERROR", message: "Gagal mengirim OTP. Coba lagi." });
    return;
  }

  res.json({ success: true, message: "OTP dikirim ke email kamu." });
});

router.post("/admin/auth/verify-otp", adminLoginRateLimit, async (req: Request, res: Response) => {
  const raw = req.body?.email;
  const otpInput = req.body?.otp;

  if (!raw || !otpInput) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Email dan OTP diperlukan" });
    return;
  }

  const email = sanitizeEmail(raw);
  const ip = getClientIp(req);

  const ipBanMsg = await checkIpBan(ip);
  if (ipBanMsg) { res.status(403).json({ error: "IP_BANNED", message: ipBanMsg }); return; }

  if (!ALLOWED_ADMIN_EMAILS.includes(email)) {
    res.status(403).json({ error: "FORBIDDEN", message: "Email tidak terdaftar" });
    return;
  }

  try {
    const [record] = await db
      .select()
      .from(adminOtpsTable)
      .where(
        and(
          eq(adminOtpsTable.email, email),
          eq(adminOtpsTable.otp, String(otpInput).trim()),
          eq(adminOtpsTable.used, false),
          gt(adminOtpsTable.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!record) {
      await recordFailedAttempt(ip, email);
      res.status(401).json({ error: "INVALID_OTP", message: "OTP salah atau sudah kadaluarsa." });
      return;
    }

    await db.update(adminOtpsTable).set({ used: true }).where(eq(adminOtpsTable.id, record.id));
    await resetFailedAttempts(ip, email);

    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    await db.insert(adminSessionsTable).values({
      id: sessionId,
      email,
      expiresAt,
      createdAt: new Date(),
    });

    res.cookie("admin_session", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      expires: expiresAt,
      path: "/",
    });

    res.json({ success: true, email });
  } catch (err) {
    logger.error(`[admin] OTP verify failed: ${(err as Error).message}`);
    res.status(500).json({ error: "SERVER_ERROR", message: "Gagal verifikasi OTP" });
  }
});

router.post("/admin/auth/logout", async (req: Request, res: Response) => {
  const token = req.cookies?.["admin_session"];
  if (token) {
    await db.delete(adminSessionsTable).where(eq(adminSessionsTable.id, token)).catch(() => {});
  }
  res.clearCookie("admin_session", { path: "/" });
  res.json({ success: true });
});

router.get("/admin/auth/me", async (req: Request, res: Response) => {
  const token = req.cookies?.["admin_session"];
  if (!token) { res.status(401).json({ error: "UNAUTHORIZED" }); return; }
  try {
    const [session] = await db
      .select()
      .from(adminSessionsTable)
      .where(and(eq(adminSessionsTable.id, token), gt(adminSessionsTable.expiresAt, new Date())))
      .limit(1);
    if (!session) { res.status(401).json({ error: "UNAUTHORIZED" }); return; }
    res.json({ email: session.email, expiresAt: session.expiresAt.toISOString() });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

// ─── Failed attempt tracking ──────────────────────────────────────────────────

async function recordFailedAttempt(ip: string, email: string): Promise<void> {
  try {
    const [existing] = await db
      .select()
      .from(loginAttemptsTable)
      .where(eq(loginAttemptsTable.ipAddress, ip))
      .limit(1);

    const count = (existing?.attemptCount ?? 0) + 1;

    if (existing) {
      await db.update(loginAttemptsTable).set({ attemptCount: count, lastAttemptAt: new Date() }).where(eq(loginAttemptsTable.id, existing.id));
    } else {
      await db.insert(loginAttemptsTable).values({ id: crypto.randomUUID(), ipAddress: ip, email, attemptCount: count, lastAttemptAt: new Date() });
    }

    if (count >= MAX_FAILED_ATTEMPTS_BEFORE_BAN) {
      const bannedUntil = new Date(Date.now() + IP_BAN_DURATION_MS);
      await db.insert(ipBansTable).values({ id: crypto.randomUUID(), ipAddress: ip, bannedUntil, reason: "Too many failed login attempts", createdAt: new Date() }).onConflictDoUpdate({ target: ipBansTable.ipAddress, set: { bannedUntil } });

      const emailBannedUntil = new Date(Date.now() + EMAIL_BAN_DURATION_MS);
      await db.insert(emailBansTable).values({ id: crypto.randomUUID(), email, bannedUntil: emailBannedUntil, reason: "Too many failed login attempts", createdAt: new Date() }).onConflictDoUpdate({ target: emailBansTable.email, set: { bannedUntil: emailBannedUntil } });
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

// ─── Protected routes ─────────────────────────────────────────────────────────

router.get("/admin/snippets", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (req, res) => {
    const status = req.query.status as string | undefined;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    try {
      const where = status ? eq(snippetsTable.status, status as any) : undefined;
      const [snippets, [{ total }]] = await Promise.all([
        db.select().from(snippetsTable).where(where).orderBy(desc(snippetsTable.createdAt)).limit(limit).offset(offset),
        db.select({ total: sum(snippetsTable.id) }).from(snippetsTable).where(where),
      ]);

      res.json({
        data: snippets.map((s) => ({
          ...s,
          tags: s.tags ?? [],
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
        })),
        pagination: { page, limit, total: Number(total ?? 0), totalPages: Math.ceil(Number(total ?? 0) / limit) },
      });
    } catch (err) {
      res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch snippets" });
    }
  });
});

router.patch("/admin/snippets/:id", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (req, res) => {
    const { id } = req.params;
    const { status, rejectReason } = req.body;
    const adminEmail = (req as any).adminEmail as string;

    if (!["approved", "rejected", "pending"].includes(status)) {
      res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid status" });
      return;
    }

    try {
      const [snippet] = await db.select().from(snippetsTable).where(eq(snippetsTable.id, id)).limit(1);
      if (!snippet) { res.status(404).json({ error: "NOT_FOUND" }); return; }

      const [updated] = await db
        .update(snippetsTable)
        .set({ status, rejectReason: status === "rejected" ? (rejectReason ?? null) : null, updatedAt: new Date() })
        .where(eq(snippetsTable.id, id))
        .returning();

      // Send email notification
      if (status === "approved") {
        sendApprovalEmail(snippet.authorEmail, snippet.title, snippet.id).catch(() => {});
      } else if (status === "rejected") {
        sendRejectionEmail(snippet.authorEmail, snippet.title, rejectReason).catch(() => {});
      }

      res.json({ ...updated, tags: updated.tags ?? [], createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
    } catch {
      res.status(500).json({ error: "SERVER_ERROR", message: "Failed to update snippet" });
    }
  });
});

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

router.post("/admin/broadcast", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (req, res) => {
    const { subject, message, targetEmail } = req.body;
    const adminEmail = (req as any).adminEmail as string;

    if (!subject || !message) {
      res.status(400).json({ error: "VALIDATION_ERROR", message: "subject and message required" });
      return;
    }

    try {
      let recipients: string[];
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

      await sendBroadcastEmail(recipients, subject, message);

      await db.insert(broadcastLogsTable).values({
        id: crypto.randomUUID(),
        adminEmail,
        adminInitial: adminEmail[0]?.toUpperCase() ?? "A",
        targetEmail: targetEmail ?? null,
        subject,
        message,
        recipientCount: recipients.length,
        createdAt: new Date(),
      }).catch(() => {});

      res.json({ success: true, recipientCount: recipients.length });
    } catch (err) {
      const msg = (err as Error).message;
      logger.error(`[admin] Broadcast failed: ${msg}`);
      if (msg.includes("GMAIL_USER") || msg.includes("GMAIL_PASS")) {
        res.status(500).json({ error: "MAIL_CONFIG_ERROR", message: "SMTP credentials not configured." });
      } else {
        res.status(500).json({ error: "MAIL_ERROR", message: "Failed to send broadcast." });
      }
    }
  });
});

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

router.get("/admin/broadcast-logs", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    try {
      const logs = await db.select().from(broadcastLogsTable).orderBy(desc(broadcastLogsTable.createdAt)).limit(limit);
      res.json({ data: logs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })) });
    } catch {
      res.status(500).json({ error: "SERVER_ERROR" });
    }
  });
});

// ─── Security management ──────────────────────────────────────────────────────

router.get("/admin/security/bans", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async (req, res) => {
    try {
      const [ipBans, emailBans] = await Promise.all([
        db.select().from(ipBansTable).orderBy(desc(ipBansTable.createdAt)),
        db.select().from(emailBansTable).orderBy(desc(emailBansTable.createdAt)),
      ]);
      res.json({
        ipBans: ipBans.map((b) => ({ ...b, bannedUntil: b.bannedUntil.toISOString(), createdAt: b.createdAt.toISOString() })),
        emailBans: emailBans.map((b) => ({ ...b, bannedUntil: b.bannedUntil.toISOString(), createdAt: b.createdAt.toISOString() })),
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

// ─── API Key & IP Whitelist & Request Logs ────────────────────────────────────

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

router.get("/admin/request-logs", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, (req, res) => getRequestLogs(req, res));
});

export default router;
