class_name Player
extends CharacterBody2D

## Client-side player movement controller for the isometric (2:1) map.
##
## NOTE (server authority): this script is PREDICTION only. It moves the body
## locally for responsiveness. The authoritative result must come from the
## Nakama movement validator via the shared OP_MOVE_* contract. `speed` should
## eventually be sourced from shared/constants (e.g. MAX_MOVE_SPEED) so the
## client cannot out-run what the server will accept.

## Screen-space movement speed in pixels/second.
## Sourced from the shared contract so the client can never predict faster than
## the server will accept (server validates against the same MAX_MOVE_SPEED).
@export var speed: float = NetContract.MAX_MOVE_SPEED

## Tile is 32x16, so the isometric basis has a 2:1 (height:width) ratio.
## A cartesian input is squashed on Y by this factor to follow the tile axes.
const ISO_RATIO: float = 0.5  # tile_height / tile_width = 16.0 / 32.0

## Player states. GATHERING is wired now so the core-loop logic can flip into
## it later (lock movement, run the gather timer/anim) without touching the
## movement code below — just set `_state = State.GATHERING`.
enum State { IDLE, MOVING, GATHERING }

var _state: State = State.IDLE


func _physics_process(_delta: float) -> void:
	if _can_move():
		_handle_movement()
	else:
		# States like GATHERING freeze the body; the owning system controls
		# when to return to IDLE.
		velocity = Vector2.ZERO

	move_and_slide()


## True while the current state permits player-driven movement.
## Extend the guard as new states are added.
func _can_move() -> bool:
	return _state != State.GATHERING


func _handle_movement() -> void:
	# Cartesian intent: x = left/right, y = up/down (up is negative).
	var input_dir := Input.get_vector(
		"move_left", "move_right", "move_up", "move_down"
	)

	if input_dir == Vector2.ZERO:
		velocity = Vector2.ZERO
		_state = State.IDLE
		return

	# Project cartesian intent onto the isometric axes, then normalize so the
	# on-screen speed is constant in every direction.
	velocity = _cartesian_to_isometric(input_dir).normalized() * speed
	_state = State.MOVING


## Maps a cartesian input direction to an isometric screen direction.
## Result: Up -> up-right, Right -> down-right, Down -> down-left, Left -> up-left,
## i.e. each key travels along a tile axis rather than straight across the screen.
func _cartesian_to_isometric(dir: Vector2) -> Vector2:
	return Vector2(dir.x - dir.y, (dir.x + dir.y) * ISO_RATIO)
