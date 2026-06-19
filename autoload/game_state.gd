extends Node

## Autoload: client-side cache of server-confirmed state (CLAUDE.md §6).
## NOT authoritative — a read-mostly mirror of what the server last told us.
## The server's storage is the source of truth; we fetch fresh copies on join
## and apply confirmed results optimistically in between.

signal inventory_changed(items: Dictionary)
signal wallet_changed(coins: int)

var inventory: Dictionary = {}  # item_id -> quantity
var coins: int = 0


func _ready() -> void:
	NetworkManager.world_joined.connect(_on_world_joined)
	NetworkManager.gather_result.connect(_on_gather_result)


func _on_world_joined() -> void:
	await refresh_inventory()
	await refresh_wallet()


func refresh_inventory() -> void:
	inventory = await NetworkManager.fetch_inventory()
	inventory_changed.emit(inventory)


func refresh_wallet() -> void:
	coins = await NetworkManager.fetch_wallet()
	wallet_changed.emit(coins)


## List an item for sale, then refresh from the server (inventory shrank).
func list_item(item_id: String, quantity: int, price: int) -> Dictionary:
	var result := await NetworkManager.market_list_item(item_id, quantity, price)
	if result.get("ok", false):
		await refresh_inventory()
	return result


## Buy a listing, then refresh (coins + inventory changed).
func buy_listing(listing_id: String) -> Dictionary:
	var result := await NetworkManager.market_buy(listing_id)
	if result.get("ok", false):
		await refresh_inventory()
		await refresh_wallet()
	return result


func _on_gather_result(_node_id: String, success: bool, item_id: String, quantity: int) -> void:
	if success and item_id != "":
		inventory[item_id] = int(inventory.get(item_id, 0)) + quantity
		inventory_changed.emit(inventory)
