import { connectToDatabase } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
import { Driver } from "../src/models/Driver";
import { Trip } from "../src/models/Trip";
import { Settings } from "../src/models/Settings";
import { calculateCommission } from "../src/lib/commission";

async function runSeed() {
  await connectToDatabase();

  await Promise.all([Driver.deleteMany({}), Trip.deleteMany({}), Settings.deleteMany({})]);

  const settings = await Settings.create({
    commissionType: "percentage",
    commissionValue: 12,
    adminPassword: await hashPassword("admin123"),
    companyName: "Taxi Company",
  });

  const drivers = await Driver.insertMany([
    { name: "أحمد علي", phone: "050000001", role: "driver", notes: "دوام صباحي" },
    { name: "سعيد محمد", phone: "050000002", role: "driver", notes: "دوام مسائي" },
    { name: "خالد فهد", phone: "050000003", role: "coordinator", notes: "" },
    { name: "وليد ناصر", phone: "050000004", role: "coordinator", notes: "" },
  ]);

  const today = new Date();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  await Trip.insertMany([
    {
      driverId: drivers[0]._id,
      coordinatorId: drivers[2]._id,
      date: today,
      tripsCount: 10,
      totalAmount: 450,
      commission: calculateCommission("percentage", settings.commissionValue, 10, 450),
    },
    {
      driverId: drivers[1]._id,
      coordinatorId: drivers[2]._id,
      date: today,
      tripsCount: 8,
      totalAmount: 360,
      commission: calculateCommission("percentage", settings.commissionValue, 8, 360),
    },
    {
      driverId: drivers[0]._id,
      coordinatorId: drivers[3]._id,
      date: today,
      tripsCount: 4,
      totalAmount: 190,
      commission: calculateCommission("percentage", settings.commissionValue, 4, 190),
    },
    {
      driverId: drivers[0]._id,
      coordinatorId: drivers[2]._id,
      date: yesterday,
      tripsCount: 11,
      totalAmount: 510,
      commission: calculateCommission("percentage", settings.commissionValue, 11, 510),
    },
  ]);

  console.log("Seed completed.");
  process.exit(0);
}

runSeed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
