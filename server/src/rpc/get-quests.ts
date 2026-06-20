import { readQuests } from "../persistence/quest-store";
import { QUESTS } from "../data/quests";

export const rpcGetQuests: nkruntime.RpcFunction = function (
  _ctx: nkruntime.Context,
  _logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  _payload: string,
) {
  const userId = _ctx.userId;
  if (!userId) {
    throw Error("User not found");
  }

  const quests = readQuests(nk, userId);
  
  // Mix in the definitions so the client has the titles and descriptions
  const response: any = {};
  for (const qId of Object.keys(quests.active)) {
    response[qId] = {
       progress: quests.active[qId],
       def: QUESTS[qId]
    };
  }

  return JSON.stringify({ quests: response });
};
