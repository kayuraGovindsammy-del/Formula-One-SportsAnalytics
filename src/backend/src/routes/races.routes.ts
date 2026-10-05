import { Router } from "express";
import {
  getRace,
  getRaceStatistics,
  getRaceQualifying,
  listRaceEvents,
  listRaceLaps,
  listRaces,
} from "../controllers/races.controller.js";

const router = Router();

router.get("/", listRaces);
router.get("/:grand_prix_id", getRace);
router.get("/:grand_prix_id/laps", listRaceLaps);
router.get("/:grand_prix_id/events", listRaceEvents);
router.get("/:grand_prix_id/statistics", getRaceStatistics);
router.get("/:grand_prix_id/qualifying", getRaceQualifying);

export default router;
