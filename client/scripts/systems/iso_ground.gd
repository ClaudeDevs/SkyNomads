extends Node2D
class_name IsoGround

## Floating sky-island from Kenney "Isometric Landscape" tiles (CC0): grass core
## with a sandy dirt-sided rim. Decorative props (trees/rocks/bushes) are drawn
## in code on the grass so the island feels alive without extra assets.
## Tiles render back-to-front for real isometric depth.

@export var radius: int = 7
@export var tile_scale: float = 0.6

const STEP_X := 66.0
const STEP_Y := 33.0
const DIAMOND_CX := 66.0
const DIAMOND_CY := 33.0

var _grass: Texture2D
var _sand: Texture2D


func _ready() -> void:
	_grass = _try_load("res://assets/sprites/tiles/grass.png")
	_sand = _try_load("res://assets/sprites/tiles/sand.png")
	queue_redraw()


func _try_load(path: String) -> Texture2D:
	if ResourceLoader.exists(path):
		return load(path) as Texture2D
	return null


func _draw() -> void:
	var cells: Array[Vector2i] = []
	for gx in range(-radius, radius + 1):
		for gy in range(-radius, radius + 1):
			cells.append(Vector2i(gx, gy))
	cells.sort_custom(func(a, b): return (a.x + a.y) < (b.x + b.y))
	for c in cells:
		_draw_tile(c)
	_draw_props()


func _ring_texture(distance: int) -> Texture2D:
	if distance >= radius - 1:
		return _sand
	return _grass


func _draw_tile(cell: Vector2i) -> void:
	var center := _cell_to_screen(cell)
	var distance: int = max(abs(cell.x), abs(cell.y))
	var tex := _ring_texture(distance)
	if tex == null:
		_draw_fallback(center, distance)
		return
	var size := tex.get_size() * tile_scale
	var top_left := center - Vector2(DIAMOND_CX * tile_scale, DIAMOND_CY * tile_scale)
	draw_texture_rect(tex, Rect2(top_left, size), false)


func _cell_to_screen(cell: Vector2i) -> Vector2:
	return Vector2(
		(cell.x - cell.y) * STEP_X * tile_scale,
		(cell.x + cell.y) * STEP_Y * tile_scale
	)


# --- Decorative props (drawn back-to-front, on grass) ---

func _draw_props() -> void:
	var props := [
		[Vector2i(-4, -2), "tree"], [Vector2i(3, -3), "tree"], [Vector2i(2, 3), "tree"],
		[Vector2i(0, 4), "tree"], [Vector2i(-3, 3), "rock"], [Vector2i(-2, -4), "rock"],
		[Vector2i(4, 1), "bush"], [Vector2i(4, -4), "bush"], [Vector2i(-4, 4), "bush"],
	]
	props.sort_custom(func(a, b): return (a[0].x + a[0].y) < (b[0].x + b[0].y))
	for p in props:
		var cell: Vector2i = p[0]
		var base := _cell_to_screen(cell)
		draw_colored_polygon(_ellipse(base + Vector2(0, 1), 9.0, 3.5), Color(0, 0, 0, 0.16))
		match p[1]:
			"tree":
				_draw_tree(base)
			"rock":
				_draw_rock(base)
			"bush":
				_draw_bush(base)


func _draw_tree(base: Vector2) -> void:
	draw_rect(Rect2(base.x - 2, base.y - 13, 4, 13), Color(0.45, 0.31, 0.18))
	draw_circle(base + Vector2(0, -15), 11.0, Color(0.18, 0.42, 0.20))
	draw_circle(base + Vector2(0, -21), 8.5, Color(0.24, 0.52, 0.27))
	draw_circle(base + Vector2(-2.5, -24), 5.5, Color(0.33, 0.64, 0.35))


func _draw_rock(base: Vector2) -> void:
	var pts := PackedVector2Array([
		base + Vector2(-9, 0), base + Vector2(-5, -7), base + Vector2(4, -8),
		base + Vector2(9, -2), base + Vector2(6, 2), base + Vector2(-6, 2),
	])
	draw_colored_polygon(pts, Color(0.54, 0.54, 0.60))
	draw_colored_polygon(PackedVector2Array([
		base + Vector2(-5, -7), base + Vector2(4, -8),
		base + Vector2(1, -3), base + Vector2(-3, -3),
	]), Color(0.66, 0.66, 0.71))


func _draw_bush(base: Vector2) -> void:
	draw_circle(base + Vector2(-4, -3), 5.0, Color(0.20, 0.46, 0.23))
	draw_circle(base + Vector2(3, -3), 5.5, Color(0.24, 0.52, 0.27))
	draw_circle(base + Vector2(0, -6), 5.0, Color(0.30, 0.60, 0.32))
	draw_circle(base + Vector2(-2, -5), 1.2, Color(0.86, 0.27, 0.32))
	draw_circle(base + Vector2(3, -4), 1.2, Color(0.86, 0.27, 0.32))


func _draw_fallback(center: Vector2, distance: int) -> void:
	var hw := STEP_X * tile_scale
	var hh := STEP_Y * tile_scale
	var pts := PackedVector2Array([
		center + Vector2(0, -hh), center + Vector2(hw, 0),
		center + Vector2(0, hh), center + Vector2(-hw, 0),
	])
	var color := Color(0.49, 0.74, 0.42)
	if distance >= radius - 1:
		color = Color(0.88, 0.81, 0.58)
	draw_colored_polygon(pts, color)


func _ellipse(center: Vector2, rx: float, ry: float) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in 16:
		var a := TAU * i / 16.0
		pts.append(center + Vector2(cos(a) * rx, sin(a) * ry))
	return pts
