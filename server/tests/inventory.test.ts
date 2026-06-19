import { describe, expect, it } from "vitest";
import { addItem } from "../src/systems/inventory";

describe("addItem", () => {
  it("adds a new item", () => {
    expect(addItem({}, "cloudfin_minnow", 1)).toEqual({ cloudfin_minnow: 1 });
  });

  it("stacks onto an existing item", () => {
    expect(addItem({ sky_berry: 3 }, "sky_berry", 2)).toEqual({ sky_berry: 5 });
  });

  it("does not mutate the input inventory", () => {
    const original = { sky_berry: 3 };
    addItem(original, "sky_berry", 2);
    expect(original).toEqual({ sky_berry: 3 });
  });

  it("ignores empty item ids (a miss)", () => {
    expect(addItem({ sky_berry: 1 }, "", 0)).toEqual({ sky_berry: 1 });
  });

  it("ignores non-positive quantities", () => {
    expect(addItem({}, "aurora_koi", 0)).toEqual({});
    expect(addItem({}, "aurora_koi", -5)).toEqual({});
  });
});
