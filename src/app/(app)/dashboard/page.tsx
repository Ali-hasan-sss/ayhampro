"use client";

import { useEffect, useState } from "react";
import { MetricCard } from "@/components/metric-card";
import { formatCurrency } from "@/lib/format";

type DashboardData = {
  driversCount: number;
  todayTrips: number;
  todayRevenue: number;
  todayCommission: number;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({
    driversCount: 0,
    todayTrips: 0,
    todayRevenue: 0,
    todayCommission: 0,
  });

  useEffect(() => {
    async function load() {
      const [driversRes, reportsRes] = await Promise.all([
        fetch("/api/drivers"),
        fetch("/api/reports?period=daily"),
      ]);
      const drivers = await driversRes.json();
      const reports = await reportsRes.json();
      setData({
        driversCount: drivers.length,
        todayTrips: reports.totals.totalTrips ?? 0,
        todayRevenue: reports.totals.totalRevenue ?? 0,
        todayCommission: reports.totals.totalCommission ?? 0,
      });
    }
    load();
  }, []);

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard title="عدد السائقين" value={data.driversCount} />
      <MetricCard title="طلبات اليوم" value={data.todayTrips} />
      <MetricCard title="إيرادات اليوم" value={formatCurrency(data.todayRevenue)} />
      <MetricCard title="عمولة اليوم" value={formatCurrency(data.todayCommission)} />
    </section>
  );
}
