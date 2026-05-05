import { Trip } from "@/models/Trip";

export function getUtcCalendarDayBoundsFromDateInput(dateInput: string) {
  const parsed = new Date(dateInput);
  const y = parsed.getUTCFullYear();
  const m = parsed.getUTCMonth();
  const d = parsed.getUTCDate();
  const start = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, d, 23, 59, 59, 999));
  return { start, end };
}

export async function hasDuplicateTripForDriverCoordinatorDay(params: {
  driverId: string;
  coordinatorId: string;
  dateInput: string;
  excludeTripId?: string;
}) {
  const { start, end } = getUtcCalendarDayBoundsFromDateInput(params.dateInput);
  const query: Record<string, unknown> = {
    driverId: params.driverId,
    coordinatorId: params.coordinatorId,
    date: { $gte: start, $lte: end },
  };
  if (params.excludeTripId) {
    query._id = { $ne: params.excludeTripId };
  }
  const existing = await Trip.findOne(query).select("_id").lean();
  return Boolean(existing);
}
