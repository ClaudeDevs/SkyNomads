class_name Player
extends CharacterBody2D

## Client-side movement + character rendering for the isometric (2:1) map.
##
## Character art: if `client/assets/sprites/character.png` exists it is drawn
## (bottom-centred on the body); otherwise a simple code-drawn character is used.
## A name/level tag floats above either. Camera zooms in for a game-like framing.
##
## NOTE (server authority): movement here is PREDICTION only; the authoritative
## result comes from the Nakama movement validator (shared OP_MOVE_*). `speed`
## is sourced from the shared MAX_MOVE_SPEED.

@export var speed: float = NetContract.MAX_MOVE_SPEED
@export var player_name: String = "You"
@export var level: int = 1
@export var character_texture_path: String = "res://assets/sprites/character.png"
@export var character_height: float = 56.0  # on-screen height in px
@export var camera_zoom: float = 1.4

const ISO_RATIO: float = 0.5  # tile_height / tile_width = 16 / 32

enum State { IDLE, MOVING, GATHERING }
var _state: State = State.IDLE
var _char_tex: Texture2D


func _ready() -> void:
	var body := get_node_or_null("Body")
	if body != null:
		body.visible = false

	var cam := get_node_or_null("Camera2D")
	if cam != null:
		cam.zoom = Vector2(camera_zoom, camera_zoom)

	var gather := get_node_or_null("GatheringComponent")
	if gather != null:
		gather.gather_began.connect(_on_gather_began)
		gather.gather_ended.connect(_on_gather_ended)

	if ResourceLoader.exists(character_texture_path):
		_char_tex = load(character_texture_path) as Texture2D

	queue_redraw()


func _physics_process(_delta: float) -> void:
	if _can_move():
		_handle_movement()
	else:
		velocity = Vector2.ZERO
	move_and_slide()


func _can_move() -> bool:
	return _state != State.GATHERING


func _handle_movement() -> void:
	var input_dir := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	if input_dir == Vector2.ZERO:
		velocity = Vector2.ZERO
		_state = State.IDLE
		return
	velocity = _cartesian_to_isometric(input_dir).normalized() * speed
	_state = State.MOVING


func _cartesian_to_isometric(dir: Vector2) -> Vector2:
	return Vector2(dir.x - dir.y, (dir.x + dir.y) * ISO_RATIO)


func _on_gather_began() -> void:
	_state = State.GATHERING


func _on_gather_ended() -> void:
	_state = State.IDLE


# --- Rendering (local space; feet at the node origin) ---

func _draw() -> void:
	draw_colored_polygon(_ellipse(Vector2(0, 1), 9.0, 4.0), Color(0, 0, 0, 0.18))
	if _char_tex != null:
		_draw_sprite()
	else:
		_draw_code_character()
	_draw_nametag()


func _draw_sprite() -> void:
	var tex_size := _char_tex.get_size()
	if tex_size.y <= 0.0:
		return
	var scale_factor := character_height / tex_size.y
	var w := tex_size.x * scale_factor
	draw_texture_rect(_char_tex, Rect2(-w / 2.0, -character_height, w, character_height), false)


func _draw_code_character() -> void:
	draw_rect(Rect2(-4, -9, 3, 9), Color(0.24, 0.26, 0.34))
	draw_rect(Rect2(1, -9, 3, 9), Color(0.24, 0.26, 0.34))
	draw_rect(Rect2(-8, -21, 2, 11), Color(0.18, 0.46, 0.80))
	draw_rect(Rect2(6, -21, 2, 11), Color(0.18, 0.46, 0.80))
	draw_rect(Rect2(-6, -22, 12, 14), Color(0.20, 0.52, 0.90))
	draw_rect(Rect2(1, -22, 5, 14), Color(0.16, 0.42, 0.75))
	draw_circle(Vector2(0, -28), 6.2, Color(0.35, 0.22, 0.12))
	draw_circle(Vector2(0, -26), 5.2, Color(0.96, 0.80, 0.64))
	draw_circle(Vector2(-2, -26), 0.9, Color(0.1, 0.1, 0.12))
	draw_circle(Vector2(2, -26), 0.9, Color(0.1, 0.1, 0.12))


func _draw_nametag() -> void:
	var font := ThemeDB.fallback_font
	var text := "Lvl %d  %s" % [level, player_name]
	var pos := Vector2(-60, -character_height - 6.0)
	draw_string_outline(font, pos, text, HORIZONTAL_ALIGNMENT_CENTER, 120, 13, 4, Color(0, 0, 0, 0.85))
	draw_string(font, pos, text, HORIZONTAL_ALIGNMENT_CENTER, 120, 13, Color.WHITE)


func _ellipse(center: Vector2, rx: float, ry: float) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in 16:
		var a := TAU * i / 16.0
		pts.append(center + Vector2(cos(a) * rx, sin(a) * ry))
	return pts
