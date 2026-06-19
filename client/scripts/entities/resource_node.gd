class_name ResourceNode
extends Node2D

## Client-side representation of a harvestable node (a fishing spot, a berry
## bush, etc.). Placement and availability are server-authoritative — this node
## is spawned and updated by ResourceManager from server messages, never by the
## client on its own.

@export var node_id: String = ""
@export var node_type: String = "fishing"  # "fishing" | "foraging"

var _available: bool = true


func _ready() -> void:
	add_to_group("resource_nodes")
	_apply_availability()


func is_available() -> bool:
	return _available


func set_available(value: bool) -> void:
	_available = value
	if is_inside_tree():
		_apply_availability()


func _apply_availability() -> void:
	# Dim the node while it's depleted/on cooldown. Swap this for a proper
	# sprite/animation later.
	modulate.a = 1.0 if _available else 0.35
