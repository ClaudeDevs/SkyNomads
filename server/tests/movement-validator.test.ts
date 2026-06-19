import { describe, expect, it } from "vitest";
import { validateMove } from "../src/validation/movement-validator";

const MAX_SPEED = 120; // px/s
const TOLERANCE = 8; // px

describe("validateMove", () => {
  it("accepts a move within the speed budget", () => {
    // 120 px/s * 0.1s = 12px budget (+8 tolerance). Move 10px.
    const result = validateMove({ x: 0, y: 0 }, { x: 10, y: 0 }, 0.1, MAX_SPEED, TOLERANCE);
    expect(result.valid).toBe(true);
    expect(result.position).toEqual({ x: 10, y: 0 });
  });

  it("accepts a zero-distance move", () => {
    const result = validateMove({ x: 5, y: 5 }, { x: 5, y: 5 }, 0.1, MAX_SPEED, TOLERANCE);
    expect(result.valid).toBe(true);
  });

  // --- Reject paths (required by CLAUDE.md §8 checklist) ---

  it("rejects a teleport that exceeds the speed budget", () => {
    // 12px + 8 tolerance = 20px budget; requesting 500px must be rejected.
    const result = validateMove({ x: 0, y: 0 }, { x: 500, y: 0 }, 0.1, MAX_SPEED, TOLERANCE);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("too_fast");
    // Authoritative position must NOT move toward the cheated request.
    expect(result.position).toEqual({ x: 0, y: 0 });
  });

  it("rejects diagonal moves that exceed the budget", () => {
    // distance = sqrt(100^2 + 100^2) ~= 141px, far over a 20px budget.
    const result = validateMove({ x: 0, y: 0 }, { x: 100, y: 100 }, 0.1, MAX_SPEED, TOLERANCE);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("too_fast");
  });

  it("rejects non-finite coordinates from a malformed client", () => {
    const result = validateMove({ x: 0, y: 0 }, { x: Infinity, y: NaN }, 1, MAX_SPEED, TOLERANCE);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("non_finite");
    expect(result.position).toEqual({ x: 0, y: 0 });
  });

  it("treats negative/zero elapsed time as no time budget", () => {
    // Same-tick duplicate: only the tolerance is available.
    const ok = validateMove({ x: 0, y: 0 }, { x: 5, y: 0 }, 0, MAX_SPEED, TOLERANCE);
    expect(ok.valid).toBe(true); // 5px <= 8px tolerance
    const bad = validateMove({ x: 0, y: 0 }, { x: 50, y: 0 }, -1, MAX_SPEED, TOLERANCE);
    expect(bad.valid).toBe(false);
  });
});
