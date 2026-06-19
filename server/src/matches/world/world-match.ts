// Authoritative "world" match handler. This is the server side of movement:
// it owns every player's true position and never trusts a client's claim
// without validating it (CLAUDE.md §1).

import { OpCode } from "../../contract/opcodes";
import {
  MAX_MOVE_SPEED,
  MOVE_TOLERANCE,
  NET_TICK_RATE,
  SPAWN_X,
  SPAWN_Y,
  WORLD_MATCH_LABEL,
} from "../../contract/constants";
import { validateMove } from "../../validation/movement-validator";

interface PlayerState {
  x: number;
  y: number;
  name: string;
  lastTick: number;
}

interface MatchState {
  players: { [userId: string]: PlayerState };
}

const matchInit: nkruntime.MatchInitFunction<MatchState> = function (_ctx, logger) {
  logger.info("World match created");
  return {
    state: { players: {} },
    tickRate: NET_TICK_RATE,
    label: WORLD_MATCH_LABEL,
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
    };

    // Tell everyone a new player spawned.
    dispatcher.broadcastMessage(
      OpCode.PLAYER_JOINED,
      JSON.stringify({ id: presence.userId, x: SPAWN_X, y: SPAWN_Y, name: presence.username }),
    );

    // Send the full current world to just the joiner so they can render
    // everyone already present.
    const snapshot = {
      players: Object.keys(state.players).map((id) => ({
        id,
        x: state.players[id].x,
        y: state.players[id].y,
        name: state.players[id].name,
      })),
    };
    dispatcher.broadcastMessage(OpCode.WORLD_SNAPSHOT, JSON.stringify(snapshot), [presence]);
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
    if (message.opCode !== OpCode.MOVE_REQUEST) {
      continue;
    }

    const player = state.players[message.sender.userId];
    if (!player) {
      continue;
    }

    let requested: { x: number; y: number };
    try {
      requested = JSON.parse(nk.binaryToString(message.data));
    } catch (_e) {
      continue; // ignore garbage
    }

    const elapsedSeconds = (tick - player.lastTick) / NET_TICK_RATE;
    const result = validateMove(
      { x: player.x, y: player.y },
      { x: requested.x, y: requested.y },
      elapsedSeconds,
      MAX_MOVE_SPEED,
      MOVE_TOLERANCE,
    );

    if (result.valid) {
      player.x = result.position.x;
      player.y = result.position.y;
      player.lastTick = tick;
      // Broadcast the authoritative position to everyone; clients ignore
      // broadcasts carrying their own id.
      dispatcher.broadcastMessage(
        OpCode.MOVE_BROADCAST,
        JSON.stringify({ id: message.sender.userId, x: player.x, y: player.y }),
      );
    } else {
      // Reject: snap the offending client back to authoritative truth.
      logger.warn(
        "Rejected move from %s (%s)",
        message.sender.userId,
        result.reason ?? "unknown",
      );
      dispatcher.broadcastMessage(
        OpCode.MOVE_REJECTED,
        JSON.stringify({ x: player.x, y: player.y }),
        [message.sender],
      );
    }
  }

  return { state };
};

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
