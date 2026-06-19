import { describe, expect, it } from "vitest";
import { validateGather } from "../src/validation/gather-validator";

const RANGE = 48;
const idle = { x: 0, y: 0, isGathering: false };
const availableNode = { x: 10, y: 10, available: true };

describe("validateGather", () => {
  it("accepts a gather on an available node within range", () => {
    const result = validateGather(idle, availableNode, RANGE);
    expect(result.valid).toBe(true);
  });

  // --- Reject paths (CLAUDE.md §8 checklist) ---

  it("rejects an unknown node", () => {
    const result = validateGather(idle, null, RANGE);
    expect(result).toEqual({ valid: false, reason: "unknown_node" });
  });

  it("rejects when the player is already gathering", () => {
    const result = validateGather({ ...idle, isGathering: true }, availableNode, RANGE);
    expect(result).toEqual({ valid: false, reason: "busy" });
  });

  it("rejects a node that is on cooldown", () => {
    const result = validateGather(idle, { ...availableNode, available: false }, RANGE);
    expect(result).toEqual({ valid: false, reason: "on_cooldown" });
  });

  it("rejects a node out of range", () => {
    const farNode = { x: 500, y: 500, available: true };
    const result = validateGather(idle, farNode, RANGE);
    expect(result).toEqual({ valid: false, reason: "too_far" });
  });

  it("accepts a node exactly at the range boundary", () => {
    const edgeNode = { x: RANGE, y: 0, available: true };
    expect(validateGather(idle, edgeNode, RANGE).valid).toBe(true);
  });
});
