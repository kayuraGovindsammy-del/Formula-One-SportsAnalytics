import { Router } from "express";
import { authenticate, type AuthenticatedRequest } from "../middleware/authenticate.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { ApiError } from "../middleware/ApiError.js";
import { requestAccountDeletion } from "../services/accountDeletion.js";

const router = Router();

router.delete("/me", authenticate, asyncHandler(async (req, res) => {
  const currentUser = req as AuthenticatedRequest;
  const authTime = currentUser.authTime;
  const age = typeof authTime === "number" ? Date.now() / 1000 - authTime : Infinity;

  if (age < -60 || age > 300) {
    throw new ApiError(401, "RECENT_LOGIN_REQUIRED", "Sign in again before deleting your account.");
  }

  const complete = await requestAccountDeletion(currentUser.authenticatedUser!.uid);
  if (complete) {
    res.status(204).end();
  } else {
    res.status(202).json({ data: { status: "deletion_pending" }, meta: {} });
  }
}));

export default router;
