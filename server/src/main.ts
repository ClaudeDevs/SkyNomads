// Nakama module entry point. Registers the authoritative match handler and the
// match-finder RPC. See CLAUDE.md §3 (TypeScript is the default runtime).

import { WORLD_MATCH_MODULE } from "./contract/constants";
import { worldMatch } from "./matches/world/world-match";
import { rpcFindWorldMatch } from "./rpc/find-world-match";
import { rpcGetInventory } from "./rpc/get-inventory";

function InitModule(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  _nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer,
): void {
  initializer.registerMatch(WORLD_MATCH_MODULE, worldMatch);
  initializer.registerRpc("find_world_match", rpcFindWorldMatch);
  initializer.registerRpc("get_inventory", rpcGetInventory);
  logger.info("SkyNomads server modules loaded.");
}

// Reference InitModule so the bundler/runtime keeps it as a global entry point.
// (Standard Heroic Labs TypeScript-runtime pattern.)
// eslint-disable-next-line @typescript-eslint/no-unused-expressions
!InitModule && InitModule.bind(null);
