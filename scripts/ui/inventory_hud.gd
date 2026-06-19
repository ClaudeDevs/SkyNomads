extends Label

## Minimal inventory + wallet display. Listens to GameState (the client cache).
## Placeholder for a real Items/Market panel later.

func _ready() -> void:
	GameState.inventory_changed.connect(func(_i): _render())
	GameState.wallet_changed.connect(func(_c): _render())
	_render()


func _render() -> void:
	var lines: Array[String] = ["Coins: %d" % GameState.coins]
	if GameState.inventory.is_empty():
		lines.append("Inventory: (empty)")
	else:
		lines.append("Inventory:")
		for item_id in GameState.inventory:
			lines.append("  %s x%d" % [item_id, int(GameState.inventory[item_id])])
	text = "\n".join(lines)
