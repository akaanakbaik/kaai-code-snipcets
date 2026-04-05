import { Router, type IRouter } from "express";
import healthRouter from "./health";
import snippetsRouter from "./snippets";
import statsRouter from "./stats";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(adminRouter);
router.use(snippetsRouter);
router.use(statsRouter);

export default router;
