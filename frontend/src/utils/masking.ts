export function maskPan(pan: string | null | undefined): string {
  const value = (pan ?? '').trim();
  if (!value) return '-';
  if (value.length <= 4) return value;
  const first = value.slice(0, 2);
  const last = value.slice(-2);
  return `${first}${'•'.repeat(value.length - 4)}${last}`;
}

export function maskAadhaarLastFour(lastFour: string | null | undefined): string {
  const value = (lastFour ?? '').trim();
  if (!value) return '-';
  return `•••• •••• ${value}`;
}
