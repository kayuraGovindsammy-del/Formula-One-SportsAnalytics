import { z } from "zod";
import { runAssistant } from "../chat/assistant.js";
import { createLlmClientFromEnv, LlmUnavailableError } from "../chat/llmClient.js";
import { ApiError } from "../middleware/ApiError.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const chatBody = z.strictObject({
  messages: z
    .array(
      z.strictObject({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(1000),
      })
    )
    .min(1)
    .max(10)
    .refine((messages) => messages.at(-1)?.role === "user", {
      message: "The last message must be from the user.",
    }),
});

function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
    .join("; ");
}

/** POST /api/v1/chat — the F1 assistant. Answers only from our own data. */
export const postChat = asyncHandler(async (req, res) => {
  const parsed = chatBody.safeParse(req.body);
  if (!parsed.success) {
    throw ApiError.validationError(describeIssues(parsed.error));
  }

  const client = createLlmClientFromEnv();
  if (!client.isConfigured) {
    throw ApiError.serviceUnavailable("The chat assistant is not configured.");
  }

  // Export links in replies point back at this server.
  const apiBaseUrl = `${req.protocol}://${req.get("host") ?? "localhost"}/api/v1`;

  const started = Date.now();
  try {
    const answer = await runAssistant(client, parsed.data.messages, { apiBaseUrl });

    // Server-side only: which provider answered, how many tool rounds it took
    // and how long. Never the messages, the reply or any key.
    console.info(
      `chat answered provider=${answer.provider} tool_rounds=${answer.tool_rounds} duration_ms=${Date.now() - started}`
    );

    res.status(200).json({
      data: { reply: answer.reply, tools_used: answer.tools_used },
      meta: {},
    });
  } catch (error) {
    if (error instanceof LlmUnavailableError) {
      console.warn(`chat failed: no provider answered duration_ms=${Date.now() - started}`);
      throw ApiError.badGateway(
        "The chat assistant is temporarily unavailable. Please try again later."
      );
    }
    throw error;
  }
});
