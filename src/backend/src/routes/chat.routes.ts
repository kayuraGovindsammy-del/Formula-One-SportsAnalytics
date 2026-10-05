import { Router } from "express";
import { postChat } from "../controllers/chat.controller.js";
import { createRateLimiter } from "../middleware/rateLimit.js";

/**
 * Default global cap on chat requests per UTC day. Each chat can make up to
 * four LLM calls, so 200 chats stay inside a free daily allowance of roughly
 * 1,000 requests.
 */
export const DEFAULT_CHAT_DAILY_LIMIT = 200;

/**
 * CHAT_DAILY_LIMIT as a positive integer. Unset or blank means the default;
 * anything else invalid also falls back to it, with a warning, rather than
 * leaving the endpoint uncapped or failing startup.
 */
export function chatDailyLimitFromEnv(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.CHAT_DAILY_LIMIT?.trim();

  if (!raw) {
    return DEFAULT_CHAT_DAILY_LIMIT;
  }

  if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
    console.warn(
      `Ignoring invalid CHAT_DAILY_LIMIT; using the default of ${DEFAULT_CHAT_DAILY_LIMIT}.`
    );
    return DEFAULT_CHAT_DAILY_LIMIT;
  }

  return Number(raw);
}

/**
 * Each chat request can cost up to four upstream LLM calls, so the endpoint
 * is limited per client and capped per day to stay inside the providers'
 * free quotas. Exported so tests can reset it.
 */
export const chatRateLimiter = createRateLimiter({
  perIpLimit: 10,
  windowMs: 60_000,
  dailyCap: chatDailyLimitFromEnv(),
});

const router = Router();

router.post("/", chatRateLimiter, postChat);

export default router;
