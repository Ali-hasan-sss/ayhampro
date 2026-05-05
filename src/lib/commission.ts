export type CommissionType = "percentage" | "fixed";

export function calculateCommission(
  commissionType: CommissionType,
  commissionValue: number,
  tripsCount: number,
  totalAmount: number,
) {
  if (commissionType === "percentage") {
    return Number(((totalAmount * commissionValue) / 100).toFixed(2));
  }
  return Number((commissionValue * tripsCount).toFixed(2));
}
