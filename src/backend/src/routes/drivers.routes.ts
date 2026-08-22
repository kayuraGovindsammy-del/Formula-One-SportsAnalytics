import { Router } from "express";
import {
  getDriver,
  getDriverStats,
  listDrivers,
} from "../controllers/drivers.controller.js";

const router = Router();

router.get("/", listDrivers);
router.get("/:driver_id", getDriver);
router.get("/:driver_id/stats", getDriverStats);

export default router;
