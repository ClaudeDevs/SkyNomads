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

# --- Tunables (mirror of shared/constants/constants.json) ---
const MAX_MOVE_SPEED := 120.0   # px/s, screen-space (Player.gd default speed)
const MOVE_TOLERANCE := 8.0     # px latency slack
const NET_SEND_RATE := 10.0     # local position sends per second
const SPAWN_X := 0.0
const SPAWN_Y := 0.0
