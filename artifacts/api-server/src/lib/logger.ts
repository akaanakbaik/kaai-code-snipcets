import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Production: synchronous stdout — NO worker threads, NO pino-pretty transport.
 * Worker threads break in Vercel serverless (paths baked at build time don't exist at runtime).
 *
 * Development: pino-pretty transport for readable logs.
 */
export const logger = isProduction
  ? pino(
      {
        level: process.env.LOG_LEVEL ?? "info",
        redact: [
          "req.headers.authorization",
          "req.headers.cookie",
          "res.headers['set-cookie']",
        ],
      },
      pino.destination({ dest: 1, sync: true }),
    )
  : pino({
      level: process.env.LOG_LEVEL ?? "info",
      redact: [
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers['set-cookie']",
      ],
      transport: {
        target: "pino-pretty",
        options: { colorize: true },
      },
    });
