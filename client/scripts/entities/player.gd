class_name Player
extends CharacterBody2D

## Client-side movement + animated character for the isometric map.
##  - Click-to-move (OSRS/Kintara style) AND WASD/arrows both work.
##  - Walk animation (idle / walk1 / walk2) with left-right facing.
##
## NOTE (server authority): movement is PREDICTION only; the click target just
## changes input. The Nakama validator still checks the resulting movement, so
## click-to-move is cheat-safe with no server change.

@export var speed: float = NetContract.MAX_MOVE_SPEED
@export var player_name: String = "You"
@export var level: int = 1
@export var character_height: float = 56.0
@export var camera_zoom: float = 1.4

const ISO_RATIO := 0.5
const ARRIVE_DIST := 4.0
const WALK_FRAME_TIME := 0.16

enum State { IDLE, MOVING, GATHERING }
var _state: State = State.IDLE

var _tex_idle: Texture2D
var _tex_walk1: Texture2D
var _tex_walk2: Texture2D
var _facing_left := false
var _moving := false
var _walk_t := 0.0
var _walk_frame := 0

var _has_target := false
var _target := Vector2.ZERO


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

	_tex_idle = _load_tex("res://assets/sprites/character.png")
	_tex_walk1 = _load_tex("res://assets/sprites/character_walk1.png")
	_tex_walk2 = _load_tex("res://assets/sprites/character_walk2.png")
	queue_redraw()


func _load_tex(path: String) -> Texture2D:
	if ResourceLoader.exists(path):
		return load(path) as Texture2D
	return null


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.pressed and mb.button_index == MOUSE_BUTTON_LEFT:
			_target = get_global_mouse_position()
			_has_target = true


func _physics_process(delta: float) -> void:
	if _can_move():
		_handle_movement()
	else:
		velocity = Vector2.ZERO
	move_and_slide()
	_update_anim(delta)


func _can_move() -> bool:
	return _state != State.GATHERING


func _handle_movement() -> void:
	# WASD / arrows take priority and cancel any click target.
	var input_dir := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	if input_dir != Vector2.ZERO:
		_has_target = false
		velocity = _cartesian_to_isometric(input_dir).normalized() * speed
		_state = State.MOVING
		return

	# Click-to-move: head straight for the clicked world point.
	if _has_target:
		var to_target := _target - global_position
		if to_target.length() > ARRIVE_DIST:
			velocity = to_target.normalized() * speed
			_state = State.MOVING
			return
		_has_target = false

	velocity = Vector2.ZERO
	_state = State.IDLE


func _cartesian_to_isometric(dir: Vector2) -> Vector2:
	return Vector2(dir.x - dir.y, (dir.x + dir.y) * ISO_RATIO)


func _on_gather_began() -> void:
	_state = State.GATHERING
	_has_target = false


func _on_gather_ended() -> void:
	_state = State.IDLE


# --- Animation ---

func _update_anim(delta: float) -> void:
	var moving := velocity.length() > 1.0
	var redraw := false
	if moving != _moving:
		_moving = moving
		redraw = true
	if moving:
		if velocity.x < -0.1 and not _facing_left:
			_facing_left = true
			redraw = true
		elif velocity.x > 0.1 and _facing_left:
			_facing_left = false
			redraw = true
		_walk_t += delta
		if _walk_t >= WALK_FRAME_TIME:
			_walk_t = 0.0
			_walk_frame = 1 - _walk_frame
			redraw = true
	if redraw:
		queue_redraw()


# --- Rendering (local space; feet at the node origin) ---

func _draw() -> void:
	draw_colored_polygon(_ellipse(Vector2(0, 1), 9.0, 4.0), Color(0, 0, 0, 0.18))
	if _tex_idle != null:
		_draw_sprite()
	else:
		_draw_code_character()
	_draw_nametag()


func _current_tex() -> Texture2D:
	if _moving:
		var w1 := _tex_walk1 if _tex_walk1 != null else _tex_idle
		var w2 := _tex_walk2 if _tex_walk2 != null else _tex_idle
		return w1 if _walk_frame == 0 else w2
	return _tex_idle


func _draw_sprite() -> void:
	var tex := _current_tex()
	if tex == null:
		return
	var ts := tex.get_size()
	if ts.y <= 0.0:
		return
	var sf := character_height / ts.y
	var w := ts.x * sf
	if _facing_left:
		draw_set_transform(Vector2.ZERO, 0.0, Vector2(-1, 1))
	draw_texture_rect(tex, Rect2(-w / 2.0, -character_height, w, character_height), false)
	if _facing_left:
		draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


func _draw_code_character() -> void:
	draw_rect(Rect2(-4, -9, 3, 9), Color(0.24, 0.26, 0.34))
	draw_rect(Rect2(1, -9, 3, 9), Color(0.24, 0.26, 0.34))
	draw_rect(Rect2(-6, -22, 12, 14), Color(0.20, 0.52, 0.90))
	draw_circle(Vector2(0, -26), 5.2, Color(0.96, 0.80, 0.64))


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
