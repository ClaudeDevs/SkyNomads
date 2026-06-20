// Standard Square Isometric Math (Diamonds)
// A typical diamond tile is exactly 2x as wide as it is tall.
export const TILE_W = 64;
export const TILE_H = 32;

// Converts a world coordinate (Cartesian X,Y) to Isometric Screen coordinate
export function cartesianToIso(cartPt: { x: number, y: number }): { x: number, y: number } {
    return {
        x: (cartPt.x - cartPt.y) * (TILE_W / 2),
        y: (cartPt.x + cartPt.y) * (TILE_H / 2)
    };
}

// Converts an Isometric Screen coordinate back to a Cartesian World coordinate
export function isoToCartesian(isoPt: { x: number, y: number }): { x: number, y: number } {
    return {
        x: (isoPt.x / (TILE_W / 2) + isoPt.y / (TILE_H / 2)) / 2,
        y: (isoPt.y / (TILE_H / 2) - (isoPt.x / (TILE_W / 2))) / 2
    };
}

// Rounds a continuous Cartesian coordinate to the nearest discrete integer tile
export function getTileCoordinate(cartPt: { x: number, y: number }): { x: number, y: number } {
    return {
        x: Math.round(cartPt.x),
        y: Math.round(cartPt.y)
    };
}
