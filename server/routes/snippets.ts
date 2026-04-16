import { Router, type Request, type Response } from "express";
import { db } from "../lib/db.js";
import { snippetsTable, snippetLockAttemptsTable, snippetDisableLockOtpsTable } from "../lib/schema.js";
import { eq, and, or, ilike, sql, desc, count, asc } from "drizzle-orm";
import crypto from "node:crypto";
import { z } from "zod";
import { sendBroadcastEmail, sendDisableLockOtpEmail } from "../lib/mailer.js";
import { logger } from "../lib/logger.js";
import { generateUniqueSlug, titleToSlug } from "../lib/slug.js";

const router = Router();

const SUPERADMIN_EMAIL = "akaanakbaik17@proton.me";
const UNLOCK_SECRET = process.env.SNIPPET_UNLOCK_SECRET ?? "kaai-unlock-s3cr3t-2k25-xR9pQm7z";
const MAX_LOCK_ATTEMPTS = 5;
const LOCK_BAN_MS = 15 * 60 * 1000;
const UNLOCK_TOKEN_TTL_MS = 60 * 60 * 1000;

const ADMIN_EMAILS: Record<string, string> = {
  "akaanakbaik17@proton.me": "aka",
  "yaudahpakeaja6@gmail.com": "youso",
  "kelvdra46@gmail.com": "hydra",
  "clpmadang@gmail.com": "udin",
};

// ─── Cross-language search keyword map (ID ↔ EN) ──────────────────────────────
const CROSS_LANG_MAP: Record<string, string[]> = {
  "fungsi": ["function", "func", "method"],
  "function": ["fungsi", "func"],
  "kelas": ["class"],
  "class": ["kelas"],
  "array": ["larik", "daftar"],
  "larik": ["array", "list"],
  "loop": ["perulangan", "iterasi"],
  "perulangan": ["loop", "iteration"],
  "kondisi": ["condition", "if", "else"],
  "condition": ["kondisi"],
  "variabel": ["variable", "var"],
  "variable": ["variabel"],
  "database": ["basis data", "db"],
  "basis data": ["database", "db"],
  "autentikasi": ["authentication", "auth", "login"],
  "authentication": ["autentikasi", "auth"],
  "login": ["masuk", "autentikasi", "auth"],
  "masuk": ["login", "signin"],
  "daftar": ["register", "signup", "list"],
  "register": ["daftar", "signup"],
  "komponen": ["component"],
  "component": ["komponen"],
  "utilitas": ["utility", "util", "helper"],
  "utility": ["utilitas", "util", "helper"],
  "pencarian": ["search", "query"],
  "search": ["pencarian", "cari"],
  "cari": ["search", "pencarian"],
  "sortir": ["sort", "order"],
  "sort": ["sortir", "urut"],
  "filter": ["saring", "penyaring"],
  "saring": ["filter"],
  "enkripsi": ["encrypt", "encryption", "hash"],
  "encrypt": ["enkripsi"],
  "format": ["formatting", "parse"],
  "tanggal": ["date", "time", "datetime"],
  "date": ["tanggal", "waktu"],
  "waktu": ["time", "date", "timestamp"],
  "file": ["berkas", "dokumen"],
  "berkas": ["file"],
  "jaringan": ["network", "http", "api"],
  "network": ["jaringan"],
  "formulir": ["form", "input"],
  "form": ["formulir"],
  "tabel": ["table"],
  "table": ["tabel"],
  "koneksi": ["connection", "connect"],
  "connection": ["koneksi"],
  "pesan": ["message", "notification"],
  "message": ["pesan", "notifikasi"],
  "notifikasi": ["notification", "message"],
  "notification": ["notifikasi", "pesan"],
  "pengguna": ["user", "member", "akun"],
  "user": ["pengguna", "member"],
  "akun": ["account", "user"],
  "account": ["akun", "user", "pengguna"],
  "hapus": ["delete", "remove"],
  "delete": ["hapus", "remove"],
  "tambah": ["add", "insert", "create"],
  "add": ["tambah", "insert"],
  "ubah": ["update", "edit", "modify"],
  "update": ["ubah", "perbarui"],
  "perbarui": ["update", "refresh"],
  "rekursif": ["recursive", "recursion"],
  "recursive": ["rekursif"],
  "aljabar": ["algebra", "math", "matematika"],
  "matematika": ["math", "calculate", "kalkulasi"],
  "kalkulasi": ["calculate", "computation"],
  "gambar": ["image", "picture", "photo"],
  "image": ["gambar", "foto"],
  "warna": ["color", "colour"],
  "color": ["warna", "colour"],
  "animasi": ["animation", "animate"],
  "animation": ["animasi"],
  "tema": ["theme", "style"],
  "theme": ["tema", "gaya"],
};

