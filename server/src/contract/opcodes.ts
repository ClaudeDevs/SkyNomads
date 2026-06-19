// Mirror of shared/opcodes/opcodes.json. Keep in sync with the canonical file
// and the client mirror (client/scripts/net/net_contract.gd). See CLAUDE.md §2.

export const OpCode = {
  MOVE_REQUEST: 1,
  MOVE_BROADCAST: 2,
  PLAYER_JOINED: 3,
  PLAYER_LEFT: 4,
  WORLD_SNAPSHOT: 5,
  MOVE_REJECTED: 6,
} as const;

export type OpCode = (typeof OpCode)[keyof typeof OpCode];
