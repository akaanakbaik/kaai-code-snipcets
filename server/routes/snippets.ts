import { Router, type Request, type Response } from "express";
import { db } from "../lib/db.js";
import { snippetsTable, snippetLockAttemptsTable } from "../lib/schema.js";
import { eq, and, or, ilike, sql, desc, count, asc } from "drizzle-orm";
import crypto from "node:crypto";
import { z } from "zod";
import { sendBroadcastEmail } from "../lib/mailer.js";
import { logger } from "../lib/logger.js";

const router = Router();

const SUPERADMIN_EMAIL = "khaliqarrasyidabdul@gmail.com";
const UNLOCK_SECRET = process.env.SNIPPET_UNLOCK_SECRET ?? "kaai-unlock-s3cr3t-2k25-xR9pQm7z";
const MAX_LOCK_ATTEMPTS = 5;
const LOCK_BAN_MS = 15 * 60 * 1000; // 15 minutes initial ban
const UNLOCK_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const ADMIN_EMAILS: Record<string, string> = {
  "akaanakbaik17@proton.me": "aka",
  "yaudahpakeaja6@gmail.com": "youso",
  "kelvdra46@gmail.com": "hydra",
  "clpmadang@gmail.com": "udin",
};

function generateId(): string {
  const digits = Array.from({ length: 5 }, () => Math.floor(Math.random() * 10)).join("");
  const letters = Array.from({ length: 5 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26))
  ).join("");
  return digits + letters;
}

function getClientIp(req: Request): string {
  return (
    (req.headers["cf-connecting-ip"] as string) ||
    (req.headers["x-real-ip"] as string) ||
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
}

function generateUnlockToken(snippetId: string): string {
  const expiresAt = Date.now() + UNLOCK_TOKEN_TTL_MS;
  const payload = `${snippetId}:${expiresAt}`;
  const sig = crypto.createHmac("sha256", UNLOCK_SECRET).update(payload).digest("hex");
  return Buffer.from(payload).toString("base64url") + "." + sig;
}

function verifyUnlockToken(token: string, snippetId: string): boolean {
  try {
    const [b64, sig] = token.split(".");
    if (!b64 || !sig) return false;
    const payload = Buffer.from(b64, "base64url").toString();
    const [tokenSnippetId, expiresAtStr] = payload.split(":");
    if (tokenSnippetId !== snippetId) return false;
    const expiresAt = Number(expiresAtStr);
    if (Date.now() > expiresAt) return false;
    const expectedSig = crypto.createHmac("sha256", UNLOCK_SECRET).update(payload).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expectedSig, "hex"));
  } catch {
    return false;
  }
}

function formatSnippet(
  snippet: typeof snippetsTable.$inferSelect,
  options: { hideEmail?: boolean; includeCode?: boolean } = {}
) {
  const { hideEmail = true, includeCode = true } = options;
  const result: Record<string, unknown> = {
    id: snippet.id,
    title: snippet.title,
    description: snippet.description,
    language: snippet.language,
    tags: snippet.tags ?? [],
    authorName: snippet.authorName,
    status: snippet.status,
    rejectReason: snippet.rejectReason,
    viewCount: snippet.viewCount,
    copyCount: snippet.copyCount,
    isLocked: snippet.isLocked,
    lockType: snippet.isLocked ? (snippet.lockType ?? null) : null,
    createdAt: snippet.createdAt.toISOString(),
    updatedAt: snippet.updatedAt.toISOString(),
  };
  if (!hideEmail) result.authorEmail = snippet.authorEmail;
  if (includeCode) result.code = snippet.code;
  return result;
}

async function sendToBot(snippet: Record<string, unknown>) {
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
        tagcode: (snippet.tags as string[])?.join(","),
        code: snippet.code,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Best-effort
  }
}

async function notifyAdmins(snippetTitle: string, snippetId: string, authorName: string): Promise<void> {
  await Promise.allSettled(
    Object.entries(ADMIN_EMAILS).map(([email, name]) =>
      sendBroadcastEmail(
        email,
        `[Kaai] Ada snippet baru menunggu review`,
        `Hai ${name}, ada code yang perlu di acc nih, acc segera ya!\n\n` +
        `Judul: ${snippetTitle}\n` +
        `Pengirim: ${authorName}\n` +
        `ID: ${snippetId}\n\n` +
        `Buka panel admin di https://codes-snippet.kaai.my.id/admin untuk review.`,
      ).catch(() => {})
    )
  );
  logger.info(`[snippets] Admin notification sent for snippet ${snippetId}`);
}

