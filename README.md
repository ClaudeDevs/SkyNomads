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

## Play in the browser (no install) — GitHub Pages

A GitHub Action exports the client to HTML5 and publishes it, so you can play in
a browser tab without installing Godot.

**One-time setup:**
1. In the repo: **Settings → Pages → Build and deployment → Source = "GitHub Actions"**.
2. Push to `main` or `claude/happy-gates-ibl0gt` (any change under `client/`),
   or run the **Web Export** workflow manually from the **Actions** tab.
3. When it finishes, the workflow's `deploy` step prints the **page URL**. Open
   it and move with **WASD / arrows**.

> The published build runs **offline** (movement only). To play the full online
> loop in the browser you'd also need the backend hosted somewhere publicly
> reachable and the Nakama Godot addon committed — that's a later step.

Notes:
- The export is **single-threaded** (`thread_support=false`) so it runs on plain
  GitHub Pages, which can't send the COOP/COEP headers a threaded build needs.
- Godot version is pinned in `.github/workflows/web-export.yml`
  (`barichello/godot-ci:4.3`); keep it in sync with `project.godot`.

## Running the client locally (optional)

The `client/` folder is a ready-to-open Godot 4 project (the Input Map,
`NetworkManager` autoload, scenes, and a `world.tscn` main scene are all wired).

**Quick start (offline — no backend needed):**
1. Install [Godot 4](https://godotengine.org) (4.3+ recommended).
2. Open `client/` as a project, press **F5**.
3. Move with **WASD** / arrow keys — you'll see the isometric movement.
   (The HUD will say "Offline" until the backend is running.)

**Full loop (online — multiplayer + fishing):**
1. Start the backend (see above): `cd server && npm run build && docker compose up`.
2. Install the [Nakama Godot addon](https://github.com/heroiclabs/nakama-godot)
   into `client/addons/` and enable it in **Project Settings → Plugins**
   (this provides the `Nakama` singleton at `/root/Nakama`).
3. Press **F5**. The HUD shows "Online". Walk onto a green node and press **E**
   to fish/gather. Launch a second copy to see another player sync.

> Without the addon the project still runs (movement only); `NetworkManager`
> detects the missing addon and stays offline instead of erroring.

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