function expandSearchTerms(query: string): string[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const expanded = new Set<string>(terms);
  for (const term of terms) {
    const mapped = CROSS_LANG_MAP[term];
    if (mapped) mapped.forEach((t) => expanded.add(t));
  }
  return Array.from(expanded);
}

function generateId(): string {
  const DIGITS = "0123456789";
  const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const SYMBOLS = "@_-+=~";
  const pick = (pool: string) => pool[Math.floor(Math.random() * pool.length)];
  const chars = [
    ...Array.from({ length: 4 }, () => pick(DIGITS)),
    ...Array.from({ length: 4 }, () => pick(LETTERS)),
    pick(SYMBOLS),
    pick(SYMBOLS),
  ];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
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
    slug: snippet.slug,
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
    lockDisabledAt: snippet.lockDisabledAt ? snippet.lockDisabledAt.toISOString() : null,
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
        slug: snippet.slug,
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
  tags: z.string().optional(),
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

// GET /api/snippets/tags — returns ALL tags with counts (+ optional limit param)
router.get("/snippets/tags", async (req, res) => {
  try {
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 500) : 0; // 0 = all
    const rows = await db.select({ tags: snippetsTable.tags }).from(snippetsTable).where(eq(snippetsTable.status, "approved"));
    const tagCounts: Record<string, number> = {};
    rows.forEach((r) => { (r.tags ?? []).forEach((tag) => { tagCounts[tag] = (tagCounts[tag] || 0) + 1; }); });
    let sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count }));
    if (limit > 0) sorted = sorted.slice(0, limit);
    res.json({ data: sorted, total: sorted.length });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch tags" });
  }
});

// GET /api/snippets/check-title — check if title is duplicate, return suggestions
router.get("/snippets/check-title", async (req, res) => {
  try {
    const title = String(req.query.title ?? "").trim();
    if (!title) { res.json({ isDuplicate: false }); return; }

    // Check exact or case-insensitive title match
    const rows = await db
      .select({ id: snippetsTable.id, slug: snippetsTable.slug, title: snippetsTable.title })
      .from(snippetsTable)
      .where(ilike(snippetsTable.title, title))
      .limit(1);

    const isDuplicate = rows.length > 0;
    if (!isDuplicate) {
      const previewSl = titleToSlug(title);
      res.json({ isDuplicate: false, previewSlug: previewSl });
      return;
    }

    // Generate what the next available slug would be
    const suggestedSlug = await generateUniqueSlug(title);
    // Suggested title: append " - N" matching the slug suffix
    const slugSuffix = suggestedSlug.replace(titleToSlug(title), "").replace(/^-/, "");
    const suggestedTitle = slugSuffix ? `${title} - ${slugSuffix}` : title;

    res.json({
      isDuplicate: true,
      existingId: rows[0]?.id ?? null,
      existingSlug: rows[0]?.slug ?? null,
      suggestedSlug,
      suggestedTitle,
    });
  } catch (err) {
    logger.warn(`[snippets] check-title error: ${(err as Error).message}`);
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to check title" });
  }
});

