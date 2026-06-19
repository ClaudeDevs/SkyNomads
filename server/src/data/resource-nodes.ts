// Authoritative resource-node placements for the sky islands. The server owns
// these; clients learn about them via OP_NODES_SNAPSHOT on join (so the client
// never has to be trusted about where harvestable nodes are).
//
// Positions are screen-space pixels for now (Phase 1/2 movement is screen-space;
// a future pass can move these onto iso grid coordinates).

export interface ResourceNodeDef {
  id: string;
  type: "fishing" | "foraging";
  x: number;
  y: number;
  gatherDurationMs: number; // how long a successful gather takes
  respawnMs: number; // cooldown after a gather before the node is usable again
  lootTableId: string; // key into LOOT_TABLES (server-only odds)
}

export const RESOURCE_NODES: Record<string, ResourceNodeDef> = {
  fishing_spot_1: {
    id: "fishing_spot_1",
    type: "fishing",
    x: 220,
    y: 140,
    gatherDurationMs: 4000,
    respawnMs: 3000,
    lootTableId: "fishing_basic",
  },
  fishing_spot_2: {
    id: "fishing_spot_2",
    type: "fishing",
    x: 360,
    y: 200,
    gatherDurationMs: 4000,
    respawnMs: 3000,
    lootTableId: "fishing_basic",
  },
  berry_bush_1: {
    id: "berry_bush_1",
    type: "foraging",
    x: 120,
    y: 80,
    gatherDurationMs: 2500,
    respawnMs: 8000,
    lootTableId: "berries_basic",
  },
};
