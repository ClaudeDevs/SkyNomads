extends Node2D
class_name IsoGround

## Draws a diamond-shaped isometric "sky island" floor out of 32x16 tiles, so
## the world has a visible surface to move across (and looks island-ish).
## Placeholder rendering — swap for a TileMapLayer + real tileset art later.

@export var radius: int = 10  # island size, in tiles, from the centre

const COLOR_LIGHT := Color(0.87, 0.79, 0.57)  # sand
const COLOR_DARK := Color(0.81, 0.72, 0.49)
const COLOR_EDGE := Color(0.0, 0.0, 0.0, 0.06)


func _draw() -> void:
	# Draw back-to-front so nothing matters for these flat tiles, but keep the
	# diamond island shape: |gx| + |gy| <= radius.
	for gx in range(-radius, radius + 1):
		for gy in range(-radius, radius + 1):
			if abs(gx) + abs(gy) > radius:
				continue
			_draw_tile(Iso.grid_to_screen(Vector2(gx, gy)), (gx + gy) % 2 == 0)


func _draw_tile(center: Vector2, light: bool) -> void:
	var hw := Iso.TILE_WIDTH * 0.5
	var hh := Iso.TILE_HEIGHT * 0.5
	var pts := PackedVector2Array([
		center + Vector2(0, -hh),
		center + Vector2(hw, 0),
		center + Vector2(0, hh),
		center + Vector2(-hw, 0),
	])
	draw_colored_polygon(pts, COLOR_LIGHT if light else COLOR_DARK)
	draw_polyline(PackedVector2Array([pts[0], pts[1], pts[2], pts[3], pts[0]]), COLOR_EDGE, 1.0)
