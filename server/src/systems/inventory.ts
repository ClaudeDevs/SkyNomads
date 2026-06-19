// Pure inventory helpers. An inventory is a simple itemId -> quantity map.
// No Nakama imports — unit-testable. Persistence lives in persistence/, this is
// just the (server-authoritative) mutation logic.

export type Inventory = { [itemId: string]: number };

/**
 * Return a new inventory with `quantity` of `itemId` added. Ignores empty ids
 * and non-positive quantities (a miss should never reach here, but be safe).
 */
export function addItem(inventory: Inventory, itemId: string, quantity: number): Inventory {
  if (itemId === "" || quantity <= 0) {
    return inventory;
  }
  const next: Inventory = { ...inventory };
  next[itemId] = (next[itemId] ?? 0) + quantity;
  return next;
}
