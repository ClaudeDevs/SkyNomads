import { readQuests, writeQuests } from "../persistence/quest-store";
import { QUESTS } from "../data/quests";
import { readBalance, writeBalance } from "../persistence/wallet-store";
import { addCoins } from "../systems/wallet";

export const rpcClaimQuest: nkruntime.RpcFunction = function (
  _ctx: nkruntime.Context,
  _logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
) {
  const userId = _ctx.userId;
  if (!userId) throw Error("User not found");

  let parsed: any;
  try {
    parsed = JSON.parse(payload);
  } catch (e) {
    throw Error("Invalid payload");
  }

  const questId = parsed.quest_id;
  if (!questId) throw Error("Missing quest_id");

  const quests = readQuests(nk, userId);
  const progress = quests.active[questId];
  if (!progress) throw Error("Quest not active");
  if (!progress.completed) throw Error("Quest not completed");
  if (progress.claimed) throw Error("Quest already claimed");

  const def = QUESTS[questId];
  if (!def) throw Error("Quest def missing");

  // Mark claimed, then pay out — wallet stays server-authoritative.
  progress.claimed = true;
  writeQuests(nk, userId, quests);

  const balance = readBalance(nk, userId);
  writeBalance(nk, userId, addCoins(balance, def.rewardCoins));

  return JSON.stringify({ success: true, reward: def.rewardCoins });
};
