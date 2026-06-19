// Pure soft-currency helpers. A wallet is just a coin balance. Server-only logic
// (clients never write their balance). This is the in-game currency that a later
// phase could bridge to crypto — but the authority pattern stays identical.

export const STARTER_COINS = 100;

/** Add coins (ignores non-positive amounts). */
export function addCoins(balance: number, amount: number): number {
  return amount > 0 ? balance + amount : balance;
}

/** Whether the balance can cover `amount`. */
export function canAfford(balance: number, amount: number): boolean {
  return amount >= 0 && balance >= amount;
}

/** Subtract coins; returns the same balance if it can't be afforded. */
export function subCoins(balance: number, amount: number): number {
  return canAfford(balance, amount) ? balance - amount : balance;
}
