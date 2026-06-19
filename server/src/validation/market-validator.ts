// Pure marketplace validators. No Nakama imports — unit-testable. These are the
// authority gates: a client can request anything, but a listing or purchase only
// happens if these pass against server-held state.

import { itemCount, type Inventory } from "../systems/inventory";
import { canAfford } from "../systems/wallet";

export interface Listing {
  listingId: string;
  sellerId: string;
  itemId: string;
  quantity: number;
  price: number;
}

export type ListReason = "bad_quantity" | "bad_price" | "not_enough_items";
export type BuyReason = "own_listing" | "insufficient_funds";

export interface ValidationResult<R> {
  valid: boolean;
  reason?: R;
}

/** Can `seller` list `quantity` of `itemId` at `price`? */
export function validateListing(
  inventory: Inventory,
  itemId: string,
  quantity: number,
  price: number,
): ValidationResult<ListReason> {
  if (!Number.isInteger(quantity) || quantity <= 0 || itemId === "") {
    return { valid: false, reason: "bad_quantity" };
  }
  if (!Number.isInteger(price) || price < 0) {
    return { valid: false, reason: "bad_price" };
  }
  if (itemCount(inventory, itemId) < quantity) {
    return { valid: false, reason: "not_enough_items" };
  }
  return { valid: true };
}

/** Can `buyerId` (with `buyerCoins`) buy `listing`? */
export function validatePurchase(
  buyerId: string,
  buyerCoins: number,
  listing: Listing,
): ValidationResult<BuyReason> {
  if (buyerId === listing.sellerId) {
    return { valid: false, reason: "own_listing" };
  }
  if (!canAfford(buyerCoins, listing.price)) {
    return { valid: false, reason: "insufficient_funds" };
  }
  return { valid: true };
}
