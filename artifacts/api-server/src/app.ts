import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { globalRateLimit, securityHeaders, safeErrorHandler } from "./middlewares/security";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Security headers
app.use(securityHeaders);

// CORS - allow credentials from frontend
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Webhook-Secret"],
  }),
);

// Cookie parser
app.use(cookieParser());

// Body parsers
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// Global rate limiting
app.use(globalRateLimit);

// Routes
app.use("/api", router);

// Safe error handler — never leaks stack traces or env info
app.use(safeErrorHandler as any);

export default app;
