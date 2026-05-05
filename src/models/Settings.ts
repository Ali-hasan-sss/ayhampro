import { Schema, model, models } from "mongoose";

const settingsSchema = new Schema(
  {
    commissionType: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "percentage",
      required: true,
    },
    commissionValue: { type: Number, default: 7, required: true, min: 0 },
    adminPassword: { type: String, required: true },
    companyName: { type: String, default: "Taxi Company" },
  },
  { timestamps: true },
);

export const Settings = models.Settings || model("Settings", settingsSchema);
