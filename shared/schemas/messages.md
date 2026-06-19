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
| `OP_GATHER_REQUEST`  | C→S    | `{ "node_id": string }` — "I want to gather this node" |
| `OP_GATHER_STARTED`  | S→one  | `{ "node_id": string, "duration_ms": int }` — accepted; show cast/progress |
| `OP_GATHER_RESULT`   | S→one  | `{ "node_id": string, "success": bool, "item_id": string, "quantity": int }` — the server's roll |
| `OP_GATHER_CANCELLED`| S→one  | `{ "node_id": string, "reason": string }` — rejected/aborted (`too_far`, `on_cooldown`, `busy`, `unknown_node`, `moved`) |
| `OP_NODE_STATE`      | S→all  | `{ "node_id": string, "available": bool }` — node depleted/respawned |
| `OP_NODES_SNAPSHOT`  | S→one  | `{ "nodes": [ { "id", "type", "x", "y", "available" }, ... ] }` — sent to a joiner |

## Movement flow (the server-authority loop)

1. Client predicts locally (`Player.gd`) and streams its position via
   `OP_MOVE_REQUEST` at `NET_SEND_RATE` Hz.
2. Server validates the delta against `MAX_MOVE_SPEED` (+ `MOVE_TOLERANCE`).
   - **Valid** → update authoritative position, `OP_MOVE_BROADCAST` to all.
   - **Invalid** → `OP_MOVE_REJECTED` to the sender only; client reconciles.
3. Other clients render remotes from `OP_MOVE_BROADCAST`; each client ignores
   broadcasts carrying its own `id`.

## Gathering flow (server-authoritative loot — CLAUDE.md §1)

The client never decides what it caught. It only asks to gather; the server
owns proximity, availability, timing, and the loot roll.

1. Client (near a node) sends `OP_GATHER_REQUEST { node_id }` and optimistically
   locks movement / shows a casting state.
2. Server validates: node exists, is available (not on cooldown), player isn't
   already gathering, and is within `GATHER_RANGE`.
   - **Reject** → `OP_GATHER_CANCELLED { reason }`; client unlocks.
   - **Accept** → reserve the node (`OP_NODE_STATE available:false` to all),
     reply `OP_GATHER_STARTED { duration_ms }`; client shows "Line out…".
3. After the node's duration elapses (counted in server ticks), the server
   **rolls the loot table itself** and sends `OP_GATHER_RESULT`. The node stays
   unavailable for its respawn time, then `OP_NODE_STATE available:true` to all.
4. If the player moves during a gather, the server cancels it
   (`OP_GATHER_CANCELLED reason:"moved"`) and frees the node.

> Loot tables (drop odds) live **server-side only** (`server/src/data/`). They
> are never part of the shared contract — the client must not depend on, or be
> able to read, the odds.

## RPCs (non-realtime request/response)

| RPC                | Request   | Response                                   |
|--------------------|-----------|--------------------------------------------|
| `find_world_match` | `""`      | `{ "match_id": string }`                   |
| `get_inventory`    | `""`      | `{ "items": { "<item_id>": quantity, … } }` |
| `get_wallet`       | `""`      | `{ "coins": int }`                          |
| `market_listings`  | `""`      | `{ "listings": [ Listing, … ] }`           |
| `market_list_item` | `{ "item_id", "quantity", "price" }` | `{ "ok": bool, "listing_id"?, "reason"? }` |
| `market_buy`       | `{ "listing_id" }` | `{ "ok": bool, "item_id"?, "quantity"?, "price"?, "reason"? }` |

`Listing` = `{ "listingId", "sellerId", "itemId", "quantity", "price" }`.

`get_inventory` / `get_wallet` return only the **caller's** data (keyed off the
authenticated `ctx.userId`). Inventory, wallet, and listings are persisted in
Nakama storage with **server-only write permission** — a client can read its own
inventory/balance but can never modify it directly.

### Economy authority rules (Phase 4)
- **Listing**: server removes the item from the seller's inventory *before*
  creating the listing — you can't list what you don't own.
- **Buying**: server validates funds and ownership, then deletes the listing
  with a storage **version assertion first**, so two racing buyers can't both
  win (no double-spend / item duplication). Coins and the item transfer only
  after the listing is successfully claimed.
- Starter balance and currency are server-only (`server/src/systems/wallet.ts`,
  `server/src/data/`); the in-game coin is the layer a future crypto bridge
  would settle against — the authority pattern stays identical.
