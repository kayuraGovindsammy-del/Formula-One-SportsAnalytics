import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  release: vi.fn(),
  connect: vi.fn(),
  deleteUser: vi.fn(),
  markerSet: vi.fn(),
  profileSet: vi.fn(),
  profileDelete: vi.fn(),
}));

vi.mock("../config/database.js", () => ({
  getPool: () => ({
    connect: mocks.connect,
    query: mocks.query,
  }),
}));

vi.mock("../config/firebaseAdmin.js", () => ({
  getAdminAuth: () => ({ deleteUser: mocks.deleteUser }),
  getAdminDb: () => ({
    collection: (name: string) => ({
      doc: () => name === "accountDeletions"
        ? { set: mocks.markerSet }
        : { set: mocks.profileSet, delete: mocks.profileDelete },
    }),
  }),
}));

import {
  completeAccountDeletion,
  deletionRequested,
  requestAccountDeletion,
  retryPendingDeletions,
} from "./accountDeletion.js";

describe("account deletion", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.connect.mockResolvedValue({
      query: mocks.query,
      release: mocks.release,
    });
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT completed_at")) {
        return { rows: [{ completed_at: null }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });
    mocks.markerSet.mockResolvedValue(undefined);
    mocks.profileSet.mockResolvedValue(undefined);
    mocks.profileDelete.mockResolvedValue(undefined);
    mocks.deleteUser.mockResolvedValue(undefined);
  });

  it("records a durable request before deleting Firebase identity", async () => {
    expect(await requestAccountDeletion("uid-1")).toBe(true);
    const calls = mocks.query.mock.calls.map(([sql]) => String(sql));
    expect(calls.some(sql => sql.includes("INSERT INTO account_deletions"))).toBe(true);
    expect(mocks.deleteUser).toHaveBeenCalledWith("uid-1");
    expect(mocks.markerSet).toHaveBeenCalledWith({ deleted: true }, { merge: true });
    expect(mocks.profileDelete).toHaveBeenCalled();
    expect(calls.some(sql => sql.includes("UPDATE users") && sql.includes("display_name"))).toBe(true);
    expect(calls.some(sql => sql.includes("completed_at = NOW()"))).toBe(true);
  });

  it("does not delete a user without a durable request", async () => {
    mocks.query.mockImplementation(async (sql: string) =>
      sql.includes("SELECT completed_at")
        ? { rows: [], rowCount: 0 }
        : { rows: [], rowCount: 1 }
    );
    await expect(completeAccountDeletion("missing")).rejects.toMatchObject({
      httpStatus: 404,
    });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("does not repeat external deletion for completed requests", async () => {
    mocks.query.mockImplementation(async (sql: string) =>
      sql.includes("SELECT completed_at")
        ? { rows: [{ completed_at: new Date() }], rowCount: 1 }
        : { rows: [], rowCount: 1 }
    );
    expect(await completeAccountDeletion("uid-1")).toBe(true);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("rolls back and leaves cleanup pending if Firebase fails", async () => {
    mocks.deleteUser.mockRejectedValueOnce(new Error("Temporary outage"));
    expect(await completeAccountDeletion("uid-1")).toBe(false);
    const calls = mocks.query.mock.calls.map(([sql]) => String(sql));
    expect(calls).toContain("ROLLBACK");
    expect(calls.some(sql => sql.includes("UPDATE users"))).toBe(false);
    expect(mocks.markerSet).toHaveBeenCalled();
  });

  it("treats an already deleted Firebase user as an idempotent success", async () => {
    mocks.deleteUser.mockRejectedValueOnce({ code: "auth/user-not-found" });
    expect(await completeAccountDeletion("uid-1")).toBe(true);
    expect(mocks.profileDelete).toHaveBeenCalled();
  });

  it("checks tombstones and retries pending requests", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ auth_uid: "uid-1" }], rowCount: 1 });
    expect(await deletionRequested("uid-1")).toBe(true);
    mocks.query.mockResolvedValueOnce({ rows: [{ auth_uid: "uid-1" }], rowCount: 1 });
    await retryPendingDeletions();
    expect(mocks.deleteUser).toHaveBeenCalledWith("uid-1");
  });
});
