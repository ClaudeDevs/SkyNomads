// Authoritative "world" match handler. Owns every player's true position AND
// the gathering loop: it validates gather requests, times them in ticks, rolls
// loot server-side, and manages node cooldown/respawn (CLAUDE.md §1).

import { OpCode } from "../../contract/opcodes";
import {
  GATHER_RANGE,
  MAX_MOVE_SPEED,
  MOVE_TOLERANCE,
  NET_TICK_RATE,
  SPAWN_X,
  SPAWN_Y,
  WORLD_MATCH_LABEL,
} from "../../contract/constants";
import { validateMove } from "../../validation/movement-validator";
import { validateGather } from "../../validation/gather-validator";
import { rollLoot } from "../../systems/loot-roller";
import { addItem, removeItem } from "../../systems/inventory";
import { readInventory, writeInventory } from "../../persistence/inventory-store";
import { readIsland, writeIsland, PlacedObject } from "../../persistence/island-store";
import { RESOURCE_NODES } from "../../data/resource-nodes";
import { LOOT_TABLES } from "../../data/loot-tables";
import { progressObjective } from "../../persistence/quest-store";

interface GatherProgress {
  nodeId: string;
  completeTick: number;
}

interface PlayerState {
  x: number;
  y: number;
  name: string;
  lastTick: number;
  gather: GatherProgress | null;
}

interface NodeRuntime {
  available: boolean;
  availableAtTick: number; // tick at which an unavailable node respawns
}

interface MatchState {
  owner: string;
  isIsland: boolean;
  placedObjects: PlacedObject[];
  players: { [userId: string]: PlayerState };
  presences: { [userId: string]: nkruntime.Presence };
  nodes: { [nodeId: string]: NodeRuntime };
}

function msToTicks(ms: number): number {
  return Math.max(1, Math.round((ms / 1000) * NET_TICK_RATE));
}

const matchInit: nkruntime.MatchInitFunction<MatchState> = function (_ctx, logger, _nk, params) {
  const type = params.type || "hub";
  const owner = params.owner || "";
  const label = type === "island" ? `type:island,owner:${owner}` : `type:hub`;
  const isIsland = type === "island";

  let placedObjects: PlacedObject[] = [];
  if (isIsland && owner !== "") {
    const islandState = readIsland(_nk, owner);
    placedObjects = islandState.placedObjects;
  }

  const nodes: { [nodeId: string]: NodeRuntime } = {};
  for (const id of Object.keys(RESOURCE_NODES)) {
    nodes[id] = { available: true, availableAtTick: 0 };
  }
  logger.info("Match created. Label: %s, Nodes: %d", label, Object.keys(nodes).length);
  return {
    state: { owner, isIsland, placedObjects, players: {}, presences: {}, nodes },
    tickRate: NET_TICK_RATE,
    label,
  };
};

const matchJoinAttempt: nkruntime.MatchJoinAttemptFunction<MatchState> = function (
  _ctx,
  _logger,
  _nk,
  _dispatcher,
  _tick,
  state,
) {
  return { state, accept: true };
};

const matchJoin: nkruntime.MatchJoinFunction<MatchState> = function (
  _ctx,
  _logger,
  _nk,
  dispatcher,
  tick,
  state,
  presences,
) {
  for (const presence of presences) {
    state.players[presence.userId] = {
      x: SPAWN_X,
      y: SPAWN_Y,
      name: presence.username,
      lastTick: tick,
      gather: null,
    };
    state.presences[presence.userId] = presence;

    dispatcher.broadcastMessage(
      OpCode.PLAYER_JOINED,
      JSON.stringify({ id: presence.userId, x: SPAWN_X, y: SPAWN_Y, name: presence.username }),
    );

    // World snapshot: existing players...
    dispatcher.broadcastMessage(
      OpCode.WORLD_SNAPSHOT,
      JSON.stringify({
        players: Object.keys(state.players).map((id) => ({
          id,
          x: state.players[id].x,
          y: state.players[id].y,
          name: state.players[id].name,
        })),
      }),
      [presence],
    );

    // ...and the resource nodes, with current availability.
    dispatcher.broadcastMessage(
      OpCode.NODES_SNAPSHOT,
      JSON.stringify({
        nodes: Object.keys(RESOURCE_NODES).map((id) => ({
          id,
          type: RESOURCE_NODES[id].type,
          x: RESOURCE_NODES[id].x,
          y: RESOURCE_NODES[id].y,
          available: state.nodes[id].available,
        })),
      }),
      [presence],
    );

    dispatcher.broadcastMessage(
      OpCode.ISLAND_SNAPSHOT,
      JSON.stringify({ placedObjects: state.placedObjects }),
      [presence],
    );
  }
  return { state };
};

