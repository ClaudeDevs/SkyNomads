// Pure gather validator. Decides whether a gather *request* is legal, against
// authoritative state. No Nakama imports — trivially unit-testable.

export interface GatherPlayerState {
  x: number;
  y: number;
  isGathering: boolean;
}

export interface GatherNodeState {
  x: number;
  y: number;
  available: boolean;
}

export type GatherRejectReason = "unknown_node" | "busy" | "on_cooldown" | "too_far";

export interface GatherValidationResult {
  valid: boolean;
  reason?: GatherRejectReason;
}

/**
 * Validate a gather attempt. The node may be null when the client names an id
 * the server doesn't know about (a malformed or malicious request).
 */
export function validateGather(
  player: GatherPlayerState,
  node: GatherNodeState | null,
  range: number,
): GatherValidationResult {
  if (node === null) {
    return { valid: false, reason: "unknown_node" };
  }
  if (player.isGathering) {
    return { valid: false, reason: "busy" };
  }
  if (!node.available) {
    return { valid: false, reason: "on_cooldown" };
  }

  const dx = player.x - node.x;
  const dy = player.y - node.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance > range) {
    return { valid: false, reason: "too_far" };
  }

  return { valid: true };
}
