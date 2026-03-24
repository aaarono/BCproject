export function formatUsdFromCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function dollarsToCents(amount: number) {
  return Math.round(amount * 100);
}

export function centsToDollarsInput(cents: number) {
  return (cents / 100).toFixed(2);
}
