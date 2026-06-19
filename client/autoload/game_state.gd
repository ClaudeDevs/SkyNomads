extends Node

## Autoload: client-side cache of server-confirmed state (CLAUDE.md §6).
## This is NOT authoritative — it's a read-mostly mirror of what the server last
## told us. The server's storage is the source of truth; we fetch a fresh copy
## on join and apply gather results optimistically in between.

signal inventory_changed(items: Dictionary)

var inventory: Dictionary = {}  # item_id (String) -> quantity (int)


func _ready() -> void:
	NetworkManager.world_joined.connect(_on_world_joined)
	NetworkManager.gather_result.connect(_on_gather_result)


func _on_world_joined() -> void:
	await refresh_inventory()


## Pull the authoritative inventory from the server and replace our cache.
func refresh_inventory() -> void:
	var items := await NetworkManager.fetch_inventory()
	inventory = items
	inventory_changed.emit(inventory)


func _on_gather_result(_node_id: String, success: bool, item_id: String, quantity: int) -> void:
	# Optimistically apply the catch the server just confirmed. (Authoritative
	# truth is in storage; a future refresh would reconcile any drift.)
	if success and item_id != "":
		inventory[item_id] = int(inventory.get(item_id, 0)) + quantity
		inventory_changed.emit(inventory)
