// RPC: return the CALLER's inventory. ctx.userId is the authenticated user, so a
// client can only ever read its own inventory, never someone else's.

import { readInventory } from "../persistence/inventory-store";

export const rpcGetInventory: nkruntime.RpcFunction = function (ctx, _logger, nk) {
  const inventory = readInventory(nk, ctx.userId);
  return JSON.stringify({ items: inventory });
};