const CreateSnippetBody = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).default(""),
  language: z.string().min(1).max(50),
  tags: z.array(z.string()).max(10).default([]),
  code: z.string().min(1).max(50000),
  authorName: z.string().min(1).max(100),
  authorEmail: z.string().email().max(200),
  isLocked: z.boolean().optional().default(false),
  lockType: z.enum(["password", "pin"]).optional(),
  lockPassword: z.string().min(4).max(100).optional(),
});

const ListSnippetsQuery = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  q: z.string().optional(),
  search: z.string().optional(),
  language: z.string().optional(),
  tag: z.string().optional(),
  sort: z.enum(["newest", "oldest", "popular", "copies", "az"]).optional(),
  sortBy: z.enum(["popular", "latest", "az"]).optional(),
});

// GET /api/snippets/popular
router.get("/snippets/popular", async (req, res) => {
  try {
    const [mostViewed, mostCopied] = await Promise.all([
      db.select().from(snippetsTable).where(eq(snippetsTable.status, "approved")).orderBy(desc(snippetsTable.viewCount)).limit(6),
      db.select().from(snippetsTable).where(eq(snippetsTable.status, "approved")).orderBy(desc(snippetsTable.copyCount)).limit(6),
    ]);
    res.json({ mostViewed: mostViewed.map((s) => formatSnippet(s)), mostCopied: mostCopied.map((s) => formatSnippet(s)) });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch popular snippets" });
  }
});

// GET /api/snippets/tags
router.get("/snippets/tags", async (req, res) => {
  try {
    const rows = await db.select({ tags: snippetsTable.tags }).from(snippetsTable).where(eq(snippetsTable.status, "approved"));
    const tagCounts: Record<string, number> = {};
    rows.forEach((r) => { (r.tags ?? []).forEach((tag) => { tagCounts[tag] = (tagCounts[tag] || 0) + 1; }); });
    const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([tag, count]) => ({ tag, count }));
    res.json({ data: sorted });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch tags" });
  }
});

// POST /api/snippets/:id/view
router.post("/snippets/:id/view", async (req, res) => {
  try {
    await db.update(snippetsTable).set({ viewCount: sql`${snippetsTable.viewCount} + 1` }).where(and(eq(snippetsTable.id, req.params.id), eq(snippetsTable.status, "approved")));
    res.json({ success: true });
  } catch {
    res.json({ success: false });
  }
});

// POST /api/snippets/:id/copy
router.post("/snippets/:id/copy", async (req, res) => {
  try {
    await db.update(snippetsTable).set({ copyCount: sql`${snippetsTable.copyCount} + 1` }).where(and(eq(snippetsTable.id, req.params.id), eq(snippetsTable.status, "approved")));
    res.json({ success: true });
  } catch {
    res.json({ success: false });
  }
});

