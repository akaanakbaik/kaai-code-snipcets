import app from "./app.js";
import { logger } from "./lib/logger.js";
import { startSyncCron } from "./lib/sync.js";

const PORT = Number(process.env.API_PORT ?? process.env.PORT ?? 8080);

app.listen(PORT, "0.0.0.0", () => {
  logger.info(`[server] API running on http://0.0.0.0:${PORT}`);
  startSyncCron();
});
