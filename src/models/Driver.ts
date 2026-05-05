import { Schema, model, models } from "mongoose";

export type DriverRole = "driver" | "coordinator";

const driverSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, default: "" },
    role: {
      type: String,
      enum: ["driver", "coordinator"],
      required: true,
      default: "driver",
    },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

export const Driver = models.Driver || model("Driver", driverSchema);
