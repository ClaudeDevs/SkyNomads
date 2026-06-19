// RPC: return the caller's coin balance.

import { readBalance } from "../persistence/wallet-store";

export const rpcGetWallet: nkruntime.RpcFunction = function (ctx, _logger, nk) {
  return JSON.stringify({ coins: readBalance(nk, ctx.userId) });
};
