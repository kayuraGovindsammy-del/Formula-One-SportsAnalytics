import { z } from "zod";

import { ApiError } from "../middleware/ApiError.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

import type { AuthenticatedRequest } from "../middleware/authenticate.js";

import * as submissionsModel from "../models/submissions.model.js";

const eventTypeSchema = z.enum([
  "SESSION_START",
  "SESSION_END",
  "LAP_COMPLETED",
  "PIT_STOP",
  "POSITION_CHANGE",
  "PENALTY_ISSUED",
  "RETIREMENT",
  "FASTEST_LAP_SET",
]);

const submissionSchema = z.object({
  event: z.object({
    event_id: z.string().trim().min(1),
    session_id: z.string().trim().min(1),
    driver_id: z.string().trim().min(1).optional(),
    type: eventTypeSchema,
    lap_number: z.number().int().positive().optional(),
    timestamp: z.string().datetime(),
    payload: z.record(z.string(), z.unknown()),
  }),
});

const reviewSchema = z.object({
  status: z.enum(["accepted", "rejected"]),
  validation_errors: z
    .array(z.string().trim().min(1))
    .default([]),
});

function getAuthenticatedRequest(
  req: Parameters<
    Parameters<typeof asyncHandler>[0]
  >[0]
): AuthenticatedRequest {
  return req as AuthenticatedRequest;
}

function submissionIdFromParam(
  value: string | string[] | undefined
): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number(raw);

  if (!Number.isInteger(id) || id <= 0) {
    throw ApiError.validationError(
      "submission_id must be a positive integer."
    );
  }

  return id;
}

function toApiRecord(
  submission: Awaited<
    ReturnType<typeof submissionsModel.findById>
  > extends infer T
    ? Exclude<T, null>
    : never
) {
  return {
    submission_id: submission.submission_id,
    submitted_by: submission.submitted_by,
    submitted_by_email: submission.submitted_by_email,
    submitted_at: submission.submitted_at,
    status: submission.status.toLowerCase(),
    validation_errors: submission.validation_message
      ? [submission.validation_message]
      : [],
    event: submission.event_data,
  };
}

/** POST /api/v1/submissions */
export const createSubmission = asyncHandler(
  async (req, res) => {
    const authReq = getAuthenticatedRequest(req);

    const parsed = submissionSchema.safeParse(req.body);

    if (!parsed.success) {
      throw ApiError.validationError(
        parsed.error.issues
          .map(
            (issue) =>
              `${issue.path.join(".")}: ${issue.message}`
          )
          .join("; ")
      );
    }

    const submission = await submissionsModel.create(
      authReq.authenticatedUser!,
      parsed.data.event
    );

    res.status(201).json({
      data: toApiRecord(submission),
      meta: {},
    });
  }
);

/** GET /api/v1/submissions */
export const listSubmissions = asyncHandler(
  async (req, res) => {
    const authReq = getAuthenticatedRequest(req);
    const user = authReq.authenticatedUser!;

    const submissions = await submissionsModel.findAll();

    const visible =
      user.role === "ADMIN"
        ? submissions
        : submissions.filter(
            (submission) =>
              submission.submitted_by === user.uid
          );

    res.status(200).json({
      data: visible.map(toApiRecord),
      meta: {},
    });
  }
);

/** GET /api/v1/submissions/:submission_id */
export const getSubmission = asyncHandler(
  async (req, res) => {
    const authReq = getAuthenticatedRequest(req);

    const submissionId = submissionIdFromParam(
      req.params.submission_id
    );

    const submission =
      await submissionsModel.findById(submissionId);

    if (!submission) {
      throw ApiError.notFound(
        "Submission was not found."
      );
    }

    const user = authReq.authenticatedUser!;

    if (
      user.role !== "ADMIN" &&
      submission.submitted_by !== user.uid
    ) {
      throw ApiError.forbidden(
        "You cannot access this submission."
      );
    }

    res.status(200).json({
      data: toApiRecord(submission),
      meta: {},
    });
  }
);

/** PATCH /api/v1/submissions/:submission_id */
export const reviewSubmission = asyncHandler(
  async (req, res) => {
    const authReq = getAuthenticatedRequest(req);

    const submissionId = submissionIdFromParam(
      req.params.submission_id
    );

    const parsed = reviewSchema.safeParse(req.body);

    if (!parsed.success) {
      throw ApiError.validationError(
        parsed.error.issues
          .map(
            (issue) =>
              `${issue.path.join(".")}: ${issue.message}`
          )
          .join("; ")
      );
    }

    if (
      parsed.data.status === "rejected" &&
      parsed.data.validation_errors.length === 0
    ) {
      throw ApiError.validationError(
        "A rejection reason is required."
      );
    }

    const updated = await submissionsModel.review(
      submissionId,
      authReq.authenticatedUser!,
      parsed.data.status === "accepted"
        ? "ACCEPTED"
        : "REJECTED",
      parsed.data.validation_errors[0] ?? null
    );

    if (!updated) {
      const existing =
        await submissionsModel.findById(submissionId);

      if (!existing) {
        throw ApiError.notFound(
          "Submission was not found."
        );
      }

      throw ApiError.conflict(
        "SUBMISSION_ALREADY_REVIEWED",
        "This submission has already been reviewed."
      );
    }

    res.status(200).json({
      data: toApiRecord(updated),
      meta: {},
    });
  }
);