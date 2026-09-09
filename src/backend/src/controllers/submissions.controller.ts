import { z } from "zod";
import { ApiError } from "../middleware/ApiError.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import type { AuthenticatedRequest } from "../middleware/authenticate.js";
import * as submissionsModel from "../models/submissions.model.js";
import { submissionSchema, validationMessage } from "../services/submissionValidation.js";
import type { SubmissionRecord, SubmissionStatus } from "../types/submission.types.js";

const reviewSchema = z.strictObject({
  status: z.enum(["accepted", "rejected"]),
  validation_errors: z.array(z.string().trim().min(1).max(2000)).max(1).default([]),
});
const listSchema = z.strictObject({
  status: z.enum(["pending", "accepted", "rejected"]).optional(),
});

function auth(req: unknown): AuthenticatedRequest {
  return req as AuthenticatedRequest;
}

function submissionIdFromParam(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number(raw);
  if (!raw || !/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(id))
    throw ApiError.validationError("submission_id must be a positive integer.");
  return id;
}

function toApiRecord(record: SubmissionRecord, viewer: AuthenticatedRequest["authenticatedUser"]) {
  const canSeeIdentity = viewer?.role === "ADMIN" || viewer?.uid === record.submitted_by;
  return {
    submission_id: record.submission_id,
    submitted_by: canSeeIdentity ? record.submitted_by : null,
    submitted_by_email: canSeeIdentity ? record.submitted_by_email : null,
    submitted_at: record.submitted_at,
    reviewed_at: record.reviewed_at,
    reviewed_by: viewer?.role === "ADMIN" ? record.reviewed_by_uid : null,
    reviewed_by_email: viewer?.role === "ADMIN" ? record.reviewed_by_email : null,
    status: record.status.toLowerCase(),
    validation_errors: record.validation_message ? [record.validation_message] : [],
    event: record.event_data,
  };
}

function parseStatus(query: unknown): SubmissionStatus | undefined {
  const parsed = listSchema.safeParse(query);
  if (!parsed.success) throw ApiError.validationError(validationMessage(parsed.error));
  return parsed.data.status?.toUpperCase() as SubmissionStatus | undefined;
}

/** POST /api/v1/submissions */
export const createSubmission = asyncHandler(async (req, res) => {
  const parsed = submissionSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.validationError(validationMessage(parsed.error));
  const user = auth(req).authenticatedUser!;
  const record = await submissionsModel.create(user, parsed.data.event);
  res.status(201).json({ data: toApiRecord(record, user), meta: {} });
});

/** GET /api/v1/submissions: admin queue, or the caller's own records. */
export const listSubmissions = asyncHandler(async (req, res) => {
  const user = auth(req).authenticatedUser!;
  const status = parseStatus(req.query);
  const records = await submissionsModel.findAll(user.role === "ADMIN" ? undefined : user.uid, status);
  res.status(200).json({ data: records.map(row => toApiRecord(row, user)), meta: {} });
});

/** GET /api/v1/submissions/mine: history remains available after role revocation. */
export const listMySubmissions = asyncHandler(async (req, res) => {
  const user = auth(req).authenticatedUser!;
  const records = await submissionsModel.findAll(user.uid, parseStatus(req.query));
  res.status(200).json({ data: records.map(row => toApiRecord(row, user)), meta: {} });
});

/** GET /api/v1/submissions/:submission_id */
export const getSubmission = asyncHandler(async (req, res) => {
  const user = auth(req).authenticatedUser!;
  const id = submissionIdFromParam(req.params.submission_id);
  const record = await submissionsModel.findById(id);
  if (!record) throw ApiError.notFound("Submission was not found.");
  if (user.role !== "ADMIN" && record.submitted_by !== user.uid)
    throw ApiError.forbidden("You cannot access this submission.");
  res.status(200).json({ data: toApiRecord(record, user), meta: {} });
});

/** PATCH /api/v1/submissions/:submission_id */
export const reviewSubmission = asyncHandler(async (req, res) => {
  const user = auth(req).authenticatedUser!;
  if (user.role !== "ADMIN") throw ApiError.forbidden("Administrator access required.");
  const id = submissionIdFromParam(req.params.submission_id);
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.validationError(validationMessage(parsed.error));
  if (parsed.data.status === "rejected" && parsed.data.validation_errors.length === 0)
    throw ApiError.validationError("A rejection reason is required.");
  if (parsed.data.status === "accepted" && parsed.data.validation_errors.length)
    throw ApiError.validationError("Accepted submissions cannot have rejection reasons.");
  const record = await submissionsModel.review(
    id, user, parsed.data.status.toUpperCase() as SubmissionStatus,
    parsed.data.validation_errors[0] ?? null
  );
  if (!record) throw ApiError.notFound("Submission was not found.");
  res.status(200).json({ data: toApiRecord(record, user), meta: {} });
});
