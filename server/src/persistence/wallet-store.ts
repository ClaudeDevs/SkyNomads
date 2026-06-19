// Read/write a player's coin balance in Nakama storage. Server-only writes
// (permissionWrite 0): a client can never set its own balance (CLAUDE.md §1).

import { STARTER_COINS } from "../systems/wallet";

const COLLECTION = "wallet";
const KEY = "balance";

export function readBalance(nk: nkruntime.Nakama, userId: string): number {
  const objects = nk.storageRead([{ collection: COLLECTION, key: KEY, userId }]);
  if (objects.length > 0) {
    const value = objects[0].value as { coins?: number };
    return typeof value.coins === "number" ? value.coins : STARTER_COINS;
  }
  return STARTER_COINS; // new players start with a stipend
}

export function writeBalance(nk: nkruntime.Nakama, userId: string, coins: number): void {
  nk.storageWrite([
    {
      collection: COLLECTION,
      key: KEY,
      userId,
      value: { coins },
      permissionRead: 1,
      permissionWrite: 0,
    },
  ]);
}
