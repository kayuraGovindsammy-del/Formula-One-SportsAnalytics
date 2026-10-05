import { Router } from "express";
import { postChat } from "../controllers/chat.controller.js";
import { createRateLimiter } from "../middleware/rateLimit.js";

/**
 * Each chat request can cost up to four upstream LLM calls, so the endpoint
 * is limited per client and capped per day to stay inside the providers'
 * free quotas. Exported so tests can reset it.
 */
export const chatRateLimiter = createRateLimiter({
  perIpLimit: 10,
  windowMs: 60_000,
  dailyCap: 800,
});

const router = Router();

router.post("/", chatRateLimiter, postChat);

export default router;
