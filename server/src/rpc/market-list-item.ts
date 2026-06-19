// RPC: list an item from the caller's inventory for sale. The server removes the
// item from inventory and creates the listing — atomically from the client's
// point of view (they can't list what they don't own).

import { readInventory, writeInventory } from "../persistence/inventory-store";
import { removeItem } from "../systems/inventory";
import { validateListing, type Listing } from "../validation/market-validator";
import { writeListing } from "../persistence/market-store";

export const rpcMarketListItem: nkruntime.RpcFunction = function (ctx, _logger, nk, payload) {
  const seller = ctx.userId;
  let req: { item_id: string; quantity: number; price: number };
  try {
    req = JSON.parse(payload);
  } catch (_e) {
    return JSON.stringify({ ok: false, reason: "bad_request" });
  }

  const inventory = readInventory(nk, seller);
  const check = validateListing(inventory, req.item_id, req.quantity, req.price);
  if (!check.valid) {
    return JSON.stringify({ ok: false, reason: check.reason });
  }

  const removed = removeItem(inventory, req.item_id, req.quantity);
  writeInventory(nk, seller, removed.inventory);

  const listing: Listing = {
    listingId: nk.uuidv4(),
    sellerId: seller,
    itemId: req.item_id,
    quantity: req.quantity,
    price: req.price,
  };
  writeListing(nk, listing);

  return JSON.stringify({ ok: true, listing_id: listing.listingId });
};
