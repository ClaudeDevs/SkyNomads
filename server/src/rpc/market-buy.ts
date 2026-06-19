// RPC: buy a listing. The server validates funds and ownership, then performs
// the transfer. The listing is deleted with a version assertion FIRST, so if two
// buyers race, only one wins (the other's delete throws and is rejected) — no
// double-spend, no duplicated item.

import { readBalance, writeBalance } from "../persistence/wallet-store";
import { readInventory, writeInventory } from "../persistence/inventory-store";
import { addItem } from "../systems/inventory";
import { addCoins, subCoins } from "../systems/wallet";
import { validatePurchase } from "../validation/market-validator";
import { deleteListing, readListing } from "../persistence/market-store";

export const rpcMarketBuy: nkruntime.RpcFunction = function (ctx, logger, nk, payload) {
  const buyer = ctx.userId;
  let req: { listing_id: string };
  try {
    req = JSON.parse(payload);
  } catch (_e) {
    return JSON.stringify({ ok: false, reason: "bad_request" });
  }

  const stored = readListing(nk, req.listing_id);
  if (stored === null) {
    return JSON.stringify({ ok: false, reason: "not_found" });
  }
  const listing = stored.listing;

  const buyerCoins = readBalance(nk, buyer);
  const check = validatePurchase(buyer, buyerCoins, listing);
  if (!check.valid) {
    return JSON.stringify({ ok: false, reason: check.reason });
  }

  // Claim the listing first (version assertion). If this throws, someone else
  // already took it.
  try {
    deleteListing(nk, listing.listingId, stored.version);
  } catch (_e) {
    return JSON.stringify({ ok: false, reason: "unavailable" });
  }

  // Transfer coins and the item.
  writeBalance(nk, buyer, subCoins(buyerCoins, listing.price));
  writeBalance(nk, listing.sellerId, addCoins(readBalance(nk, listing.sellerId), listing.price));
  writeInventory(nk, buyer, addItem(readInventory(nk, buyer), listing.itemId, listing.quantity));

  logger.info("%s bought %s x%d from %s for %d", buyer, listing.itemId, listing.quantity, listing.sellerId, listing.price);
  return JSON.stringify({
    ok: true,
    item_id: listing.itemId,
    quantity: listing.quantity,
    price: listing.price,
  });
};
