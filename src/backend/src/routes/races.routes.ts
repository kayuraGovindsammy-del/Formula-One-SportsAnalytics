import { Router } from "express";
import {
  getRace,
  listRaceEvents,
  listRaceLaps,
  listRaces,
} from "../controllers/races.controller.js";

const router = Router();

router.get("/", listRaces);
router.get("/:grand_prix_id", getRace);
router.get("/:grand_prix_id/laps", listRaceLaps);
router.get("/:grand_prix_id/events", listRaceEvents);

export default router;
