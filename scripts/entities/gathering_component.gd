class_name GatheringComponent
extends Node

## Reusable component (child of Player). Captures the interact action, asks the
## server to gather the nearest in-range node, and drives the gather UX. The
## server owns the outcome — this only predicts the "casting" state and reacts
## to the authoritative result.
##
## Wiring (per CLAUDE.md §5: children emit up, parents call down):
##   - emits `gather_began` / `gather_ended` so Player can lock/unlock movement
##   - emits `status_changed(text)` for a HUD to display ("Line out…", "Caught…")
##
## Reads the parent's position to find the nearest node (reaching to the parent
## is allowed; reaching across siblings is not).

signal gather_began
signal gather_ended
signal status_changed(text: String)

@export var interact_action: StringName = &"interact"

var _busy: bool = false
var _active_node: ResourceNode = null


func _ready() -> void:
	NetworkManager.gather_started.connect(_on_gather_started)
	NetworkManager.gather_result.connect(_on_gather_result)
	NetworkManager.gather_cancelled.connect(_on_gather_cancelled)


func _unhandled_input(event: InputEvent) -> void:
	if _busy:
		return
	if event.is_action_pressed(interact_action):
		_try_gather()


func _try_gather() -> void:
	var node := _nearest_node()
	if node == null:
		return
	_active_node = node
	_busy = true
	NetworkManager.send_gather(node.node_id)
	# Optimistic: lock movement and show a casting state; the server confirms
	# with gather_started or aborts with gather_cancelled.
	gather_began.emit()
	status_changed.emit("Casting...")


func _nearest_node() -> ResourceNode:
	var parent := get_parent() as Node2D
	if parent == null:
		return null
	var origin := parent.global_position
	var best: ResourceNode = null
	var best_distance := NetContract.GATHER_RANGE
	for n in get_tree().get_nodes_in_group("resource_nodes"):
		var rn := n as ResourceNode
		if rn == null or not rn.is_available():
			continue
		var d := origin.distance_to(rn.global_position)
		if d <= best_distance:
			best_distance = d
			best = rn
	return best


func _on_gather_started(node_id: String, _duration_ms: int) -> void:
	if not _is_active(node_id):
		return
	match _active_node.node_type:
		"fishing":
			status_changed.emit("Line out — wait for a bite...")
		_:
			status_changed.emit("Gathering...")


func _on_gather_result(node_id: String, success: bool, item_id: String, quantity: int) -> void:
	if not _is_active(node_id):
		return
	if success:
		status_changed.emit("Caught %d x %s!" % [quantity, item_id])
	else:
		status_changed.emit("It got away...")
	_finish()


func _on_gather_cancelled(node_id: String, reason: String) -> void:
	if not _busy:
		return
	# Accept cancels for the active node (or when we have no node id match yet).
	if _active_node != null and _active_node.node_id != node_id:
		return
	status_changed.emit("Cancelled (%s)" % reason)
	_finish()


func _is_active(node_id: String) -> bool:
	return _busy and _active_node != null and _active_node.node_id == node_id


func _finish() -> void:
	_busy = false
	_active_node = null
	gather_ended.emit()
