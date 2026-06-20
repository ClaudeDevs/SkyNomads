extends Node2D

## World bootstrap: connects to the backend on launch and routes the local
## player's gather status to the HUD. If the Nakama addon/backend isn't set up,
## the game still runs offline so you can test movement.

@onready var _status: Label = $HUD/Status
@onready var _player: Node2D = $Player


func _ready() -> void:
	var gather := _player.get_node_or_null("GatheringComponent")
	if gather != null:
		gather.status_changed.connect(_on_status_changed)

	_status.text = "Connecting..."
	await _connect()


func _connect() -> void:
	var connected: bool = await NetworkManager.connect_to_server()
	if not connected:
		_status.text = "Offline — click to move. (Start the backend to fish.)"
		return

	var joined: bool = await NetworkManager.join_island()
	if not joined:
		_status.text = "Connected, but couldn't join the world."
		return

	_status.text = "Online — click to move. Press B for build mode."


func _on_status_changed(text: String) -> void:
	_status.text = text
