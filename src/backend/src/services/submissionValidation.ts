import { z } from "zod";

const id = (max: number) => z.string().trim().min(1).max(max)
  .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, underscores or hyphens.");
const positive = z.number().int().positive().max(1000000);
const milliseconds = z.number().int().positive().max(86400000);
const reason = z.string().trim().min(1).max(2000);
const timestamp = z.iso.datetime({ offset: true });

const common = {
  event_id: id(128),
  session_id: id(70),
  timestamp,
};
const driver = { ...common, driver_id: id(10) };
const lap = { ...driver, lap_number: positive };

const boundary = (type: "SESSION_START" | "SESSION_END") =>
  z.strictObject({ ...common, type: z.literal(type), payload: z.strictObject({}) });

const lapCompleted = z.strictObject({
  ...lap, type: z.literal("LAP_COMPLETED"),
  payload: z.strictObject({
    lap_time_ms: milliseconds.nullable(),
    position: positive.nullable(),
    is_pit_lap: z.boolean(),
    is_valid: z.boolean(),
  }),
});
const pitStop = z.strictObject({
  ...lap, type: z.literal("PIT_STOP"),
  payload: z.strictObject({
    duration_ms: milliseconds,
    tyre_in: z.enum(["soft", "medium", "hard", "intermediate", "wet"]).optional(),
    tyre_out: z.enum(["soft", "medium", "hard", "intermediate", "wet"]).optional(),
  }),
});
const positionChange = z.strictObject({
  ...lap, type: z.literal("POSITION_CHANGE"),
  payload: z.strictObject({
    overtaken_driver_id: id(10),
    position_before: positive,
    position_after: positive,
  }),
}).superRefine((event, ctx) => {
  if (event.driver_id === event.payload.overtaken_driver_id)
    ctx.addIssue({ code: "custom", path: ["payload", "overtaken_driver_id"], message: "A driver cannot overtake themselves." });
  if (event.payload.position_before === event.payload.position_after)
    ctx.addIssue({ code: "custom", path: ["payload", "position_after"], message: "Position must change." });
});
const penalty = z.strictObject({
  ...driver, type: z.literal("PENALTY_ISSUED"),
  lap_number: positive.optional(),
  payload: z.strictObject({
    penalty_type: z.enum(["TIME", "GRID_DROP", "DISQUALIFICATION"]),
    duration_ms: milliseconds.nullable(),
    reason,
  }).superRefine((value, ctx) => {
    if (value.penalty_type === "TIME" && value.duration_ms === null)
      ctx.addIssue({ code: "custom", path: ["duration_ms"], message: "A time penalty requires a duration." });
    if (value.penalty_type !== "TIME" && value.duration_ms !== null)
      ctx.addIssue({ code: "custom", path: ["duration_ms"], message: "Only time penalties have a duration." });
  }),
});
const retirement = z.strictObject({
  ...driver, type: z.literal("RETIREMENT"),
  lap_number: z.number().int().min(0).max(1000000).optional(),
  payload: z.strictObject({ reason }),
});
const fastest = z.strictObject({
  ...lap, type: z.literal("FASTEST_LAP_SET"),
  payload: z.strictObject({ lap_time_ms: milliseconds }),
});

export const submissionEventSchema = z.union([
  boundary("SESSION_START"), boundary("SESSION_END"), lapCompleted, pitStop,
  positionChange, penalty, retirement, fastest,
]);
export const submissionSchema = z.strictObject({ event: submissionEventSchema });
export type ValidatedEvent = z.infer<typeof submissionEventSchema>;

export function parseSubmissionEvent(value: unknown): ValidatedEvent {
  return submissionEventSchema.parse(value);
}

export function validationMessage(error: z.ZodError): string {
  return error.issues.map(issue =>
    `${issue.path.join(".") || "event"}: ${issue.message}`
  ).join("; ");
}