// POST /api/snippets/:id/unlock — verify password/pin for locked snippet
router.post("/snippets/:id/unlock", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { password } = req.body ?? {};
  const ip = getClientIp(req);

  if (!password || typeof password !== "string" || password.length > 200) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Password/PIN diperlukan" });
    return;
  }

  try {
    // Check rate limit
    const [attempt] = await db
      .select()
      .from(snippetLockAttemptsTable)
      .where(and(eq(snippetLockAttemptsTable.snippetId, id), eq(snippetLockAttemptsTable.ipAddress, ip)))
      .limit(1);

    if (attempt) {
      if (attempt.bannedUntil && attempt.bannedUntil > new Date()) {
        const remainSec = Math.ceil((attempt.bannedUntil.getTime() - Date.now()) / 1000);
        const remainMin = Math.ceil(remainSec / 60);
        res.status(429).json({
          error: "RATE_LIMITED",
          message: `Terlalu banyak percobaan. Coba lagi dalam ${remainMin} menit.`,
          retryAfter: attempt.bannedUntil.toISOString(),
        });
        return;
      }
    }

    // Fetch snippet
    const [snippet] = await db
      .select()
      .from(snippetsTable)
      .where(and(eq(snippetsTable.id, id), eq(snippetsTable.status, "approved")))
      .limit(1);

    if (!snippet) {
      res.status(404).json({ error: "NOT_FOUND", message: "Snippet tidak ditemukan" });
      return;
    }

    if (!snippet.isLocked || !snippet.lockHash || !snippet.lockSalt) {
      res.status(400).json({ error: "NOT_LOCKED", message: "Snippet ini tidak dikunci" });
      return;
    }

    // Verify password
    const inputHash = hashPassword(password, snippet.lockSalt);
    const isCorrect = crypto.timingSafeEqual(
      Buffer.from(inputHash, "hex"),
      Buffer.from(snippet.lockHash, "hex")
    );

    if (!isCorrect) {
      // Increment attempts
      const newCount = (attempt?.attemptCount ?? 0) + 1;
      let bannedUntil: Date | null = null;

      if (newCount >= MAX_LOCK_ATTEMPTS) {
        // Exponential backoff: 15min * 2^(n-5) where n = total attempts
        const multiplier = Math.pow(2, Math.floor(newCount / MAX_LOCK_ATTEMPTS) - 1);
        bannedUntil = new Date(Date.now() + LOCK_BAN_MS * Math.min(multiplier, 64));
      }

      if (attempt) {
        await db.update(snippetLockAttemptsTable).set({
          attemptCount: newCount,
          lastAttemptAt: new Date(),
          bannedUntil: bannedUntil ?? attempt.bannedUntil,
        }).where(eq(snippetLockAttemptsTable.id, attempt.id));
      } else {
        await db.insert(snippetLockAttemptsTable).values({
          id: crypto.randomUUID(),
          snippetId: id,
          ipAddress: ip,
          attemptCount: 1,
          lastAttemptAt: new Date(),
          bannedUntil,
        });
      }

      const attemptsLeft = Math.max(0, MAX_LOCK_ATTEMPTS - (newCount % MAX_LOCK_ATTEMPTS));
      res.status(401).json({
        error: "WRONG_PASSWORD",
        message: `Password/PIN salah. ${attemptsLeft > 0 ? `Sisa ${attemptsLeft} percobaan sebelum diblokir sementara.` : "Akses diblokir sementara."}`,
        attemptsLeft,
      });
      return;
    }

    // Correct password — reset attempts
    if (attempt) {
      await db.delete(snippetLockAttemptsTable).where(eq(snippetLockAttemptsTable.id, attempt.id));
    }

    const token = generateUnlockToken(id);
    res.json({ success: true, token, expiresIn: UNLOCK_TOKEN_TTL_MS / 1000 });
  } catch (err) {
    logger.error(`[unlock] Error: ${(err as Error).message}`);
    res.status(500).json({ error: "SERVER_ERROR", message: "Terjadi kesalahan server" });
  }
});

// GET /api/snippets
router.get("/snippets", async (req, res) => {
  const parsed = ListSnippetsQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid query params" });
    return;
  }

  const { page, limit, q, search, language, tag, sort, sortBy } = parsed.data;
  const offset = (page - 1) * limit;
  const searchQuery = q || search || undefined;

  let resolvedSort: "newest" | "oldest" | "popular" | "copies" | "az" = "newest";
  if (sort) {
    resolvedSort = sort;
  } else if (sortBy) {
    if (sortBy === "popular") resolvedSort = "popular";
    else if (sortBy === "latest") resolvedSort = "newest";
    else if (sortBy === "az") resolvedSort = "az";
  }

  try {
    const conditions = [eq(snippetsTable.status, "approved")];
    if (searchQuery) {
      conditions.push(
        or(
          ilike(snippetsTable.title, `%${searchQuery}%`),
          ilike(snippetsTable.description, `%${searchQuery}%`),
          ilike(snippetsTable.authorName, `%${searchQuery}%`),
          sql`EXISTS (SELECT 1 FROM unnest(${snippetsTable.tags}) AS t WHERE t ILIKE ${'%' + searchQuery + '%'})`,
        )!
      );
    }
    if (language) conditions.push(eq(snippetsTable.language, language));
    if (tag) conditions.push(sql`${snippetsTable.tags} @> ARRAY[${tag}]::text[]`);

    const where = and(...conditions);
    const orderBy =
      resolvedSort === "newest"  ? [desc(snippetsTable.createdAt)] :
      resolvedSort === "oldest"  ? [asc(snippetsTable.createdAt)] :
      resolvedSort === "popular" ? [desc(snippetsTable.viewCount), desc(snippetsTable.copyCount)] :
      resolvedSort === "copies"  ? [desc(snippetsTable.copyCount)] :
      resolvedSort === "az"      ? [asc(snippetsTable.title)] :
      [desc(snippetsTable.createdAt)];

    const [snippets, [{ total }]] = await Promise.all([
      db.select().from(snippetsTable).where(where).orderBy(...orderBy).limit(limit).offset(offset),
      db.select({ total: count() }).from(snippetsTable).where(where),
    ]);

    const totalNum = Number(total);
    res.json({
      data: snippets.map((s) => formatSnippet(s, { includeCode: !s.isLocked })),
      pagination: { page, limit, total: totalNum, totalPages: Math.ceil(totalNum / limit) },
      totalPages: Math.ceil(totalNum / limit),
    });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch snippets" });
  }
});

