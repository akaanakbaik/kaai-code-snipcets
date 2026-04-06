import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

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
