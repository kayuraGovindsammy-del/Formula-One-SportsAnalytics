import { Router } from "express";

import driversRouter from "./drivers.routes.js";
import healthRouter from "./health.routes.js";
import racesRouter from "./races.routes.js";
import submissionsRouter from "./submissions.routes.js";

const router = Router();

router.use(healthRouter);

router.use("/drivers", driversRouter);

router.use("/races", racesRouter);

router.use("/submissions", submissionsRouter);

export default router;