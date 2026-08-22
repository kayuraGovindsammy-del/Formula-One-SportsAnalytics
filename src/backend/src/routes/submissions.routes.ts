import { Router } from "express";

import {
  authenticate,
} from "../middleware/authenticate.js";

import {
  requireAdmin,
  requireSubmitterOrAdmin,
} from "../middleware/authorization.js";

import {
  createSubmission,
  getSubmission,
  listSubmissions,
  reviewSubmission,
} from "../controllers/submissions.controller.js";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  requireSubmitterOrAdmin,
  listSubmissions
);

router.post(
  "/",
  requireSubmitterOrAdmin,
  createSubmission
);

router.get(
  "/:submission_id",
  requireSubmitterOrAdmin,
  getSubmission
);

router.patch(
  "/:submission_id",
  requireAdmin,
  reviewSubmission
);

export default router;