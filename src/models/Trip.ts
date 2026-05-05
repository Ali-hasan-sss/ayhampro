import { Schema, model, models } from "mongoose";

const tripSchema = new Schema(
  {
    driverId: { type: Schema.Types.ObjectId, ref: "Driver", required: true },
    coordinatorId: { type: Schema.Types.ObjectId, ref: "Driver", required: true },
    date: { type: Date, required: true },
    tripsCount: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    discount: { type: Number, required: true, min: 0, default: 0 },
    commission: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

// In dev hot-reload, ensure schema updates (like coordinatorId) are applied.
if (models.Trip) {
  delete models.Trip;
}

export const Trip = model("Trip", tripSchema);
