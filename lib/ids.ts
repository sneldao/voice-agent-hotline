/**
 * Deterministic ID generation utilities.
 * Single source of truth for all call/session IDs across the app.
 */

export function generateCallId(): string {
  return `call_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}
