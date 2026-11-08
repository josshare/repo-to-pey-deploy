export function remainingSeconds(expiresAt: string, now: number) {
  const expiry = Date.parse(expiresAt);
  return Number.isFinite(expiry) ? Math.max(0, Math.ceil((expiry - now) / 1000)) : 0;
}

export function newPaymentIds(previous: Set<string>, current: string[]) {
  return current.filter(id => !previous.has(id));
}