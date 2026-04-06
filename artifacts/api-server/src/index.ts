import app from "./app";
import { logger } from "./lib/logger";
import { startSyncCron } from "./lib/sync";
import { verifyMailer } from "./lib/mailer";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Verify SMTP connection on startup (non-blocking)
  verifyMailer().then((ok) => {
    if (!ok) logger.warn("[startup] Mailer SMTP not verified — check GMAIL_USER and GMAIL_PASS env vars");
  });

  // Start background sync cron (Supabase keep-alive + GitHub backup)
  startSyncCron();
});
