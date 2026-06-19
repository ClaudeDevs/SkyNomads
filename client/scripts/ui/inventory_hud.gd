extends Label

## Minimal inventory display. Listens to GameState (the client cache) and lists
## what the player has caught. Placeholder for a real Items panel later.

func _ready() -> void:
	GameState.inventory_changed.connect(_render)
	_render(GameState.inventory)


func _render(items: Dictionary) -> void:
	if items.is_empty():
		text = "Inventory: (empty)"
		return
	var lines: Array[String] = ["Inventory:"]
	for item_id in items:
		lines.append("  %s x%d" % [item_id, int(items[item_id])])
	text = "\n".join(lines)
