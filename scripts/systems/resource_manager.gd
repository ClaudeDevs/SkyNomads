extends Node2D
class_name ResourceManager

## Spawns resource nodes from the server's snapshot and keeps their availability
## in sync with OP_NODE_STATE broadcasts. The server is the source of truth for
## where nodes are and whether they can be gathered.
##
## Assign `resource_node_scene` to a scene whose root script is ResourceNode.

@export var resource_node_scene: PackedScene

var _nodes: Dictionary = {}  # node_id (String) -> ResourceNode


func _ready() -> void:
	NetworkManager.nodes_snapshot.connect(_on_nodes_snapshot)
	NetworkManager.node_state_changed.connect(_on_node_state_changed)


func _on_nodes_snapshot(nodes: Array) -> void:
	for n in nodes:
		_spawn(n["id"], n["type"], Vector2(n["x"], n["y"]), n["available"])


func _spawn(id: String, type: String, pos: Vector2, available: bool) -> void:
	if _nodes.has(id):
		return
	var node: ResourceNode
	if resource_node_scene != null:
		node = resource_node_scene.instantiate()
	else:
		node = ResourceNode.new()  # placeholder until a scene is assigned
	node.node_id = id
	node.node_type = type
	add_child(node)
	node.global_position = pos
	node.set_available(available)
	_nodes[id] = node


func _on_node_state_changed(node_id: String, available: bool) -> void:
	if _nodes.has(node_id):
		_nodes[node_id].set_available(available)
