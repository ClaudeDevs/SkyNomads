extends Node2D
class_name IsoGround

## Floating sky-island from Kenney "Isometric Landscape" tiles (CC0): grass core
## with a sandy dirt-sided rim. No water moat — these are SKY islands. Tiles
## render back-to-front for real isometric depth; procedural fallback if a
## texture fails to load.

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


func _ring_texture(distance: int) -> Texture2D:
	if distance >= radius - 1:
		return _sand   # sandy rim (2 outer rings)
	return _grass


func _draw_tile(cell: Vector2i) -> void:
	var center := Vector2(
		(cell.x - cell.y) * STEP_X * tile_scale,
		(cell.x + cell.y) * STEP_Y * tile_scale
	)
	var distance: int = max(abs(cell.x), abs(cell.y))
	var tex := _ring_texture(distance)
	if tex == null:
		_draw_fallback(center, distance)
		return
	var size := tex.get_size() * tile_scale
	var top_left := center - Vector2(DIAMOND_CX * tile_scale, DIAMOND_CY * tile_scale)
	draw_texture_rect(tex, Rect2(top_left, size), false)


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
