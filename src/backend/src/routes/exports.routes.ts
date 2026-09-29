import { Router } from "express";
import { exportDataset } from "../controllers/exports.controller.js";

const router = Router();

router.get("/:dataset", exportDataset);

export default router;
