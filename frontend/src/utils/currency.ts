export function formatCurrency(value: string | number): string {
  const amount = Number(value);
  if (Number.isNaN(amount)) return '-';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}
