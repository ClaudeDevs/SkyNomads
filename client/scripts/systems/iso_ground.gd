extends Node2D
class_name IsoGround

## Draws a floating sky-island from Kenney "Isometric Landscape" tiles (CC0):
## grass interior, sandy beach ring, water rim. Tiles are real textures; if they
## fail to load (e.g. import issue) it falls back to procedural diamonds so the
## build never shows a blank screen.
##
## Tiles render back-to-front so the cubes' sides overlap correctly, giving the
## island real isometric depth.

@export var radius: int = 8
@export var tile_scale: float = 0.6

# Top-diamond geometry of the Kenney landscape tiles (≈132x66 image, 2:1 top).
const STEP_X := 66.0   # half tile-width  (x distance per grid step)
const STEP_Y := 33.0   # half tile-height (y distance per grid step)
const DIAMOND_CX := 66.0  # diamond centre within the source image (x)
const DIAMOND_CY := 33.0  # diamond centre within the source image (y)

var _grass: Texture2D
var _sand: Texture2D
var _water: Texture2D


func _ready() -> void:
	_grass = _try_load("res://assets/sprites/tiles/grass.png")
	_sand = _try_load("res://assets/sprites/tiles/sand.png")
	_water = _try_load("res://assets/sprites/tiles/water.png")
	queue_redraw()


func _try_load(path: String) -> Texture2D:
	if ResourceLoader.exists(path):
		return load(path) as Texture2D  # `as` keeps the declared return type
	return null


func _draw() -> void:
	var cells: Array[Vector2i] = []
	for gx in range(-radius, radius + 1):
		for gy in range(-radius, radius + 1):
			if abs(gx) + abs(gy) <= radius:
				cells.append(Vector2i(gx, gy))
	# Paint back-to-front (smaller gx+gy is further back / higher on screen).
	cells.sort_custom(func(a, b): return (a.x + a.y) < (b.x + b.y))
	for c in cells:
		_draw_tile(c)


func _ring_texture(distance: int) -> Texture2D:
	if distance >= radius:
		return _water
	if distance >= radius - 2:
		return _sand
	return _grass


func _draw_tile(cell: Vector2i) -> void:
	var center := Vector2(
		(cell.x - cell.y) * STEP_X * tile_scale,
		(cell.x + cell.y) * STEP_Y * tile_scale
	)
	var distance: int = abs(cell.x) + abs(cell.y)
	var tex := _ring_texture(distance)
	if tex == null:
		_draw_fallback(center, distance)
		return
	var size := tex.get_size() * tile_scale
	var top_left := center - Vector2(DIAMOND_CX * tile_scale, DIAMOND_CY * tile_scale)
	draw_texture_rect(tex, Rect2(top_left, size), false)


## Procedural diamond used only if the textures didn't load.
func _draw_fallback(center: Vector2, distance: int) -> void:
	var hw := STEP_X * tile_scale
	var hh := STEP_Y * tile_scale
	var pts := PackedVector2Array([
		center + Vector2(0, -hh), center + Vector2(hw, 0),
		center + Vector2(0, hh), center + Vector2(-hw, 0),
	])
	var color := Color(0.49, 0.74, 0.42)
	if distance >= radius:
		color = Color(0.36, 0.62, 0.86)
	elif distance >= radius - 2:
		color = Color(0.88, 0.81, 0.58)
	draw_colored_polygon(pts, color)
