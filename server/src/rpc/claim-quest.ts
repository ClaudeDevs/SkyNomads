import { readQuests, writeQuests } from "../persistence/quest-store";
import { QUESTS } from "../data/quests";
import { readWallet, writeWallet, addCoins } from "../persistence/wallet-store";

export const rpcClaimQuest: nkruntime.RpcFunction = function (
  _ctx: nkruntime.Context,
  _logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
) {
  const userId = _ctx.userId;
  if (!userId) {
    throw Error("User not found");
  }

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
  
  // Claim it
  progress.claimed = true;
  writeQuests(nk, userId, quests);

  // Reward
  const wallet = readWallet(nk, userId);
  writeWallet(nk, userId, addCoins(wallet, def.rewardCoins));

  return JSON.stringify({ success: true, reward: def.rewardCoins });
};
