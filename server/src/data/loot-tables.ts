// SERVER-ONLY loot tables. These drop odds must never be shipped to the client
// or placed in shared/ (CLAUDE.md §1). The client only ever sees the *result*
// of a roll (OP_GATHER_RESULT), never the probabilities.
//
// An entry with itemId "" represents a "miss" (e.g. the line came up empty).

import type { LootEntry } from "../systems/loot-roller";

export const LOOT_TABLES: Record<string, LootEntry[]> = {
  fishing_basic: [
    { itemId: "", weight: 25, quantity: 0 }, // got away
    { itemId: "cloudfin_minnow", weight: 50, quantity: 1 },
    { itemId: "skywhiskered_carp", weight: 20, quantity: 1 },
    { itemId: "aurora_koi", weight: 5, quantity: 1 }, // rare
  ],
  berries_basic: [
    { itemId: "sky_berry", weight: 80, quantity: 3 },
    { itemId: "golden_sky_berry", weight: 20, quantity: 1 },
  ],
};
