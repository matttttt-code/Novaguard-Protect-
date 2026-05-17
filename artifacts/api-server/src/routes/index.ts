import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import ownerRouter from "./owner";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(ownerRouter);

export default router;
