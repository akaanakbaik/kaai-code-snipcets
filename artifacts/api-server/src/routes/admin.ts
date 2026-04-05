import { Router, Request, Response } from "express";
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
import { eq, and, gt, desc, ilike, or, count, sum, asc } from "drizzle-orm";
import crypto from "node:crypto";
import { sendOtpEmail, sendApprovalEmail, sendRejectionEmail, sendBroadcastEmail } from "../lib/mailer";
import { adminLoginRateLimit, getClientIp } from "../middlewares/security";

const router = Router();

const ALLOWED_ADMIN_EMAILS = [
  "akaanakbaik17@proton.me",
  "yaudahpakeaja6@gmail.com",
  "kelvdra46@gmail.com",
  "clpmadang@gmail.com",
];

const EMAIL_BAN_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const IP_BAN_DURATION_MS = 24 * 60 * 60 * 1000; // 1 day
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 1 day
const OTP_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const MAX_FAILED_ATTEMPTS_BEFORE_IP_BAN = 5;

function generateOtp(): string {
  return String(Math.floor(10000 + Math.random() * 90000));
}

function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim().replace(/[^a-z0-9@._+-]/g, "");
}

// Check admin session middleware
async function requireAdminSession(req: Request, res: Response, next: () => void): Promise<void> {
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
      res.clearCookie("admin_session");
      res.status(401).json({ error: "UNAUTHORIZED", message: "Session expired or invalid" });
      return;
    }

    (req as any).adminEmail = session.email;
    next();
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Session check failed" });
  }
}

// POST /api/admin/login - Step 1: Send OTP
router.post("/admin/login", adminLoginRateLimit, async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const rawEmail = req.body?.email;

  if (!rawEmail || typeof rawEmail !== "string") {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Email is required" });
    return;
  }

  const email = sanitizeEmail(rawEmail);

  // Check IP ban
  try {
    const [ipBan] = await db
      .select()
      .from(ipBansTable)
      .where(eq(ipBansTable.ipAddress, ip))
      .limit(1);

    if (ipBan && ipBan.bannedUntil > new Date()) {
      const minutesLeft = Math.ceil((ipBan.bannedUntil.getTime() - Date.now()) / 60000);
      res.status(403).json({
        error: "IP_BANNED",
        message: `IP anda diblokir selama ${minutesLeft} menit lagi karena terlalu banyak percobaan masuk.`,
      });
      return;
    }
  } catch {/* ignore */}

  // Check email ban
  try {
    const [emailBan] = await db
      .select()
      .from(emailBansTable)
      .where(eq(emailBansTable.email, email))
      .limit(1);

    if (emailBan && emailBan.bannedUntil > new Date()) {
      const minutesLeft = Math.ceil((emailBan.bannedUntil.getTime() - Date.now()) / 60000);
      res.status(403).json({
        error: "EMAIL_BANNED",
        message: `Email ini diblokir selama ${minutesLeft} menit. Silahkan coba lagi nanti.`,
      });
      return;
    }
  } catch {/* ignore */}

  // Check if email is in whitelist
  if (!ALLOWED_ADMIN_EMAILS.includes(email)) {
    // Track failed attempt for IP
    try {
      const [existing] = await db
        .select()
        .from(loginAttemptsTable)
        .where(eq(loginAttemptsTable.ipAddress, ip))
        .limit(1);

      if (existing) {
        const newCount = existing.attemptCount + 1;
        await db
          .update(loginAttemptsTable)
          .set({ attemptCount: newCount, lastAttemptAt: new Date() })
          .where(eq(loginAttemptsTable.id, existing.id));

        if (newCount >= MAX_FAILED_ATTEMPTS_BEFORE_IP_BAN) {
          // Ban IP for 1 day
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

          res.status(403).json({
            error: "IP_BANNED",
            message: "IP anda diblokir selama 24 jam karena terlalu banyak percobaan login.",
          });
          return;
        }
      } else {
        await db.insert(loginAttemptsTable).values({
          id: crypto.randomUUID(),
          ipAddress: ip,
          email,
          attemptCount: 1,
          lastAttemptAt: new Date(),
        });
      }
    } catch {/* ignore */}

    res.status(403).json({
      error: "EMAIL_NOT_ALLOWED",
      message: "Email ini tidak terdaftar sebagai admin. Akses ditolak.",
    });
    return;
  }

  // Email is valid admin — generate OTP
  const otp = generateOtp();
  const otpId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + OTP_DURATION_MS);

  try {
    // Invalidate old OTPs for this email
    await db
      .update(adminOtpsTable)
      .set({ used: true })
      .where(and(eq(adminOtpsTable.email, email), eq(adminOtpsTable.used, false)));

    await db.insert(adminOtpsTable).values({
      id: otpId,
      email,
      otp,
      used: false,
      expiresAt,
      createdAt: new Date(),
    });

    // Send OTP email (best-effort)
    sendOtpEmail(email, otp).catch(() => {});

    // Reset failed attempts on success
    await db.delete(loginAttemptsTable).where(eq(loginAttemptsTable.ipAddress, ip));

    res.json({ success: true, message: "OTP telah dikirim ke email anda. Berlaku 5 menit." });
  } catch (err) {
    res.status(500).json({ error: "SERVER_ERROR", message: "Gagal mengirim OTP" });
  }
});

