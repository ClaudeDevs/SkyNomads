import { QUESTS } from "../data/quests";

export interface QuestProgress {
  questId: string;
  amount: number;
  completed: boolean;
  claimed: boolean;
}

export interface PlayerQuests {
  active: Record<string, QuestProgress>;
}

const COLLECTION = "quests";
const KEY = "state";

export function readQuests(nk: nkruntime.Nakama, userId: string): PlayerQuests {
  const result = nk.storageRead([{ collection: COLLECTION, key: KEY, userId }]);
  if (result.length === 0) {
    // Give them the first quest by default
    return {
      active: {
        "quest_wood_1": {
          questId: "quest_wood_1",
          amount: 0,
          completed: false,
          claimed: false
        }
      }
    };
  }
  return result[0].value as PlayerQuests;
}

export function writeQuests(nk: nkruntime.Nakama, userId: string, state: PlayerQuests): void {
  nk.storageWrite([
    {
      collection: COLLECTION,
      key: KEY,
      userId,
      value: state,
      permissionRead: 1, // owner read
      permissionWrite: 0 // server write only
    }
  ]);
}

// Helper to progress a specific objective type
export function progressObjective(nk: nkruntime.Nakama, userId: string, type: "gather" | "build", targetId: string, amount: number): void {
  const quests = readQuests(nk, userId);
  let updated = false;

  for (const qId of Object.keys(quests.active)) {
    const progress = quests.active[qId];
    if (progress.completed || progress.claimed) continue;

    const def = QUESTS[qId];
    if (def && def.objectiveType === type && def.targetId === targetId) {
      progress.amount += amount;
      if (progress.amount >= def.amount) {
        progress.amount = def.amount;
        progress.completed = true;
      }
      updated = true;
    }
  }

  if (updated) {
    writeQuests(nk, userId, quests);
  }
}
