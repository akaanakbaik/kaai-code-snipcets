import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import snippetsRouter from "./snippets.js";
import statsRouter from "./stats.js";
import adminRouter from "./admin.js";
import cronRouter from "./cron.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(adminRouter);
router.use(snippetsRouter);
router.use(statsRouter);
router.use(cronRouter);

export default router;
