extends Node2D
class_name WorldNet

## Bridges NetworkManager signals <-> the scene tree:
##  - spawns / moves / despawns remote players from server broadcasts
##  - streams the local player's predicted position at NET_SEND_RATE
##  - reconciles the local player when the server rejects a move
##
## Drop this into your world scene. Assign `remote_player_scene` (any Node2D
## that visually represents another player) and point `local_player_path` at
## your local Player node.

@export var remote_player_scene: PackedScene
@export var local_player_path: NodePath

var _remotes: Dictionary = {}   # user_id (String) -> Node2D
var _local_player: Node2D = null
var _send_accum: float = 0.0


func _ready() -> void:
	_local_player = get_node_or_null(local_player_path)

	NetworkManager.player_joined.connect(_on_player_joined)
	NetworkManager.player_moved.connect(_on_player_moved)
	NetworkManager.player_left.connect(_on_player_left)
	NetworkManager.world_snapshot.connect(_on_world_snapshot)
	NetworkManager.move_rejected.connect(_on_move_rejected)


func _physics_process(delta: float) -> void:
	if _local_player == null or NetContract.NET_SEND_RATE <= 0.0:
		return
	_send_accum += delta
	var interval := 1.0 / NetContract.NET_SEND_RATE
	if _send_accum >= interval:
		_send_accum -= interval
		NetworkManager.send_move(_local_player.global_position)


func _spawn_remote(id: String, pos: Vector2) -> Node2D:
	var node: Node2D
	if remote_player_scene != null:
		node = remote_player_scene.instantiate()
	else:
		node = Node2D.new()  # placeholder until art is assigned
	node.global_position = pos
	add_child(node)
	_remotes[id] = node
	return node


func _on_player_joined(id: String, pos: Vector2, _name: String) -> void:
	if not _remotes.has(id):
		_spawn_remote(id, pos)


func _on_player_moved(id: String, pos: Vector2) -> void:
	if _remotes.has(id):
		_remotes[id].global_position = pos
	else:
		_spawn_remote(id, pos)


func _on_player_left(id: String) -> void:
	if _remotes.has(id):
		_remotes[id].queue_free()
		_remotes.erase(id)


func _on_world_snapshot(players: Array) -> void:
	for p in players:
		if p["id"] != NetworkManager.local_user_id and not _remotes.has(p["id"]):
			_spawn_remote(p["id"], Vector2(p["x"], p["y"]))


func _on_move_rejected(authoritative_pos: Vector2) -> void:
	# Server says our prediction was illegal — snap back to truth.
	if _local_player != null:
		_local_player.global_position = authoritative_pos
