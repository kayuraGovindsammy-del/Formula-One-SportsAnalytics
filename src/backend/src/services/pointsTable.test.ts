import { describe, expect, it } from "vitest";
import { pointsForPosition } from "./pointsTable.js";

// Every expected value below is the literal standard F1 race scale, not
// derived by any logic shared with the function under test.

describe("pointsForPosition", () => {
  it("returns the standard race scale for P1 through P10", () => {
    const scale = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

    scale.forEach((points, index) => {
      expect(pointsForPosition(index + 1)).toBe(points);
    });
  });

  it("returns 0 for P11 and lower", () => {
    expect(pointsForPosition(11)).toBe(0);
    expect(pointsForPosition(20)).toBe(0);
  });

  it("returns 0 for a null position", () => {
    expect(pointsForPosition(null)).toBe(0);
  });

  it("returns 0 for a non-positive position", () => {
    expect(pointsForPosition(0)).toBe(0);
    expect(pointsForPosition(-1)).toBe(0);
  });
});
