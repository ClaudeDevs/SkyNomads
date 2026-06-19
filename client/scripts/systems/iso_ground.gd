extends Node2D
class_name IsoGround

## Draws a floating sky-island out of 32x16 isometric tiles WITH block depth
## (top + two side faces), so it reads as a solid 3D island rather than a flat
## rug. Grass interior, sandy beach ring, a water rim, and a few props.
##
## Placeholder rendering. To go pro: replace this with a TileMapLayer + a real
## tileset (e.g. a Kenney CC0 isometric pack) and sprite props. The look swaps;
## the gameplay doesn't change.

@export var radius: int = 12   # island size (tiles from centre)
@export var depth: float = 12.0  # block thickness in px

const GRASS_LIGHT := Color(0.49, 0.74, 0.42)
const GRASS_DARK := Color(0.43, 0.68, 0.37)
const SAND_LIGHT := Color(0.88, 0.81, 0.58)
const SAND_DARK := Color(0.82, 0.74, 0.50)
const SIDE_TINT := Color(0.0, 0.0, 0.0, 0.28)   # darken side faces
const EDGE := Color(0.0, 0.0, 0.0, 0.06)


func _draw() -> void:
	# Collect island cells, then paint back-to-front so front tiles' tops cover
	# the side faces of the tiles behind them — only the island's outer rim
	# shows its thickness.
	var cells: Array[Vector2i] = []
	for gx in range(-radius, radius + 1):
		for gy in range(-radius, radius + 1):
			if abs(gx) + abs(gy) <= radius:
				cells.append(Vector2i(gx, gy))
	cells.sort_custom(func(a, b): return (a.x + a.y) < (b.x + b.y))

	for c in cells:
		_draw_block(c)

	# A couple of palms and umbrellas for life (behind the player for now).
	_draw_umbrella(Iso.grid_to_screen(Vector2(-4, -3)), Color(0.9, 0.4, 0.4))
	_draw_umbrella(Iso.grid_to_screen(Vector2(5, 2)), Color(0.45, 0.75, 0.85))
	_draw_palm(Iso.grid_to_screen(Vector2(-7, 4)))
	_draw_palm(Iso.grid_to_screen(Vector2(6, -6)))
	_draw_palm(Iso.grid_to_screen(Vector2(-2, 8)))


func _draw_block(cell: Vector2i) -> void:
	var center := Iso.grid_to_screen(Vector2(cell))
	var hw := Iso.TILE_WIDTH * 0.5
	var hh := Iso.TILE_HEIGHT * 0.5
	var down := Vector2(0, depth)

	var west := center + Vector2(-hw, 0)
	var south := center + Vector2(0, hh)
	var east := center + Vector2(hw, 0)
	var north := center + Vector2(0, -hh)

	var beach := abs(cell.x) + abs(cell.y) >= radius - 1
	var light := (cell.x + cell.y) % 2 == 0
	var top_color: Color
	if beach:
		top_color = SAND_LIGHT if light else SAND_DARK
	else:
		top_color = GRASS_LIGHT if light else GRASS_DARK
	var side_color := top_color.darkened(0.28)

	# Left (south-west) and right (south-east) faces give the 3D thickness.
	draw_colored_polygon(PackedVector2Array([west, south, south + down, west + down]), side_color)
	draw_colored_polygon(PackedVector2Array([south, east, east + down, south + down]), side_color.darkened(0.08))

	# Top face.
	var top := PackedVector2Array([north, east, south, west])
	draw_colored_polygon(top, top_color)
	draw_polyline(PackedVector2Array([north, east, south, west, north]), EDGE, 1.0)


func _draw_umbrella(base: Vector2, canopy: Color) -> void:
	var top := base + Vector2(0, -28)
	draw_line(base, top, Color(0.35, 0.35, 0.35), 2.0)
	draw_colored_polygon(
		PackedVector2Array([top + Vector2(-18, 4), top + Vector2(0, -4), top + Vector2(18, 4)]),
		canopy
	)
	draw_colored_polygon(
		PackedVector2Array([top + Vector2(-18, 4), top + Vector2(0, 11), top + Vector2(18, 4)]),
		canopy.lightened(0.15)
	)


func _draw_palm(base: Vector2) -> void:
	var top := base + Vector2(-3, -30)
	draw_line(base, top, Color(0.45, 0.31, 0.18), 4.0)
	var frond := Color(0.27, 0.6, 0.32)
	for dir in [Vector2(-16, -2), Vector2(16, -2), Vector2(-10, -12), Vector2(10, -12), Vector2(0, -16)]:
		draw_colored_polygon(
			PackedVector2Array([top, top + dir + Vector2(-4, 4), top + dir + Vector2(4, 4)]),
			frond
		)