// POST /api/admin/verify - Step 2: Verify OTP
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
  try {
    const [ipBan] = await db
      .select()
      .from(ipBansTable)
      .where(eq(ipBansTable.ipAddress, ip))
      .limit(1);

    if (ipBan && ipBan.bannedUntil > new Date()) {
      res.status(403).json({ error: "IP_BANNED", message: "IP anda diblokir sementara." });
      return;
    }
  } catch {/* ignore */}

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
      // Track failed OTP attempt
      const [existing] = await db
        .select()
        .from(loginAttemptsTable)
        .where(eq(loginAttemptsTable.ipAddress, ip))
        .limit(1);

      if (existing) {
        const newCount = existing.attemptCount + 1;
        await db
          .update(loginAttemptsTable)
          .set({ attemptCount: newCount, lastAttemptAt: new Date() })
          .where(eq(loginAttemptsTable.id, existing.id));

        if (newCount >= MAX_FAILED_ATTEMPTS_BEFORE_IP_BAN) {
          await db
            .insert(ipBansTable)
            .values({
              id: crypto.randomUUID(),
              ipAddress: ip,
              bannedUntil: new Date(Date.now() + IP_BAN_DURATION_MS),
              reason: "Brute force OTP",
            })
            .onConflictDoUpdate({
              target: ipBansTable.ipAddress,
              set: { bannedUntil: new Date(Date.now() + IP_BAN_DURATION_MS) },
            });

          res.status(403).json({
            error: "IP_BANNED",
            message: "IP anda diblokir 24 jam karena terlalu banyak percobaan OTP gagal.",
          });
          return;
        }
      } else {
        await db.insert(loginAttemptsTable).values({
          id: crypto.randomUUID(),
          ipAddress: ip,
          email,
          attemptCount: 1,
          lastAttemptAt: new Date(),
        });
      }

      res.status(401).json({ error: "INVALID_OTP", message: "OTP tidak valid atau sudah expired." });
      return;
    }

    // Mark OTP as used
    await db
      .update(adminOtpsTable)
      .set({ used: true })
      .where(eq(adminOtpsTable.id, otpRecord.id));

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
    await db.delete(loginAttemptsTable).where(eq(loginAttemptsTable.ipAddress, ip));

    res.cookie("admin_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_DURATION_MS,
      path: "/",
    });

    res.json({ success: true, email, message: "Login berhasil." });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Gagal verifikasi OTP" });
  }
});

// GET /api/admin/session - Check session
router.get("/admin/session", async (req: Request, res: Response) => {
  const token = req.cookies?.["admin_session"];
  if (!token) {
    res.json({ authenticated: false });
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
      res.clearCookie("admin_session");
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
    try {
      await db.delete(adminSessionsTable).where(eq(adminSessionsTable.id, token));
    } catch {/* ignore */}
  }
  res.clearCookie("admin_session", { path: "/" });
  res.json({ success: true });
});

