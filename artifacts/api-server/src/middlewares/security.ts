import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { db } from "@workspace/db";
import { ipBansTable, emailBansTable } from "@workspace/db/schema";
import { eq, gt } from "drizzle-orm";

// Global rate limiter: max 10 requests per second per IP
export const globalRateLimit = rateLimit({
  windowMs: 1000, // 1 second
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "RATE_LIMITED", message: "Too many requests. Please slow down." },
  keyGenerator: (req) => {
    return (
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "unknown"
    );
  },
});

// Strict rate limiter for admin login: 5 attempts per minute
export const adminLoginRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "RATE_LIMITED", message: "Too many login attempts. Try again later." },
  keyGenerator: (req) => {
    return (
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "unknown"
    );
  },
});

function getClientIp(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

// Check if IP is banned
export async function checkIpBan(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ip = getClientIp(req);
  try {
    const [ban] = await db
      .select()
      .from(ipBansTable)
      .where(eq(ipBansTable.ipAddress, ip))
      .limit(1);

    if (ban && ban.bannedUntil > new Date()) {
      const minutesLeft = Math.ceil((ban.bannedUntil.getTime() - Date.now()) / 60000);
      res.status(403).json({
        error: "IP_BANNED",
        message: `Your IP has been temporarily banned. Try again in ${minutesLeft} minute(s).`,
        bannedUntil: ban.bannedUntil.toISOString(),
      });
      return;
    }

    // Remove expired ban if any
    if (ban && ban.bannedUntil <= new Date()) {
      await db.delete(ipBansTable).where(eq(ipBansTable.ipAddress, ip));
    }
  } catch {
    // Don't block on DB error
  }
  next();
}

// Security headers middleware
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Remove server fingerprinting
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
      "frame-ancestors 'none'",
    ].join("; "),
  );
  next();
}

// Error handler that never leaks stack traces or internals
export function safeErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const status = (err as any).status ?? (err as any).statusCode ?? 500;
  const isProd = process.env.NODE_ENV === "production";
  res.status(status).json({
    error: status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR",
    message: isProd && status >= 500 ? "An unexpected error occurred." : err.message,
  });
  next;
}

export { getClientIp };
