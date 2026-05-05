export type Driver = {
  _id: string;
  name: string;
  phone: string;
  role: "driver" | "coordinator";
  notes: string;
};

export type Trip = {
  _id: string;
  driverId: Driver;
  coordinatorId: Driver;
  date: string;
  tripsCount: number;
  totalAmount: number;
  discount?: number;
  commission: number;
};
