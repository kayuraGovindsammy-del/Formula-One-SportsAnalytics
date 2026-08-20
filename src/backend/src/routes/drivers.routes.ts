import { Router } from "express";
import { getDriver, listDrivers } from "../controllers/drivers.controller.js";

const router = Router();

router.get("/", listDrivers);
router.get("/:driver_id", getDriver);

export default router;