// POST /api/snippets/:id/view
router.post("/snippets/:id/view", async (req, res) => {
  try {
    const [snippet] = await db
      .select({ id: snippetsTable.id, viewCount: snippetsTable.viewCount })
      .from(snippetsTable)
      .where(and(eq(snippetsTable.id, req.params.id), eq(snippetsTable.status, "approved")))
      .limit(1);
    if (!snippet) { res.status(404).json({ error: "NOT_FOUND" }); return; }
    await db.update(snippetsTable).set({ viewCount: (snippet.viewCount ?? 0) + 1 }).where(eq(snippetsTable.id, snippet.id));
    res.json({ viewCount: (snippet.viewCount ?? 0) + 1 });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

// POST /api/snippets/:id/copy
router.post("/snippets/:id/copy", async (req, res) => {
  try {
    const [snippet] = await db
      .select({ id: snippetsTable.id, copyCount: snippetsTable.copyCount })
      .from(snippetsTable)
      .where(and(eq(snippetsTable.id, req.params.id), eq(snippetsTable.status, "approved")))
      .limit(1);
    if (!snippet) { res.status(404).json({ error: "NOT_FOUND" }); return; }
    await db.update(snippetsTable).set({ copyCount: (snippet.copyCount ?? 0) + 1 }).where(eq(snippetsTable.id, snippet.id));
    res.json({ copyCount: (snippet.copyCount ?? 0) + 1 });
  } catch {
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

// GET /api/snippets — list with search, filter, pagination
router.get("/snippets", async (req, res) => {
  const parsed = ListSnippetsQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid query params" });
    return;
  }

  const { page, limit, q, search, language, tag, tags, sort, sortBy } = parsed.data;
  const offset = (page - 1) * limit;
  const searchQuery = (q || search || "").trim();

  let resolvedSort: "newest" | "oldest" | "popular" | "copies" | "az" = "az";
  if (sort) {
    resolvedSort = sort;
  } else if (sortBy) {
    if (sortBy === "popular") resolvedSort = "popular";
    else if (sortBy === "latest") resolvedSort = "newest";
    else if (sortBy === "az") resolvedSort = "az";
  }

  try {
    const conditions = [eq(snippetsTable.status, "approved")];

    // Enhanced cross-language search
    if (searchQuery) {
      const terms = expandSearchTerms(searchQuery);
      const searchConditions = terms.flatMap((term) => [
        ilike(snippetsTable.title, `%${term}%`),
        ilike(snippetsTable.description, `%${term}%`),
        ilike(snippetsTable.authorName, `%${term}%`),
        ilike(snippetsTable.language, `%${term}%`),
        sql`EXISTS (SELECT 1 FROM unnest(${snippetsTable.tags}) AS t WHERE t ILIKE ${'%' + term + '%'})`,
      ]);
      conditions.push(or(...searchConditions)!);
    }

    if (language) conditions.push(eq(snippetsTable.language, language));

    // Support multiple tags via comma-separated "tags" param or single "tag" param
    const tagList = tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : tag ? [tag] : [];
    for (const t of tagList) {
      conditions.push(sql`${snippetsTable.tags} @> ARRAY[${t}]::text[]`);
    }

    const where = and(...conditions);
    const orderBy =
      resolvedSort === "newest"  ? [desc(snippetsTable.createdAt)] :
      resolvedSort === "oldest"  ? [asc(snippetsTable.createdAt)] :
      resolvedSort === "popular" ? [desc(snippetsTable.viewCount), desc(snippetsTable.copyCount)] :
      resolvedSort === "copies"  ? [desc(snippetsTable.copyCount)] :
      resolvedSort === "az"      ? [asc(snippetsTable.title)] :
      [asc(snippetsTable.title)];

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
  } catch (err) {
    logger.error(`[snippets] List error: ${(err as Error).message}`);
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch snippets" });
  }
});

// POST /api/snippets — create new snippet
router.post("/snippets", async (req, res) => {
  const parsed = CreateSnippetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
    return;
  }

  const { isLocked, lockType, lockPassword, ...rest } = parsed.data;

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
  // Generate pure title-based unique slug (e.g., "downr", "downr-2", "downr-3")
  const slug = await generateUniqueSlug(rest.title);

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
        slug,
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

// GET /api/snippets/:id — supports both ID and slug lookup
router.get("/snippets/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const unlockToken = req.headers["x-unlock-token"] as string | undefined;

    // Try by ID first, then by slug
    let snippet = await db
      .select()
      .from(snippetsTable)
      .where(and(eq(snippetsTable.id, id), eq(snippetsTable.status, "approved")))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!snippet) {
      snippet = await db
        .select()
        .from(snippetsTable)
        .where(and(eq(snippetsTable.slug, id), eq(snippetsTable.status, "approved")))
        .limit(1)
        .then((rows) => rows[0] ?? null);
    }

    if (!snippet) {
      res.status(404).json({ error: "NOT_FOUND", message: "Snippet tidak ditemukan" });
      return;
    }

    // If locked, check for unlock token
    if (snippet.isLocked) {
      if (unlockToken && verifyUnlockToken(unlockToken, snippet.id)) {
        res.json(formatSnippet(snippet, { includeCode: true }));
      } else {
        res.json(formatSnippet(snippet, { includeCode: false }));
      }
      return;
    }

    res.json(formatSnippet(snippet));
  } catch (err) {
    logger.error(`[snippets] Get error: ${(err as Error).message}`);
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch snippet" });
  }
});

// POST /api/snippets/:id/unlock — validate password and return unlock token
router.post("/snippets/:id/unlock", async (req: Request, res: Response) => {
  const { id } = req.params;
  const ip = getClientIp(req);
  const { password } = req.body ?? {};

  if (!password) {
    res.status(400).json({ error: "MISSING_PASSWORD", message: "Password diperlukan" });
    return;
  }

  try {
    // Check for existing ban
    const [attempt] = await db
      .select()
      .from(snippetLockAttemptsTable)
      .where(and(eq(snippetLockAttemptsTable.snippetId, id), eq(snippetLockAttemptsTable.ipAddress, ip)))
      .limit(1);

    if (attempt?.bannedUntil && attempt.bannedUntil > new Date()) {
      const minutesLeft = Math.ceil((attempt.bannedUntil.getTime() - Date.now()) / 60000);
      res.status(429).json({
        error: "TOO_MANY_ATTEMPTS",
        message: `Terlalu banyak percobaan. Coba lagi dalam ${minutesLeft} menit.`,
        bannedUntil: attempt.bannedUntil.toISOString(),
      });
      return;
    }

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

    // If lock is disabled, allow access without password
    if (snippet.lockDisabledAt) {
      const token = generateUnlockToken(snippet.id);
      res.json({ success: true, token });
      return;
    }

    const inputHash = hashPassword(password, snippet.lockSalt);
    const isCorrect = crypto.timingSafeEqual(
      Buffer.from(inputHash, "hex"),
      Buffer.from(snippet.lockHash, "hex")
    );

    if (!isCorrect) {
      const newCount = (attempt?.attemptCount ?? 0) + 1;
      let bannedUntil: Date | null = null;

      if (newCount >= MAX_LOCK_ATTEMPTS) {
        const multiplier = Math.pow(2, Math.floor(newCount / MAX_LOCK_ATTEMPTS) - 1);
        bannedUntil = new Date(Date.now() + LOCK_BAN_MS * Math.min(multiplier, 64));
      }

      const attemptsLeft = Math.max(0, MAX_LOCK_ATTEMPTS - newCount);

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

      res.status(401).json({
        error: "WRONG_PASSWORD",
        message: snippet.lockType === "pin" ? "PIN salah." : "Password salah.",
        attemptsLeft,
        banned: !!bannedUntil,
      });
      return;
    }

    // Reset attempts on success
    if (attempt) {
      await db.update(snippetLockAttemptsTable).set({ attemptCount: 0, bannedUntil: null }).where(eq(snippetLockAttemptsTable.id, attempt.id));
    }

    const token = generateUnlockToken(snippet.id);
    res.json({ success: true, token });
  } catch (err) {
    logger.error(`[snippets] Unlock error: ${(err as Error).message}`);
    res.status(500).json({ error: "SERVER_ERROR", message: "Gagal memproses unlock" });
  }
});

// POST /api/snippets/:id/disable-lock/request — request OTP to disable lock
router.post("/snippets/:id/disable-lock/request", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { authorEmail } = req.body ?? {};

  if (!authorEmail) {
    res.status(400).json({ error: "MISSING_EMAIL", message: "Email diperlukan" });
    return;
  }

  try {
    const [snippet] = await db
      .select()
      .from(snippetsTable)
      .where(and(eq(snippetsTable.id, id), eq(snippetsTable.status, "approved")))
      .limit(1);

    if (!snippet) {
      res.status(404).json({ error: "NOT_FOUND", message: "Snippet tidak ditemukan" });
      return;
    }

    if (!snippet.isLocked) {
      res.status(400).json({ error: "NOT_LOCKED", message: "Snippet ini tidak dikunci" });
      return;
    }

    if (snippet.lockDisabledAt) {
      res.status(400).json({ error: "ALREADY_DISABLED", message: "Kunci sudah dinonaktifkan" });
      return;
    }

    if (snippet.authorEmail.toLowerCase() !== String(authorEmail).toLowerCase()) {
      res.status(403).json({ error: "FORBIDDEN", message: "Email tidak cocok dengan email pemilik snippet" });
      return;
    }

    const otp = String(100000 + crypto.randomInt(900000)); // 6-digit OTP
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes

    await db.insert(snippetDisableLockOtpsTable).values({
      id: crypto.randomUUID(),
      snippetId: id,
      authorEmail: snippet.authorEmail,
      otp,
      expiresAt,
      used: false,
      createdAt: new Date(),
    });

    await sendDisableLockOtpEmail(snippet.authorEmail, snippet.title, otp);

    res.json({ success: true, message: "Kode OTP dikirim ke email kamu" });
  } catch (err) {
    logger.error(`[snippets] DisableLock request error: ${(err as Error).message}`);
    res.status(500).json({ error: "SERVER_ERROR", message: "Gagal mengirim OTP" });
  }
});

// POST /api/snippets/:id/disable-lock/verify — verify OTP and disable lock
router.post("/snippets/:id/disable-lock/verify", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { otp } = req.body ?? {};

  if (!otp) {
    res.status(400).json({ error: "MISSING_OTP", message: "Kode OTP diperlukan" });
    return;
  }

  try {
    const [snippet] = await db
      .select()
      .from(snippetsTable)
      .where(and(eq(snippetsTable.id, id), eq(snippetsTable.status, "approved")))
      .limit(1);

    if (!snippet) {
      res.status(404).json({ error: "NOT_FOUND", message: "Snippet tidak ditemukan" });
      return;
    }

    const [otpRecord] = await db
      .select()
      .from(snippetDisableLockOtpsTable)
      .where(
        and(
          eq(snippetDisableLockOtpsTable.snippetId, id),
          eq(snippetDisableLockOtpsTable.used, false),
        )
      )
      .orderBy(desc(snippetDisableLockOtpsTable.createdAt))
      .limit(1);

    if (!otpRecord) {
      res.status(400).json({ error: "NO_OTP", message: "Tidak ada OTP aktif untuk snippet ini" });
      return;
    }

    if (otpRecord.expiresAt < new Date()) {
      res.status(400).json({ error: "OTP_EXPIRED", message: "Kode OTP sudah kadaluarsa" });
      return;
    }

    if (otpRecord.otp !== String(otp).trim()) {
      res.status(400).json({ error: "WRONG_OTP", message: "Kode OTP salah" });
      return;
    }

    await db.update(snippetDisableLockOtpsTable).set({ used: true }).where(eq(snippetDisableLockOtpsTable.id, otpRecord.id));

    const now = new Date();
    const [updated] = await db.update(snippetsTable)
      .set({ lockDisabledAt: now, updatedAt: now })
      .where(eq(snippetsTable.id, id))
      .returning();

    res.json({ success: true, message: "Kunci berhasil dimatikan secara permanen", snippet: formatSnippet(updated) });
  } catch (err) {
    logger.error(`[snippets] DisableLock verify error: ${(err as Error).message}`);
    res.status(500).json({ error: "SERVER_ERROR", message: "Gagal memverifikasi OTP" });
  }
});

// POST /api/snippets/:id/approve (Webhook for Telegram bot)
router.post("/snippets/:id/approve", async (req, res) => {
  const secret = process.env.VITE_WEBHOOK_SECRET;
  if (secret && req.headers["x-webhook-secret"] !== secret) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }
  const [snippet] = await db
    .select()
    .from(snippetsTable)
    .where(eq(snippetsTable.id, req.params.id))
    .limit(1);

  if (!snippet) { res.status(404).json({ error: "NOT_FOUND" }); return; }

  // Backfill slug if missing
  const slug = snippet.slug ?? generateSlug(snippet.title, snippet.id);

  const [updated] = await db
    .update(snippetsTable)
    .set({ status: "approved", slug, updatedAt: new Date() })
    .where(eq(snippetsTable.id, req.params.id))
    .returning();

  res.json(formatSnippet(updated));
});

// POST /api/snippets/:id/reject (Webhook for Telegram bot)
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
