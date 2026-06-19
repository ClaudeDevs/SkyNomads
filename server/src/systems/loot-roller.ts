// Pure weighted loot roller. The randomness is *injected* (a roll in [0,1)) so
// the function is deterministic and unit-testable; the caller supplies the RNG.
// This is where "what did I catch?" is decided — server-side, always.

export interface LootEntry {
  itemId: string; // "" means a miss (nothing caught)
  weight: number; // relative probability
  quantity: number;
}

export interface LootDrop {
  success: boolean; // false for a miss / empty table
  itemId: string;
  quantity: number;
}

const MISS: LootDrop = { success: false, itemId: "", quantity: 0 };

/**
 * Select an entry from a weighted table.
 * @param roll a number in [0, 1) — inject Math.random() (or nk RNG) at the call site.
 */
export function rollLoot(table: LootEntry[], roll: number): LootDrop {
  const total = table.reduce((sum, e) => sum + Math.max(e.weight, 0), 0);
  if (total <= 0) {
    return MISS;
  }

  const clamped = Math.min(Math.max(roll, 0), 0.9999999);
  let cursor = clamped * total;

  for (const entry of table) {
    cursor -= Math.max(entry.weight, 0);
    if (cursor < 0) {
      return entry.itemId === ""
        ? MISS
        : { success: true, itemId: entry.itemId, quantity: entry.quantity };
    }
  }

  // Floating-point fallthrough: treat as the last entry.
  const last = table[table.length - 1];
  return last.itemId === ""
    ? MISS
    : { success: true, itemId: last.itemId, quantity: last.quantity };
}
