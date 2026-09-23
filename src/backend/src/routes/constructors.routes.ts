import { Router } from "express";
import { getConstructorStats } from "../controllers/constructors.controller.js";

const router = Router();

router.get("/:constructor_id/stats", getConstructorStats);

export default router;
