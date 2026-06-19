# Message Schemas

Canonical payload shapes per opcode. All payloads are JSON-encoded match-data
(binary packing is a later optimization; keep the field names stable).

Direction key: **C→S** client to server, **S→one** server to a single client,
**S→all** server broadcast to everyone in the match.

| Opcode               | Dir    | Payload                                              |
|----------------------|--------|-----------------------------------------------------|
| `OP_MOVE_REQUEST`    | C→S    | `{ "x": float, "y": float }` — client's predicted screen position |
| `OP_MOVE_BROADCAST`  | S→all  | `{ "id": string, "x": float, "y": float }` — authoritative position of a player |
| `OP_PLAYER_JOINED`   | S→all  | `{ "id": string, "x": float, "y": float, "name": string }` |
| `OP_PLAYER_LEFT`     | S→all  | `{ "id": string }`                                  |
| `OP_WORLD_SNAPSHOT`  | S→one  | `{ "players": [ { "id", "x", "y", "name" }, ... ] }` — sent to a joiner |
| `OP_MOVE_REJECTED`   | S→one  | `{ "x": float, "y": float }` — authoritative position to snap back to |

## Movement flow (the server-authority loop)

1. Client predicts locally (`Player.gd`) and streams its position via
   `OP_MOVE_REQUEST` at `NET_SEND_RATE` Hz.
2. Server validates the delta against `MAX_MOVE_SPEED` (+ `MOVE_TOLERANCE`).
   - **Valid** → update authoritative position, `OP_MOVE_BROADCAST` to all.
   - **Invalid** → `OP_MOVE_REJECTED` to the sender only; client reconciles.
3. Other clients render remotes from `OP_MOVE_BROADCAST`; each client ignores
   broadcasts carrying its own `id`.
