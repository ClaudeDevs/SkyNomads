// RPC: returns the id of the shared world match, creating it on first call.
// For Phase 1 there is a single global world (a "realm"). Sharding into
// multiple sky-island instances is a later concern.

import { WORLD_MATCH_LABEL, WORLD_MATCH_MODULE } from "../contract/constants";

export const rpcFindWorldMatch: nkruntime.RpcFunction = function (_ctx, _logger, nk) {
  const matches = nk.matchList(1, true, WORLD_MATCH_LABEL, 0, 100);

  let matchId: string;
  if (matches.length > 0) {
    matchId = matches[0].matchId;
  } else {
    matchId = nk.matchCreate(WORLD_MATCH_MODULE, {});
  }

  return JSON.stringify({ match_id: matchId });
};
