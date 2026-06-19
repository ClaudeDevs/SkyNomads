# SkyNomads

An isometric MMO (sky-islands) built with **Godot 4** + **Nakama**.
Architecture, conventions, and the all-important server-authority rules live in
[`CLAUDE.md`](./CLAUDE.md) — read it first.

## Layout

| Path        | What                                                          |
|-------------|--------------------------------------------------------------|
| `client/`   | Godot 4 project (rendering, input, prediction, UI)           |
| `server/`   | Nakama TypeScript modules (authoritative state, validation)  |
| `shared/`   | The contract: opcodes, message schemas, tunable constants    |

## Running the backend (Phase 1)

```bash
# 1. Build the server modules
cd server
npm install
npm run build          # -> server/build/index.js
npm test               # runs the movement-validator unit tests

# 2. Boot Postgres + Nakama with the modules mounted
cd ..
docker compose up
```

- Nakama API for the game client: `127.0.0.1:7350`
- Nakama admin console: `http://127.0.0.1:7351` (`admin` / `password`)

## Running the client

1. Install the [Nakama Godot addon](https://github.com/heroiclabs/nakama-godot)
   into `client/addons/` and enable it (provides the `Nakama` singleton).
2. Register autoloads in **Project Settings → Autoload**:
   - `NetworkManager` → `res://autoload/network_manager.gd`
3. From a bootstrap script, connect and join:
   ```gdscript
   await NetworkManager.connect_to_server()
   await NetworkManager.join_world()
   ```
4. Add the `WorldNet` system (`scripts/systems/world_net.gd`) to your world
   scene, assign its `remote_player_scene` and `local_player_path`.

## Status

**Phase 1 — server-authoritative movement.** Client predicts (`Player.gd`),
streams position, server validates against `MAX_MOVE_SPEED` and broadcasts truth.

**Phase 2 — sky-islands gathering/fishing loop.** Resource nodes are
server-owned and pushed to clients on join. A gather is a request the server
validates (proximity, availability, not-busy), times in ticks, then **rolls the
loot table server-side** before returning the result. Loot odds live in
`server/src/data/` and never reach the client. The local player enters the
`GATHERING` state (movement locked) and shows "Line out — wait for a bite…".

See `shared/schemas/messages.md` for both message flows.

### Client pieces (for when you scaffold the Godot project)
- `Player.gd` + `GatheringComponent` (child) → drives the `GATHERING` state
- `ResourceManager` → spawns/updates nodes from the server snapshot
- `ResourceNode` → per-node visual; needs an `"interact"` Input Map action
