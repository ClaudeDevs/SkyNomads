export interface QuestDef {
  id: string;
  title: string;
  description: string;
  objectiveType: "gather" | "build";
  targetId: string; // e.g., "wood" or "campfire"
  amount: number;
  rewardCoins: number;
}

export const QUESTS: Record<string, QuestDef> = {
  "quest_wood_1": {
    id: "quest_wood_1",
    title: "Gathering Wood",
    description: "Chop 5 wood from the surrounding trees.",
    objectiveType: "gather",
    targetId: "wood",
    amount: 5,
    rewardCoins: 50
  }
};
