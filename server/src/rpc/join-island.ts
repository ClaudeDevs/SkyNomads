import { WORLD_MATCH_MODULE } from "../contract/constants";

export const rpcJoinIsland: nkruntime.RpcFunction = function (ctx, _logger, nk, payload) {
  let owner = ctx.userId;
  if (payload) {
    try {
      const parsed = JSON.parse(payload);
      if (parsed.owner_id) {
        owner = parsed.owner_id;
      }
    } catch (e) {
      // ignore
    }
  }

  const label = `type:island,owner:${owner}`;
  const matches = nk.matchList(1, true, label, 0, 100);

  let matchId: string;
  if (matches.length > 0) {
    matchId = matches[0].matchId;
  } else {
    matchId = nk.matchCreate(WORLD_MATCH_MODULE, { type: "island", owner: owner });
  }

  return JSON.stringify({ match_id: matchId });
};
