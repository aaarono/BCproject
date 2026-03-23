const DEFAULT_TIMEOUT_HOURS = 24;
const MIN_TIMEOUT_HOURS = 1;
const MAX_TIMEOUT_HOURS = 24 * 14;

export function getDealTimeoutHours() {
  const raw = process.env.DEAL_TIMEOUT_HOURS;
  const parsed = Number(raw);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_TIMEOUT_HOURS;
  }

  return Math.min(
    MAX_TIMEOUT_HOURS,
    Math.max(MIN_TIMEOUT_HOURS, Math.floor(parsed)),
  );
}

export function getDealExpiresAt(from = new Date()) {
  const timeoutHours = getDealTimeoutHours();
  return new Date(from.getTime() + timeoutHours * 60 * 60 * 1000);
}

export function isDealTimeoutEnabled() {
  return process.env.DEAL_TIMEOUT_ENABLED !== 'false';
}
