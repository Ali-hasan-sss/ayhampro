import { getUtcDayBoundsFromTripDateInput } from "@/lib/trip-calendar-date";
import { Trip } from "@/models/Trip";

export async function hasDuplicateTripForDriverCoordinatorDay(params: {
  driverId: string;
  coordinatorId: string;
  dateInput: string;
  excludeTripId?: string;
}) {
  const { start, end } = getUtcDayBoundsFromTripDateInput(params.dateInput);
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
