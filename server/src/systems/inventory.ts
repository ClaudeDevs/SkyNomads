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

/** How many of `itemId` the inventory holds. */
export function itemCount(inventory: Inventory, itemId: string): number {
  return inventory[itemId] ?? 0;
}

export interface RemoveResult {
  ok: boolean;
  inventory: Inventory;
}

/**
 * Return a new inventory with `quantity` of `itemId` removed. `ok` is false
 * (and the inventory unchanged) if there aren't enough — the server uses this
 * to reject listing items you don't own.
 */
export function removeItem(inventory: Inventory, itemId: string, quantity: number): RemoveResult {
  if (quantity <= 0 || itemCount(inventory, itemId) < quantity) {
    return { ok: false, inventory };
  }
  const next: Inventory = { ...inventory };
  const remaining = next[itemId] - quantity;
  if (remaining > 0) {
    next[itemId] = remaining;
  } else {
    delete next[itemId];
  }
  return { ok: true, inventory: next };
}