// GET /api/admin/pending - List pending snippets (protected)
router.get("/admin/pending", async (req: Request, res: Response, next) => {
  await requireAdminSession(req, res, async () => {
    try {
      const rows = await db
        .select()
        .from(snippetsTable)
        .where(eq(snippetsTable.status, "pending"))
        .orderBy(desc(snippetsTable.createdAt));

      res.json({
        data: rows.map((s) => ({
          ...s,
          tags: s.tags ?? [],
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
        })),
        total: rows.length,
      });
    } catch {
      res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch pending snippets" });
    }
  });
});

// GET /api/admin/all-snippets - List all snippets (protected)
router.get("/admin/all-snippets", async (req: Request, res: Response, next) => {
  await requireAdminSession(req, res, async () => {
    try {
      const rows = await db
        .select()
        .from(snippetsTable)
        .orderBy(desc(snippetsTable.createdAt));

      res.json({
        data: rows.map((s) => ({
          ...s,
          tags: s.tags ?? [],
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
        })),
        total: rows.length,
      });
    } catch {
      res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch snippets" });
    }
  });
});

// POST /api/admin/snippets/:id/approve
router.post("/admin/snippets/:id/approve", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async () => {
    const { id } = req.params;
    try {
      const [existing] = await db
        .select()
        .from(snippetsTable)
        .where(eq(snippetsTable.id, id))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: "NOT_FOUND", message: "Snippet not found" });
        return;
      }

      const [updated] = await db
        .update(snippetsTable)
        .set({ status: "approved", updatedAt: new Date() })
        .where(eq(snippetsTable.id, id))
        .returning();

      // Calculate stats for author
      const authorSnippets = await db
        .select({ viewCount: snippetsTable.viewCount })
        .from(snippetsTable)
        .where(
          and(
            eq(snippetsTable.authorEmail, existing.authorEmail),
            eq(snippetsTable.status, "approved"),
          ),
        );

      const totalUploaded = authorSnippets.length;
      const totalViews = authorSnippets.reduce((acc, s) => acc + (s.viewCount || 0), 0);

      // Get rank by view count
      const allAuthors = await db
        .select({ email: snippetsTable.authorEmail, views: sum(snippetsTable.viewCount) })
        .from(snippetsTable)
        .where(eq(snippetsTable.status, "approved"))
        .groupBy(snippetsTable.authorEmail)
        .orderBy(desc(sum(snippetsTable.viewCount)));

      const rank = allAuthors.findIndex((a) => a.email === existing.authorEmail) + 1;

      // Send approval email
      sendApprovalEmail({
        to: existing.authorEmail,
        authorName: existing.authorName,
        snippetTitle: existing.title,
        totalUploaded,
        totalViews,
        rank: rank || 1,
      }).catch(() => {});

      res.json({ ...updated, tags: updated?.tags ?? [], createdAt: updated?.createdAt.toISOString(), updatedAt: updated?.updatedAt.toISOString() });
    } catch {
      res.status(500).json({ error: "SERVER_ERROR", message: "Failed to approve" });
    }
  });
});

// POST /api/admin/snippets/:id/reject
router.post("/admin/snippets/:id/reject", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async () => {
    const { id } = req.params;
    const reason = req.body?.reason || undefined;

    try {
      const [existing] = await db
        .select()
        .from(snippetsTable)
        .where(eq(snippetsTable.id, id))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: "NOT_FOUND", message: "Snippet not found" });
        return;
      }

      const [updated] = await db
        .update(snippetsTable)
        .set({ status: "rejected", rejectReason: reason ?? null, updatedAt: new Date() })
        .where(eq(snippetsTable.id, id))
        .returning();

      // Send rejection email
      sendRejectionEmail({
        to: existing.authorEmail,
        authorName: existing.authorName,
        snippetTitle: existing.title,
        reason,
      }).catch(() => {});

      res.json({ ...updated, tags: updated?.tags ?? [], createdAt: updated?.createdAt.toISOString(), updatedAt: updated?.updatedAt.toISOString() });
    } catch {
      res.status(500).json({ error: "SERVER_ERROR", message: "Failed to reject" });
    }
  });
});