// POST /api/snippets
router.post("/snippets", async (req, res) => {
  const parsed = CreateSnippetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
    return;
  }

  const { isLocked, lockType, lockPassword, ...rest } = parsed.data;

  // Validate lock fields
  if (isLocked) {
    if (!lockType) {
      res.status(400).json({ error: "VALIDATION_ERROR", message: "lockType diperlukan jika snippet dikunci" });
      return;
    }
    if (!lockPassword || lockPassword.length < 4) {
      res.status(400).json({ error: "VALIDATION_ERROR", message: "Password/PIN minimal 4 karakter" });
      return;
    }
    if (lockType === "pin" && !/^\d+$/.test(lockPassword)) {
      res.status(400).json({ error: "VALIDATION_ERROR", message: "PIN hanya boleh berisi angka" });
      return;
    }
  }

  const id = generateId();
  try {
    let lockHash: string | null = null;
    let lockSalt: string | null = null;

    if (isLocked && lockPassword) {
      lockSalt = crypto.randomBytes(32).toString("hex");
      lockHash = hashPassword(lockPassword, lockSalt);
    }

    const [snippet] = await db
      .insert(snippetsTable)
      .values({
        id,
        ...rest,
        isLocked: isLocked ?? false,
        lockType: isLocked ? (lockType ?? null) : null,
        lockHash,
        lockSalt,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const full = { ...snippet, authorEmail: snippet.authorEmail };
    sendToBot(full as any).catch(() => {});
    notifyAdmins(snippet.title, snippet.id, snippet.authorName).catch(() => {});

    res.status(201).json(formatSnippet(snippet));
  } catch (err) {
    logger.error(`[snippets] Create error: ${(err as Error).message}`);
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to create snippet" });
  }
});

// GET /api/snippets/:id
router.get("/snippets/:id", async (req: Request, res: Response) => {
  try {
    const [snippet] = await db
      .select()
      .from(snippetsTable)
      .where(and(eq(snippetsTable.id, req.params.id), eq(snippetsTable.status, "approved")))
      .limit(1);

    if (!snippet) {
      res.status(404).json({ error: "NOT_FOUND", message: "Snippet not found" });
      return;
    }

    // Handle locked snippet: check for unlock token
    if (snippet.isLocked) {
      const tokenHeader = req.headers["x-unlock-token"] as string | undefined;
      const includeCode = !!tokenHeader && verifyUnlockToken(tokenHeader, snippet.id);
      res.json(formatSnippet(snippet, { includeCode }));
      return;
    }

    res.json(formatSnippet(snippet));
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch snippet" });
  }
});

// Webhook approve/reject (for Telegram bot)
router.post("/snippets/:id/approve", async (req, res) => {
  const secret = process.env.VITE_WEBHOOK_SECRET;
  if (secret && req.headers["x-webhook-secret"] !== secret) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }
  const [updated] = await db
    .update(snippetsTable)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(snippetsTable.id, req.params.id))
    .returning();
  if (!updated) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  res.json(formatSnippet(updated));
});

router.post("/snippets/:id/reject", async (req, res) => {
  const secret = process.env.VITE_WEBHOOK_SECRET;
  if (secret && req.headers["x-webhook-secret"] !== secret) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }
  const reason = req.body?.reason;
  const [updated] = await db
    .update(snippetsTable)
    .set({ status: "rejected", rejectReason: reason ?? null, updatedAt: new Date() })
    .where(eq(snippetsTable.id, req.params.id))
    .returning();
  if (!updated) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  res.json(formatSnippet(updated));
});

export default router;