const matchLeave: nkruntime.MatchLeaveFunction<MatchState> = function (
  _ctx,
  _logger,
  _nk,
  dispatcher,
  _tick,
  state,
  presences,
) {
  for (const presence of presences) {
    delete state.players[presence.userId];
    delete state.presences[presence.userId];
    dispatcher.broadcastMessage(OpCode.PLAYER_LEFT, JSON.stringify({ id: presence.userId }));
  }
  return { state };
};

const matchLoop: nkruntime.MatchLoopFunction<MatchState> = function (
  _ctx,
  logger,
  nk,
  dispatcher,
  tick,
  state,
  messages,
) {
  for (const message of messages) {
    const player = state.players[message.sender.userId];
    if (!player) {
      continue;
    }

    let payload: any;
    try {
      payload = JSON.parse(nk.binaryToString(message.data));
    } catch (_e) {
      continue; // ignore garbage
    }

    switch (message.opCode) {
      case OpCode.MOVE_REQUEST:
        handleMove(dispatcher, tick, state, message.sender, player, payload);
        break;
      case OpCode.GATHER_REQUEST:
        handleGather(dispatcher, tick, state, message.sender, player, payload);
        break;
      case OpCode.BUILD_REQUEST:
        handleBuild(dispatcher, nk, logger, state, message.sender, player, payload);
        break;
      default:
        break;
    }
  }

  // Resolve gathers whose timer has elapsed, and respawn nodes.
  resolveGathers(dispatcher, nk, logger, tick, state);
  respawnNodes(dispatcher, tick, state);

  return { state };
};

function handleMove(
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: MatchState,
  sender: nkruntime.Presence,
  player: PlayerState,
  payload: { x: number; y: number },
): void {
  const requested = { x: payload.x, y: payload.y };

  // A real move while gathering cancels the gather (and frees the node). Tiny
  // deltas are the client's idle position stream and are ignored.
  if (player.gather) {
    const dx = requested.x - player.x;
    const dy = requested.y - player.y;
    if (Math.sqrt(dx * dx + dy * dy) > MOVE_TOLERANCE) {
      cancelGather(dispatcher, tick, state, sender, player, "moved");
    } else {
      return; // standing still mid-cast; don't move
    }
  }

  const elapsedSeconds = (tick - player.lastTick) / NET_TICK_RATE;
  const result = validateMove(
    { x: player.x, y: player.y },
    requested,
    elapsedSeconds,
    MAX_MOVE_SPEED,
    MOVE_TOLERANCE,
  );

  if (result.valid) {
    player.x = result.position.x;
    player.y = result.position.y;
    player.lastTick = tick;
    dispatcher.broadcastMessage(
      OpCode.MOVE_BROADCAST,
      JSON.stringify({ id: sender.userId, x: player.x, y: player.y }),
    );
  } else {
    dispatcher.broadcastMessage(
      OpCode.MOVE_REJECTED,
      JSON.stringify({ x: player.x, y: player.y }),
      [sender],
    );
  }
}

function handleBuild(
  dispatcher: nkruntime.MatchDispatcher,
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  state: MatchState,
  sender: nkruntime.Presence,
  player: PlayerState,
  payload: { q: number; r: number; item_id: string },
): void {
  // Only the owner can build on their island
  if (!state.isIsland || sender.userId !== state.owner) {
    return;
  }

  // Basic validation
  if (typeof payload.q !== "number" || typeof payload.r !== "number" || !payload.item_id) {
    return;
  }

  // Deduct item from inventory
  const inventory = readInventory(nk, sender.userId);
  const result = removeItem(inventory, payload.item_id, 1);
  if (!result.ok) {
    return; // Don't have the item
  }

  // Check if position is already occupied
  const existing = state.placedObjects.find((obj: PlacedObject) => obj.q === payload.q && obj.r === payload.r);
  if (existing) {
    return; // Already occupied
  }

  writeInventory(nk, sender.userId, result.inventory);

  const newObj = { q: payload.q, r: payload.r, type: payload.item_id };
  state.placedObjects.push(newObj);
  writeIsland(nk, state.owner, { placedObjects: state.placedObjects });
  
  // Hook into the quest system
  progressObjective(nk, sender.userId, "build", payload.item_id, 1);

  dispatcher.broadcastMessage(
    OpCode.BUILD_BROADCAST,
    JSON.stringify(newObj),
  );
  logger.info("%s built %s at %d, %d", sender.userId, payload.item_id, payload.q, payload.r);
}

