// Read/write a player's inventory in Nakama storage. The server owns this data:
// permissionWrite is 0 so a client can NEVER modify its own inventory directly
// (CLAUDE.md §1). The client only ever reads it (via the get_inventory RPC) or
// receives gather results.

import type { Inventory } from "../systems/inventory";

const COLLECTION = "inventory";
const KEY = "items";

export function readInventory(nk: nkruntime.Nakama, userId: string): Inventory {
  const objects = nk.storageRead([{ collection: COLLECTION, key: KEY, userId }]);
  if (objects.length > 0) {
    return objects[0].value as Inventory;
  }
  return {};
}

export function writeInventory(nk: nkruntime.Nakama, userId: string, inventory: Inventory): void {
  nk.storageWrite([
    {
      collection: COLLECTION,
      key: KEY,
      userId,
      value: inventory,
      permissionRead: 1, // owner can read
      permissionWrite: 0, // server-only writes
    },
  ]);
}
