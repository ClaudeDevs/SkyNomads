export interface PlacedObject {
  q: number;
  r: number;
  type: string;
}

export interface IslandState {
  placedObjects: PlacedObject[];
}

const COLLECTION = "islands";
const KEY = "state";

export function readIsland(nk: nkruntime.Nakama, userId: string): IslandState {
  const objects = nk.storageRead([{ collection: COLLECTION, key: KEY, userId }]);
  if (objects.length > 0) {
    return objects[0].value as IslandState;
  }
  return { placedObjects: [] };
}

export function writeIsland(nk: nkruntime.Nakama, userId: string, state: IslandState): void {
  nk.storageWrite([
    {
      collection: COLLECTION,
      key: KEY,
      userId,
      value: state,
      permissionRead: 1, // owner can read
      permissionWrite: 0, // server-only writes
    },
  ]);
}
