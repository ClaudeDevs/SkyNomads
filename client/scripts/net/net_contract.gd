class_name NetContract
extends RefCounted

## Client mirror of the shared/ contract.
## Keep in sync with shared/opcodes/opcodes.json and
## shared/constants/constants.json (and the server mirror in
## server/src/contract/). Never edit one side without the other — CLAUDE.md §2.

# --- Opcodes (mirror of shared/opcodes/opcodes.json) ---
const OP_MOVE_REQUEST := 1
const OP_MOVE_BROADCAST := 2
const OP_PLAYER_JOINED := 3
const OP_PLAYER_LEFT := 4
const OP_WORLD_SNAPSHOT := 5
const OP_MOVE_REJECTED := 6

const OP_GATHER_REQUEST := 7
const OP_GATHER_STARTED := 8
const OP_GATHER_RESULT := 9
const OP_GATHER_CANCELLED := 10
const OP_NODE_STATE := 11
const OP_NODES_SNAPSHOT := 12

const OP_BUILD_REQUEST := 13
const OP_BUILD_BROADCAST := 14
const OP_ISLAND_SNAPSHOT := 15

# --- Tunables (mirror of shared/constants/constants.json) ---
const MAX_MOVE_SPEED := 120.0   # px/s, screen-space (Player.gd default speed)
const MOVE_TOLERANCE := 8.0     # px latency slack
const NET_SEND_RATE := 10.0     # local position sends per second
const SPAWN_X := 0.0
const SPAWN_Y := 0.0
const GATHER_RANGE := 48.0      # px; how close to a node to gather it
