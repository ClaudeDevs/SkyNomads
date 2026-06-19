extends Node

## Autoload: Nakama socket lifecycle + match-data send/receive + opcode dispatch.
##
## Plumbing only (CLAUDE.md §6) — NO gameplay logic lives here. It authenticates,
## joins the authoritative world match, sends the local player's predicted
## position, and re-emits incoming match data as typed signals that gameplay
## systems (e.g. WorldNet) consume.
##
## Requires the Nakama Godot client addon:
##   https://github.com/heroiclabs/nakama-godot  (provides the `Nakama` singleton)

signal connected
signal world_joined
signal player_joined(id: String, pos: Vector2, name: String)
signal player_moved(id: String, pos: Vector2)
signal player_left(id: String)
signal world_snapshot(players: Array)
signal move_rejected(authoritative_pos: Vector2)

@export var host: String = "127.0.0.1"
@export var port: int = 7350
@export var server_key: String = "defaultkey"
@export var scheme: String = "http"

var local_user_id: String = ""

# Untyped to avoid hard parse-time coupling before the Nakama addon is present.
var _client
var _session
var _socket
var _match_id: String = ""


## Authenticate and open the realtime socket. Returns true on success.
func connect_to_server(device_id: String = "") -> bool:
	if device_id == "":
		device_id = OS.get_unique_id()

	_client = Nakama.create_client(server_key, host, port, scheme)

	_session = await _client.authenticate_device_async(device_id)
	if _session.is_exception():
		push_error("Nakama auth failed: %s" % _session.get_exception().message)
		return false
	local_user_id = _session.user_id

	_socket = Nakama.create_socket_from(_client)
	var result = await _socket.connect_async(_session)
	if result.is_exception():
		push_error("Nakama socket connect failed: %s" % result.get_exception().message)
		return false

	_socket.received_match_state.connect(_on_match_state)
	connected.emit()
	return true


## Find/create the shared world match via RPC, then join it.
func join_world() -> bool:
	var rpc_result = await _client.rpc_async(_session, "find_world_match", "")
	if rpc_result.is_exception():
		push_error("find_world_match RPC failed: %s" % rpc_result.get_exception().message)
		return false

	var payload = JSON.parse_string(rpc_result.payload)
	if payload == null or not payload.has("match_id"):
		push_error("find_world_match returned no match_id")
		return false
	_match_id = payload["match_id"]

	var match_result = await _socket.join_match_async(_match_id)
	if match_result.is_exception():
		push_error("join_match failed: %s" % match_result.get_exception().message)
		return false

	world_joined.emit()
	return true


## Send the local player's predicted position for server validation.
func send_move(pos: Vector2) -> void:
	if _match_id == "" or _socket == null:
		return
	var data := JSON.stringify({ "x": pos.x, "y": pos.y })
	_socket.send_match_state_async(_match_id, NetContract.OP_MOVE_REQUEST, data)


func _on_match_state(state) -> void:
	var data = JSON.parse_string(state.data) if state.data != "" else {}
	if data == null:
		return

	match state.op_code:
		NetContract.OP_MOVE_BROADCAST:
			if data["id"] == local_user_id:
				return  # ignore our own authoritative echo
			player_moved.emit(data["id"], Vector2(data["x"], data["y"]))
		NetContract.OP_PLAYER_JOINED:
			if data["id"] == local_user_id:
				return
			player_joined.emit(data["id"], Vector2(data["x"], data["y"]), data.get("name", ""))
		NetContract.OP_PLAYER_LEFT:
			player_left.emit(data["id"])
		NetContract.OP_WORLD_SNAPSHOT:
			world_snapshot.emit(data["players"])
		NetContract.OP_MOVE_REJECTED:
			move_rejected.emit(Vector2(data["x"], data["y"]))
