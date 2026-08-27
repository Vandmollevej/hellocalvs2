// Minimal in-memory brute-force guard for the admin login/verify endpoints.
// The app runs as a single Node process (docs/DEPLOYMENT.md), so a
// process-local Map is sufficient here — this is not meant to replace a
// shared store in a multi-instance deployment.
const attempts = new Map<string, { count: number; lockedUntil: number }>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export function isLocked(key: string) {
  const entry = attempts.get(key);
  return Boolean(entry && entry.lockedUntil > Date.now());
}

export function recordFailure(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.lockedUntil < now - WINDOW_MS) {
    attempts.set(key, { count: 1, lockedUntil: 0 });
    return;
  }
  const count = entry.count + 1;
  attempts.set(key, { count, lockedUntil: count >= MAX_ATTEMPTS ? now + WINDOW_MS : 0 });
}

export function recordSuccess(key: string) {
  attempts.delete(key);
}
