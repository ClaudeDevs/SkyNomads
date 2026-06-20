class_name Player
extends CharacterBody2D

## Client-side player movement controller for the isometric (2:1) map, plus a
## simple code-drawn character + name/level tag (Kintara-style). Replace the
## _draw character with a real spritesheet later for a polished look.
##
## NOTE (server authority): movement here is PREDICTION only; the authoritative
## result comes from the Nakama movement validator via the shared OP_MOVE_*
## contract. `speed` is sourced from the shared MAX_MOVE_SPEED.

@export var speed: float = NetContract.MAX_MOVE_SPEED
@export var player_name: String = "You"
@export var level: int = 1

const ISO_RATIO: float = 0.5  # tile_height / tile_width = 16 / 32

enum State { IDLE, MOVING, GATHERING }
var _state: State = State.IDLE


func _ready() -> void:
	# Hide the old placeholder diamond; we draw the character ourselves.
	var body := get_node_or_null("Body")
	if body != null:
		body.visible = false

	var gather := get_node_or_null("GatheringComponent")
	if gather != null:
		gather.gather_began.connect(_on_gather_began)
		gather.gather_ended.connect(_on_gather_ended)

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


# --- Rendering: a little character + name/level tag (local space) ---

func _draw() -> void:
	# Soft shadow on the ground.
	draw_colored_polygon(_ellipse(Vector2(0, 1), 8.0, 3.5), Color(0, 0, 0, 0.18))

	# Legs.
	draw_rect(Rect2(-4, -9, 3, 9), Color(0.24, 0.26, 0.34))
	draw_rect(Rect2(1, -9, 3, 9), Color(0.24, 0.26, 0.34))

	# Arms.
	draw_rect(Rect2(-8, -21, 2, 11), Color(0.18, 0.46, 0.80))
	draw_rect(Rect2(6, -21, 2, 11), Color(0.18, 0.46, 0.80))

	# Torso (with a darker side for a bit of shading).
	draw_rect(Rect2(-6, -22, 12, 14), Color(0.20, 0.52, 0.90))
	draw_rect(Rect2(1, -22, 5, 14), Color(0.16, 0.42, 0.75))

	# Head: hair on top, face below, two eyes.
	draw_circle(Vector2(0, -28), 6.2, Color(0.35, 0.22, 0.12))
	draw_circle(Vector2(0, -26), 5.2, Color(0.96, 0.80, 0.64))
	draw_circle(Vector2(-2, -26), 0.9, Color(0.1, 0.1, 0.12))
	draw_circle(Vector2(2, -26), 0.9, Color(0.1, 0.1, 0.12))

	# Name + level tag above the head (outlined for readability).
	var font := ThemeDB.fallback_font
	var text := "Lvl %d  %s" % [level, player_name]
	var pos := Vector2(-60, -40)
	draw_string_outline(font, pos, text, HORIZONTAL_ALIGNMENT_CENTER, 120, 13, 4, Color(0, 0, 0, 0.85))
	draw_string(font, pos, text, HORIZONTAL_ALIGNMENT_CENTER, 120, 13, Color.WHITE)


## Build an ellipse polygon (draw_circle is round-only).
func _ellipse(center: Vector2, rx: float, ry: float) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in 16:
		var a := TAU * i / 16.0
		pts.append(center + Vector2(cos(a) * rx, sin(a) * ry))
	return pts
