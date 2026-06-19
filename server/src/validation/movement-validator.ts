// Pure, framework-free movement validator. No Nakama imports here so it stays
// trivially unit-testable (see CLAUDE.md §9). This is the authority: the client
// only ever *predicts*; this function decides what actually happened.

export interface Vec2 {
  x: number;
  y: number;
}

export interface MoveValidationResult {
  /** Whether the requested position is accepted as authoritative. */
  valid: boolean;
  /** Accepted position: the request if valid, otherwise the previous position. */
  position: Vec2;
  /** Machine-readable reason when rejected. */
  reason?: "too_fast" | "non_finite";
}

/**
 * Validate a requested position against the previous authoritative position.
 *
 * A move is rejected if it implies a speed faster than `maxSpeed` over the
 * elapsed time (plus a tolerance to absorb jitter), or if it contains
 * non-finite numbers (a malformed / malicious client).
 */
export function validateMove(
  previous: Vec2,
  requested: Vec2,
  elapsedSeconds: number,
  maxSpeed: number,
  tolerance = 0,
): MoveValidationResult {
  if (!isFiniteVec(requested)) {
    return { valid: false, position: previous, reason: "non_finite" };
  }

  // Guard against zero/negative elapsed time (same-tick duplicate messages).
  const dt = Math.max(elapsedSeconds, 0);
  const maxDistance = maxSpeed * dt + tolerance;

  const dx = requested.x - previous.x;
  const dy = requested.y - previous.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance > maxDistance) {
    return { valid: false, position: previous, reason: "too_fast" };
  }

  return { valid: true, position: requested };
}

function isFiniteVec(v: Vec2): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y);
}
