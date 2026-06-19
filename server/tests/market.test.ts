import { describe, expect, it } from "vitest";
import { itemCount, removeItem } from "../src/systems/inventory";
import { addCoins, canAfford, subCoins } from "../src/systems/wallet";
import {
  validateListing,
  validatePurchase,
  type Listing,
} from "../src/validation/market-validator";

describe("removeItem", () => {
  it("removes some, keeping the rest", () => {
    expect(removeItem({ carp: 5 }, "carp", 2)).toEqual({ ok: true, inventory: { carp: 3 } });
  });

  it("deletes the key when the stack hits zero", () => {
    expect(removeItem({ carp: 2 }, "carp", 2)).toEqual({ ok: true, inventory: {} });
  });

  it("fails (and leaves inventory unchanged) when there aren't enough", () => {
    const inv = { carp: 1 };
    const res = removeItem(inv, "carp", 2);
    expect(res.ok).toBe(false);
    expect(res.inventory).toEqual({ carp: 1 });
  });

  it("does not mutate the input", () => {
    const inv = { carp: 5 };
    removeItem(inv, "carp", 2);
    expect(inv).toEqual({ carp: 5 });
  });
});

describe("wallet", () => {
  it("adds and subtracts coins", () => {
    expect(addCoins(100, 50)).toBe(150);
    expect(subCoins(100, 30)).toBe(70);
  });

  it("won't go negative", () => {
    expect(canAfford(20, 50)).toBe(false);
    expect(subCoins(20, 50)).toBe(20); // unchanged
  });

  it("ignores non-positive additions", () => {
    expect(addCoins(100, 0)).toBe(100);
    expect(addCoins(100, -10)).toBe(100);
  });
});

describe("validateListing", () => {
  const inv = { carp: 3 };

  it("accepts a valid listing", () => {
    expect(validateListing(inv, "carp", 2, 10).valid).toBe(true);
  });

  it("rejects non-positive / non-integer quantity", () => {
    expect(validateListing(inv, "carp", 0, 10).reason).toBe("bad_quantity");
    expect(validateListing(inv, "carp", 1.5, 10).reason).toBe("bad_quantity");
  });

  it("rejects negative price", () => {
    expect(validateListing(inv, "carp", 1, -5).reason).toBe("bad_price");
  });

  it("rejects listing more than you own", () => {
    expect(validateListing(inv, "carp", 99, 10).reason).toBe("not_enough_items");
  });
});

describe("validatePurchase", () => {
  const listing: Listing = {
    listingId: "l1",
    sellerId: "seller",
    itemId: "carp",
    quantity: 1,
    price: 50,
  };

  it("accepts a funded buyer", () => {
    expect(validatePurchase("buyer", 100, listing).valid).toBe(true);
  });

  it("rejects buying your own listing", () => {
    expect(validatePurchase("seller", 100, listing).reason).toBe("own_listing");
  });

  it("rejects an underfunded buyer", () => {
    expect(validatePurchase("buyer", 10, listing).reason).toBe("insufficient_funds");
  });
});

// guard so itemCount stays exercised/exported
describe("itemCount", () => {
  it("counts items", () => {
    expect(itemCount({ carp: 3 }, "carp")).toBe(3);
    expect(itemCount({}, "carp")).toBe(0);
  });
});
