extends Node2D
class_name IsoGround

## Floating hex sky-island from the Kenney "Hexagon Tiles" pack (CC0).
## Tiles are isometric hexagonal blocks; placement uses the measured top-face
## lattice (center-to-center vectors E1/E2). Trees, rocks and bushes are real
## sprites from the same pack. Everything draws back-to-front for depth.
##
## If a tiny seam/overlap appears, nudge E1_X / E2_X / E2_Y by ±1.

@export var radius: int = 4          # island size in hex rings
@export var tile_scale: float = 1.0

# Hex lattice (center-to-center, in source pixels) measured from the tiles.
const E1_X := 64.0
const E2_X := 32.0
const E2_Y := -41.0
# Top-face centre within the 65x89 source image.
const ANCHOR := Vector2(32.0, 27.0)

var _grass: Texture2D
var _dirt: Texture2D
var _tree: Texture2D
var _tree_tall: Texture2D
var _rock: Texture2D
var _bush: Texture2D
var _flower: Texture2D


func _ready() -> void:
	_grass = _load("res://assets/sprites/hex_grass.png")
	_dirt = _load("res://assets/sprites/hex_dirt.png")
	_tree = _load("res://assets/sprites/tree.png")
	_tree_tall = _load("res://assets/sprites/tree_tall.png")
	_rock = _load("res://assets/sprites/rock.png")
	_bush = _load("res://assets/sprites/bush.png")
	_flower = _load("res://assets/sprites/flower.png")
	queue_redraw()


func _load(path: String) -> Texture2D:
	if ResourceLoader.exists(path):
		return load(path) as Texture2D
	return null


func _hex_to_screen(q: int, r: int) -> Vector2:
	return Vector2(E1_X * q + E2_X * r, E2_Y * r) * tile_scale


func _draw() -> void:
	var cells: Array = []
	for q in range(-radius, radius + 1):
		for r in range(-radius, radius + 1):
			var d: int = (absi(q) + absi(r) + absi(q + r)) / 2
			if d <= radius:
				cells.append(Vector2i(q, r))
	cells.sort_custom(func(a, b): return _hex_to_screen(a.x, a.y).y < _hex_to_screen(b.x, b.y).y)

	for c in cells:
		var pos := _hex_to_screen(c.x, c.y)
		var d: int = (absi(c.x) + absi(c.y) + absi(c.x + c.y)) / 2
		var tex := _dirt if d == radius else _grass
		_draw_tile(tex, pos)

	_draw_props()


func _draw_tile(tex: Texture2D, pos: Vector2) -> void:
	if tex == null:
		return
	var top_left := pos - ANCHOR * tile_scale
	draw_texture_rect(tex, Rect2(top_left, tex.get_size() * tile_scale), false)


func _draw_sprite_at(tex: Texture2D, q: int, r: int) -> void:
	if tex == null:
		return
	var pos := _hex_to_screen(q, r)
	var s := tex.get_size() * tile_scale
	draw_texture_rect(tex, Rect2(pos - Vector2(s.x / 2.0, s.y - 6.0 * tile_scale), s), false)


func _draw_props() -> void:
	var props := [
		[-2, -1, "tree"], [1, -2, "tree_tall"], [2, 0, "tree"],
		[-1, 2, "tree_tall"], [0, 1, "rock"], [-3, 1, "bush"],
		[3, -1, "bush"], [-1, -2, "flower"], [2, 1, "flower"],
	]
	props.sort_custom(func(a, b): return _hex_to_screen(a[0], a[1]).y < _hex_to_screen(b[0], b[1]).y)
	for p in props:
		var q: int = p[0]
		var r: int = p[1]
		match p[2]:
			"tree":
				_draw_sprite_at(_tree, q, r)
			"tree_tall":
				_draw_sprite_at(_tree_tall, q, r)
			"rock":
				_draw_sprite_at(_rock, q, r)
			"bush":
				_draw_sprite_at(_bush, q, r)
			"flower":
				_draw_sprite_at(_flower, q, r)
