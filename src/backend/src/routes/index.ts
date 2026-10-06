import { Router } from "express";

import chatRouter from "./chat.routes.js";
import constructorsRouter from "./constructors.routes.js";
import driversRouter from "./drivers.routes.js";
import exportsRouter from "./exports.routes.js";
import healthRouter from "./health.routes.js";
import racesRouter from "./races.routes.js";
import submissionsRouter from "./submissions.routes.js";
import usersRouter from "./users.routes.js";

const router = Router();

router.use(healthRouter);

router.use("/chat", chatRouter);

router.use("/constructors", constructorsRouter);

router.use("/drivers", driversRouter);

router.use("/export", exportsRouter);

router.use("/races", racesRouter);

router.use("/submissions", submissionsRouter);
router.use("/users", usersRouter);

export default router;