function handleGather(
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: MatchState,
  sender: nkruntime.Presence,
  player: PlayerState,
  payload: { node_id: string },
): void {
  const nodeId = payload.node_id;
  const def = RESOURCE_NODES[nodeId];
  const runtime = state.nodes[nodeId];

  const nodeState = def && runtime ? { x: def.x, y: def.y, available: runtime.available } : null;
  const result = validateGather(
    { x: player.x, y: player.y, isGathering: player.gather !== null },
    nodeState,
    GATHER_RANGE,
  );

  if (!result.valid) {
    dispatcher.broadcastMessage(
      OpCode.GATHER_CANCELLED,
      JSON.stringify({ node_id: nodeId, reason: result.reason }),
      [sender],
    );
    return;
  }

  // Reserve the node for the duration of the cast plus its respawn time.
  const completeTick = tick + msToTicks(def.gatherDurationMs);
  player.gather = { nodeId, completeTick };
  runtime.available = false;
  runtime.availableAtTick = completeTick + msToTicks(def.respawnMs);

  dispatcher.broadcastMessage(
    OpCode.NODE_STATE,
    JSON.stringify({ node_id: nodeId, available: false }),
  );
  dispatcher.broadcastMessage(
    OpCode.GATHER_STARTED,
    JSON.stringify({ node_id: nodeId, duration_ms: def.gatherDurationMs }),
    [sender],
  );
}

function resolveGathers(
  dispatcher: nkruntime.MatchDispatcher,
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  tick: number,
  state: MatchState,
): void {
  for (const userId of Object.keys(state.players)) {
    const player = state.players[userId];
    if (!player.gather || tick < player.gather.completeTick) {
      continue;
    }

    const nodeId = player.gather.nodeId;
    const def = RESOURCE_NODES[nodeId];
    const table = def ? LOOT_TABLES[def.lootTableId] : undefined;
    const drop = table ? rollLoot(table, Math.random()) : { success: false, itemId: "", quantity: 0 };

    const presence = state.presences[userId];
    if (presence) {
      dispatcher.broadcastMessage(
        OpCode.GATHER_RESULT,
        JSON.stringify({
          node_id: nodeId,
          success: drop.success,
          item_id: drop.itemId,
          quantity: drop.quantity,
        }),
        [presence],
      );
    }

    // Persist the catch to the player's inventory (server-authoritative storage).
    if (drop.success) {
      const current = readInventory(nk, userId);
      writeInventory(nk, userId, addItem(current, drop.itemId, drop.quantity));
      
      // Hook into the quest system
      progressObjective(nk, userId, "gather", drop.itemId, drop.quantity);
    }

    logger.info("%s gathered %s -> %s x%d", userId, nodeId, drop.itemId || "(nothing)", drop.quantity);
    player.gather = null;
  }
}

function respawnNodes(
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: MatchState,
): void {
  for (const nodeId of Object.keys(state.nodes)) {
    const runtime = state.nodes[nodeId];
    if (!runtime.available && tick >= runtime.availableAtTick) {
      runtime.available = true;
      dispatcher.broadcastMessage(
        OpCode.NODE_STATE,
        JSON.stringify({ node_id: nodeId, available: true }),
      );
    }
  }
}

function cancelGather(
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: MatchState,
  sender: nkruntime.Presence,
  player: PlayerState,
  reason: string,
): void {
  if (!player.gather) {
    return;
  }
  const nodeId = player.gather.nodeId;
  player.gather = null;

  // Free the node immediately so it's grabbable again.
  const runtime = state.nodes[nodeId];
  if (runtime) {
    runtime.available = true;
    runtime.availableAtTick = tick;
    dispatcher.broadcastMessage(
      OpCode.NODE_STATE,
      JSON.stringify({ node_id: nodeId, available: true }),
    );
  }

  dispatcher.broadcastMessage(
    OpCode.GATHER_CANCELLED,
    JSON.stringify({ node_id: nodeId, reason }),
    [sender],
  );
}

const matchTerminate: nkruntime.MatchTerminateFunction<MatchState> = function (
  _ctx,
  _logger,
  _nk,
  _dispatcher,
  _tick,
  state,
) {
  return { state };
};

const matchSignal: nkruntime.MatchSignalFunction<MatchState> = function (
  _ctx,
  _logger,
  _nk,
  _dispatcher,
  _tick,
  state,
) {
  return { state };
};

export const worldMatch: nkruntime.MatchHandler<MatchState> = {
  matchInit,
  matchJoinAttempt,
  matchJoin,
  matchLeave,
  matchLoop,
  matchTerminate,
  matchSignal,
};
