import { describe, expect, it } from "vitest";
import { rollLoot, type LootEntry } from "../src/systems/loot-roller";

// Total weight 100: miss[0,25) carp[25,75) koi[75,100)
const table: LootEntry[] = [
  { itemId: "", weight: 25, quantity: 0 },
  { itemId: "carp", weight: 50, quantity: 1 },
  { itemId: "koi", weight: 25, quantity: 2 },
];

describe("rollLoot", () => {
  it("returns a miss for an empty table", () => {
    expect(rollLoot([], 0.5)).toEqual({ success: false, itemId: "", quantity: 0 });
  });

  it("maps the bottom of the range to the first entry (a miss)", () => {
    expect(rollLoot(table, 0)).toEqual({ success: false, itemId: "", quantity: 0 });
  });

  it("selects the middle entry within its weight band", () => {
    // roll 0.5 -> 50/100 -> falls in carp band [25,75)
    expect(rollLoot(table, 0.5)).toEqual({ success: true, itemId: "carp", quantity: 1 });
  });

  it("selects the last entry near the top of the range", () => {
    // roll 0.9 -> 90/100 -> koi band [75,100)
    expect(rollLoot(table, 0.9)).toEqual({ success: true, itemId: "koi", quantity: 2 });
  });

  it("respects band boundaries", () => {
    // Just below 0.25 is still a miss; at 0.25 it becomes carp.
    expect(rollLoot(table, 0.24).success).toBe(false);
    expect(rollLoot(table, 0.25)).toEqual({ success: true, itemId: "carp", quantity: 1 });
  });

  it("clamps an out-of-range roll to the last entry", () => {
    expect(rollLoot(table, 1.0)).toEqual({ success: true, itemId: "koi", quantity: 2 });
  });
});