// DELETE /api/admin/snippets/:id
router.delete("/admin/snippets/:id", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async () => {
    const { id } = req.params;
    try {
      await db.delete(snippetsTable).where(eq(snippetsTable.id, id));
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "SERVER_ERROR", message: "Failed to delete" });
    }
  });
});

// POST /api/admin/ban-email
router.post("/admin/ban-email", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async () => {
    const rawEmail = req.body?.email;
    const reason = req.body?.reason || "Diblokir oleh admin";

    if (!rawEmail) {
      res.status(400).json({ error: "VALIDATION_ERROR", message: "Email is required" });
      return;
    }

    const email = rawEmail.toLowerCase().trim();
    const bannedUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

    try {
      await db
        .insert(emailBansTable)
        .values({
          id: crypto.randomUUID(),
          email,
          bannedUntil,
          reason,
          createdAt: new Date(),
        })
        .onConflictDoUpdate({
          target: emailBansTable.email,
          set: { bannedUntil, reason },
        });

      res.json({ success: true, message: `Email ${email} telah diblokir.` });
    } catch {
      res.status(500).json({ error: "SERVER_ERROR", message: "Failed to ban email" });
    }
  });
});

// GET /api/admin/all-emails - Get all author emails
router.get("/admin/all-emails", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async () => {
    try {
      const rows = await db
        .selectDistinct({ email: snippetsTable.authorEmail, name: snippetsTable.authorName })
        .from(snippetsTable);

      res.json({ data: rows });
    } catch {
      res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch emails" });
    }
  });
});

// POST /api/admin/broadcast/all
router.post("/admin/broadcast/all", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async () => {
    const { subject, message, adminInitial } = req.body;

    if (!subject || !message) {
      res.status(400).json({ error: "VALIDATION_ERROR", message: "Subject dan message diperlukan" });
      return;
    }

    try {
      const rows = await db
        .selectDistinct({ email: snippetsTable.authorEmail })
        .from(snippetsTable);

      const emails = rows.map((r) => r.email);

      // Send in batches of 10
      for (let i = 0; i < emails.length; i += 10) {
        const batch = emails.slice(i, i + 10);
        await Promise.allSettled(
          batch.map((email) =>
            sendBroadcastEmail({ to: email, subject, message, adminInitial }),
          ),
        );
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
      });

      res.json({ success: true, recipientCount: emails.length });
    } catch {
      res.status(500).json({ error: "SERVER_ERROR", message: "Failed to broadcast" });
    }
  });
});

// POST /api/admin/broadcast/one
router.post("/admin/broadcast/one", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async () => {
    const { targetEmail, message, adminInitial, subject } = req.body;

    if (!targetEmail || !message || !subject) {
      res.status(400).json({ error: "VALIDATION_ERROR", message: "Email, subject, dan message diperlukan" });
      return;
    }

    try {
      await sendBroadcastEmail({
        to: targetEmail,
        subject,
        message,
        adminInitial,
      });

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
      });

      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "SERVER_ERROR", message: "Failed to send" });
    }
  });
});

// GET /api/admin/banned-emails - List banned emails
router.get("/admin/banned-emails", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async () => {
    try {
      const rows = await db
        .select()
        .from(emailBansTable)
        .where(gt(emailBansTable.bannedUntil, new Date()))
        .orderBy(desc(emailBansTable.createdAt));

      res.json({ data: rows.map((r) => ({ ...r, bannedUntil: r.bannedUntil.toISOString(), createdAt: r.createdAt.toISOString() })) });
    } catch {
      res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch" });
    }
  });
});

// DELETE /api/admin/ban-email/:email - Unban email
router.delete("/admin/ban-email/:email", async (req: Request, res: Response) => {
  await requireAdminSession(req, res, async () => {
    try {
      await db.delete(emailBansTable).where(eq(emailBansTable.email, req.params.email));
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "SERVER_ERROR", message: "Failed to unban" });
    }
  });
});

export default router;
