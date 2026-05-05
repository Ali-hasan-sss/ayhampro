export function formatAmount(value: number) {
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(2).replace(/\.?0+$/, "");
}

export function formatCurrency(value: number) {
  return `${formatAmount(value)} ل.س`;
}
