// RPC: browse active marketplace listings.

import { listListings } from "../persistence/market-store";

export const rpcMarketListings: nkruntime.RpcFunction = function (_ctx, _logger, nk) {
  return JSON.stringify({ listings: listListings(nk) });
};
