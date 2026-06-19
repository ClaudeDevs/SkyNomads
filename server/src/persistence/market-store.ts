// Marketplace listings live in a system-owned (userId "") storage collection so
// they are global and listable. Public read, server-only write.

import type { Listing } from "../validation/market-validator";

const COLLECTION = "market";
const SYSTEM = ""; // system-owned storage

export interface StoredListing {
  listing: Listing;
  version: string; // storage version, for optimistic concurrency on buy/cancel
}

export function writeListing(nk: nkruntime.Nakama, listing: Listing): void {
  nk.storageWrite([
    {
      collection: COLLECTION,
      key: listing.listingId,
      userId: SYSTEM,
      value: listing as unknown as { [key: string]: any },
      permissionRead: 2, // public read
      permissionWrite: 0, // server-only write
    },
  ]);
}

export function readListing(nk: nkruntime.Nakama, listingId: string): StoredListing | null {
  const objects = nk.storageRead([{ collection: COLLECTION, key: listingId, userId: SYSTEM }]);
  if (objects.length === 0) {
    return null;
  }
  return { listing: objects[0].value as unknown as Listing, version: objects[0].version };
}

/**
 * Delete a listing, asserting its version. Throws if the version no longer
 * matches (i.e. someone else already bought/cancelled it) — this is what makes
 * a purchase safe against two buyers racing for the same listing.
 */
export function deleteListing(nk: nkruntime.Nakama, listingId: string, version: string): void {
  nk.storageDelete([{ collection: COLLECTION, key: listingId, userId: SYSTEM, version }]);
}

export function listListings(nk: nkruntime.Nakama, limit = 100): Listing[] {
  const result = nk.storageList(SYSTEM, COLLECTION, limit);
  const objects = result.objects ?? [];
  return objects.map((o) => o.value as unknown as Listing);
}
