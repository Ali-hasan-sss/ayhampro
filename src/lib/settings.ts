import { Settings } from "@/models/Settings";
import { hashPassword } from "@/lib/auth";

export async function getOrCreateSettings() {
  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create({
      commissionType: "percentage",
      commissionValue: 10,
      adminPassword: await hashPassword("admin123"),
      companyName: "Taxi Company",
    });
  }
  return settings;
}
