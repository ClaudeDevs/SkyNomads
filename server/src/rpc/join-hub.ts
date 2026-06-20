import { WORLD_MATCH_MODULE } from "../contract/constants";

export const rpcJoinHub: nkruntime.RpcFunction = function (_ctx, _logger, nk) {
  const label = "type:hub";
  const matches = nk.matchList(1, true, label, 0, 100);

  let matchId: string;
  if (matches.length > 0) {
    matchId = matches[0].matchId;
  } else {
    matchId = nk.matchCreate(WORLD_MATCH_MODULE, { type: "hub" });
  }

  return JSON.stringify({ match_id: matchId });
};
