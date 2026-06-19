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

# Gathering / resource nodes
signal nodes_snapshot(nodes: Array)
signal node_state_changed(node_id: String, available: bool)
signal gather_started(node_id: String, duration_ms: int)
signal gather_result(node_id: String, success: bool, item_id: String, quantity: int)
signal gather_cancelled(node_id: String, reason: String)

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
## Returns false (and runs the game offline) if the Nakama addon isn't present.
func connect_to_server(device_id: String = "") -> bool:
	# Resolve the Nakama addon singleton defensively so the project still runs
	# (offline, movement-only) when the addon hasn't been installed yet. Checked
	# first so the web/offline build never touches addon-only or unsupported APIs.
	var nakama := get_node_or_null("/root/Nakama")
	if nakama == null:
		push_warning("Nakama addon not found at /root/Nakama — running offline.")
		return false

	if device_id == "":
		device_id = OS.get_unique_id()

	_client = nakama.create_client(server_key, host, port, scheme)

	_session = await _client.authenticate_device_async(device_id)
	if _session.is_exception():
		push_error("Nakama auth failed: %s" % _session.get_exception().message)
		return false
	local_user_id = _session.user_id

	_socket = nakama.create_socket_from(_client)
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


## Ask the server to gather a resource node. The server decides the outcome.
func send_gather(node_id: String) -> void:
	if _match_id == "" or _socket == null:
		return
	var data := JSON.stringify({ "node_id": node_id })
	_socket.send_match_state_async(_match_id, NetContract.OP_GATHER_REQUEST, data)


## Fetch the player's authoritative inventory from the server (non-realtime RPC).
## Returns a Dictionary of item_id -> quantity, or {} on failure/offline.
func fetch_inventory() -> Dictionary:
	if _client == null or _session == null:
		return {}
	var res = await _client.rpc_async(_session, "get_inventory", "")
	if res.is_exception():
		push_error("get_inventory RPC failed: %s" % res.get_exception().message)
		return {}
	var payload = JSON.parse_string(res.payload)
	if payload == null or not payload.has("items"):
		return {}
	return payload["items"]


## Generic RPC helper. Returns the parsed response Dictionary, or {} on failure.
func call_rpc(rpc_name: String, args: Dictionary = {}) -> Dictionary:
	if _client == null or _session == null:
		return {}
	var body := JSON.stringify(args) if not args.is_empty() else ""
	var res = await _client.rpc_async(_session, rpc_name, body)
	if res.is_exception():
		push_error("%s RPC failed: %s" % [rpc_name, res.get_exception().message])
		return {}
	var payload = JSON.parse_string(res.payload)
	return payload if payload != null else {}


## --- Marketplace (Phase 4) ---

func fetch_wallet() -> int:
	var res := await call_rpc("get_wallet")
	return int(res.get("coins", 0))


func fetch_listings() -> Array:
	var res := await call_rpc("market_listings")
	return res.get("listings", [])


func market_list_item(item_id: String, quantity: int, price: int) -> Dictionary:
	return await call_rpc("market_list_item", {
		"item_id": item_id, "quantity": quantity, "price": price
	})


func market_buy(listing_id: String) -> Dictionary:
	return await call_rpc("market_buy", { "listing_id": listing_id })


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
		NetContract.OP_NODES_SNAPSHOT:
			nodes_snapshot.emit(data["nodes"])
		NetContract.OP_NODE_STATE:
			node_state_changed.emit(data["node_id"], data["available"])
		NetContract.OP_GATHER_STARTED:
			gather_started.emit(data["node_id"], int(data["duration_ms"]))
		NetContract.OP_GATHER_RESULT:
			gather_result.emit(data["node_id"], data["success"], data["item_id"], int(data["quantity"]))
		NetContract.OP_GATHER_CANCELLED:
			gather_cancelled.emit(data["node_id"], data["reason"])
