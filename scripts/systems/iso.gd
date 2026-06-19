class_name Iso
extends RefCounted

## The ONE place world<->screen isometric conversion lives (CLAUDE.md §5).
## Tile is 32x16 (2:1 diamond). Never inline this math elsewhere.

const TILE_WIDTH := 32
const TILE_HEIGHT := 16


## Grid cell (can be fractional) -> screen-space pixels.
static func grid_to_screen(cell: Vector2) -> Vector2:
	return Vector2(
		(cell.x - cell.y) * TILE_WIDTH * 0.5,
		(cell.x + cell.y) * TILE_HEIGHT * 0.5
	)


## Screen-space pixels -> grid cell (fractional).
static func screen_to_grid(pos: Vector2) -> Vector2:
	var half_w := TILE_WIDTH * 0.5
	var half_h := TILE_HEIGHT * 0.5
	return Vector2(
		(pos.x / half_w + pos.y / half_h) * 0.5,
		(pos.y / half_h - pos.x / half_w) * 0.5
	)
