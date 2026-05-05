"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import * as XLSX from "xlsx-js-style";
import { MetricCard } from "@/components/metric-card";
import { formatCurrency } from "@/lib/format";

type ReportData = {
  totals: {
    totalTrips: number;
    totalRevenue: number;
    totalDiscount: number;
    totalCommission: number;
  };
  byDriver: {
    driverId: string;
    driverName: string;
    tripsCount: number;
    totalAmount: number;
    discount: number;
    commission: number;
  }[];
  byCoordinator: {
    coordinatorName: string;
    tripsCount: number;
    totalAmount: number;
    discount: number;
    commission: number;
  }[];
};

export default function ReportsPage() {
  const [period, setPeriod] = useState("daily");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [driverSearch, setDriverSearch] = useState("");
  const [coordinatorSearch, setCoordinatorSearch] = useState("");
  const [report, setReport] = useState<ReportData>({
    totals: { totalTrips: 0, totalRevenue: 0, totalDiscount: 0, totalCommission: 0 },
    byDriver: [],
    byCoordinator: [],
  });

  const toDateInputValue = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const getCurrentMonthBounds = () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      from: toDateInputValue(monthStart),
      to: toDateInputValue(monthEnd),
    };
  };

  useEffect(() => {
    if (period === "daily") {
      const todayValue = toDateInputValue(new Date());
      setFrom(todayValue);
      setTo(todayValue);
      return;
    }

    if (period === "weekly" || period === "monthly") {
      const monthBounds = getCurrentMonthBounds();
      setFrom(monthBounds.from);
      setTo(monthBounds.to);
      return;
    }

    if (period === "all") {
      setFrom("");
      setTo("");
    }
  }, [period]);

  useEffect(() => {
    const params = new URLSearchParams({ period });
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    void fetch(`/api/reports?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => setReport(data));
  }, [period, from, to]);

  const filteredDrivers = report.byDriver.filter((row) =>
    row.driverName.toLowerCase().includes(driverSearch.toLowerCase()),
  );
  const filteredCoordinators = report.byCoordinator.filter((row) =>
    row.coordinatorName.toLowerCase().includes(coordinatorSearch.toLowerCase()),
  );
  const todayLabel = toDateInputValue(new Date());
  const monthlyBounds = getCurrentMonthBounds();
  const effectiveFrom =
    from ||
    (period === "daily" ? todayLabel : period === "weekly" || period === "monthly" ? monthlyBounds.from : "");
  const effectiveTo =
    to ||
    (period === "daily" ? todayLabel : period === "weekly" || period === "monthly" ? monthlyBounds.to : "");

  const exportReportsToExcel = () => {
    const periodLabels: Record<string, string> = {
      daily: "يومي",
      weekly: "أسبوعي",
      monthly: "شهري",
      all: "كل الفترات",
    };
    const periodLabel = periodLabels[period] ?? period;
    const fromLabel = effectiveFrom || "غير محدد";
    const toLabel = effectiveTo || "غير محدد";

    const workbook = XLSX.utils.book_new();
    const buildBorder = () => ({
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } },
    });
    const applySheetStyling = (sheet: XLSX.WorkSheet, rowCount: number) => {
      const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:E5");
      const border = buildBorder();
      const titleRows = new Set([0, 1, 2]);
      const headerRow = 4;
      const firstDataRow = 5;
      const lastDataRow = firstDataRow + Math.max(rowCount - 1, 0);

      for (let r = range.s.r; r <= range.e.r; r += 1) {
        for (let c = range.s.c; c <= range.e.c; c += 1) {
          const cellAddress = XLSX.utils.encode_cell({ r, c });
          if (!sheet[cellAddress]) {
            sheet[cellAddress] = { t: "s", v: "" };
          }

          const cell = sheet[cellAddress] as XLSX.CellObject & { s?: Record<string, unknown> };
          const style: Record<string, unknown> = {
            border,
            alignment: { horizontal: "center", vertical: "center" },
          };

          if (titleRows.has(r)) {
            style.font = { bold: true };
          }

          if (r === headerRow) {
            style.font = { bold: true };
            style.fill = { patternType: "solid", fgColor: { rgb: "D9D9D9" } };
          } else if (r >= firstDataRow && r <= lastDataRow && (r - firstDataRow) % 2 === 0) {
            style.fill = { patternType: "solid", fgColor: { rgb: "F2F2F2" } };
          }

          cell.s = style;
        }
      }
    };

    const driversRows = report.byDriver.map((row, index) => ({
      "#": index + 1,
      "اسم السائق": row.driverName,
      "عدد الطلبات": row.tripsCount,
      "إجمالي التعويضات": Number(row.discount.toFixed(2)),
      "إجمالي العمولة": Number(row.commission.toFixed(2)),
    }));
    const driversSheet = XLSX.utils.aoa_to_sheet([
      ["جدول تقارير الموظفين"],
      [`الفترة: ${periodLabel}`],
      [`من: ${fromLabel}    |    إلى: ${toLabel}`],
      [],
    ]);
    XLSX.utils.sheet_add_json(driversSheet, driversRows, { origin: "A5" });
    driversSheet["!cols"] = [
      { wch: 6 },
      { wch: 26 },
      { wch: 14 },
      { wch: 18 },
      { wch: 18 },
    ];
    driversSheet["!autofilter"] = { ref: `A5:E${Math.max(driversRows.length + 5, 6)}` };
    driversSheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } },
    ];
    applySheetStyling(driversSheet, driversRows.length);
    XLSX.utils.book_append_sheet(workbook, driversSheet, "تقارير الموظفين");

    const coordinatorsRows = report.byCoordinator.map((row, index) => ({
      "#": index + 1,
      "اسم المنسق": row.coordinatorName,
      "عدد الطلبات": row.tripsCount,
      "إجمالي التعويضات": Number(row.discount.toFixed(2)),
      "إجمالي العمولة": Number(row.commission.toFixed(2)),
    }));
    const coordinatorsSheet = XLSX.utils.aoa_to_sheet([
      ["جدول تقارير المنسقين"],
      [`الفترة: ${periodLabel}`],
      [`من: ${fromLabel}    |    إلى: ${toLabel}`],
      [],
    ]);
    XLSX.utils.sheet_add_json(coordinatorsSheet, coordinatorsRows, { origin: "A5" });
    coordinatorsSheet["!cols"] = [
      { wch: 6 },
      { wch: 26 },
      { wch: 14 },
      { wch: 18 },
      { wch: 18 },
    ];
    coordinatorsSheet["!autofilter"] = { ref: `A5:E${Math.max(coordinatorsRows.length + 5, 6)}` };
    coordinatorsSheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } },
    ];
    applySheetStyling(coordinatorsSheet, coordinatorsRows.length);
    XLSX.utils.book_append_sheet(workbook, coordinatorsSheet, "تقارير المنسقين");

    const fileDate = toDateInputValue(new Date());
    XLSX.writeFile(workbook, `reports-${period}-${fileDate}.xlsx`);
  };

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-900">
        <h2 className="mb-3 text-lg font-bold">تقرير العمولات</h2>
        <div className="flex flex-wrap gap-2">
        {[
          { id: "daily", label: "يومي" },
          { id: "weekly", label: "أسبوعي" },
          { id: "monthly", label: "شهري" },
          { id: "all", label: "كل الفترات" },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setPeriod(item.id)}
            className={`rounded-lg px-3 py-2 text-sm ${
              period === item.id ? "bg-blue-600 text-white" : "bg-slate-200 dark:bg-slate-800"
            }`}
          >
            {item.label}
          </button>
        ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs text-slate-600 dark:text-slate-300">من</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-600 dark:text-slate-300">إلى</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          الفترة الفعلية: {effectiveFrom || "غير محدد"} - {effectiveTo || "غير محدد"}
        </p>
        <button
          onClick={exportReportsToExcel}
          className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white"
        >
          تصدير Excel (كل الجداول)
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <MetricCard title="إجمالي الطلبات" value={report.totals.totalTrips} />
        <MetricCard
          title="إجمالي التعويضات"
          value={formatCurrency(report.totals.totalDiscount)}
        />
        <MetricCard
          title="إجمالي العمولة"
          value={formatCurrency(report.totals.totalCommission)}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">تقرير لكل سائق</h3>
          <input
            value={driverSearch}
            onChange={(e) => setDriverSearch(e.target.value)}
            placeholder="بحث عن سائق"
            className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/60"
          />
        </div>
        <div className="space-y-2 md:hidden">
          {filteredDrivers.map((row) => (
            <div
              key={row.driverId}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50"
            >
              <p className="font-semibold">{row.driverName}</p>
              <div className="mt-1 grid grid-cols-2 gap-2 text-sm">
                <p>الطلبات: {row.tripsCount}</p>
                <p>التعويضات: {formatCurrency(row.discount)}</p>
                <p className="col-span-2">العمولة: {formatCurrency(row.commission)}</p>
              </div>
              <Link
                href={`/reports/driver/${row.driverId}?period=${period}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`}
                className="mt-2 inline-block rounded bg-blue-600 px-2 py-1 text-xs text-white"
              >
                عرض التقرير
              </Link>
            </div>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="p-2 text-right">السائق</th>
                <th className="p-2 text-right">الطلبات</th>
                <th className="p-2 text-right">التعويضات</th>
                <th className="p-2 text-right">العمولة</th>
                <th className="p-2 text-right">تفاصيل</th>
              </tr>
            </thead>
            <tbody>
              {filteredDrivers.map((row) => (
                <tr key={row.driverName} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="p-2">{row.driverName}</td>
                  <td className="p-2">{row.tripsCount}</td>
                  <td className="p-2">{formatCurrency(row.discount)}</td>
                  <td className="p-2">{formatCurrency(row.commission)}</td>
                  <td className="p-2">
                    <Link
                      href={`/reports/driver/${row.driverId}?period=${period}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`}
                      className="rounded bg-blue-600 px-2 py-1 text-xs text-white"
                    >
                      عرض التقرير
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">تقرير حسب المنسق</h3>
          <input
            value={coordinatorSearch}
            onChange={(e) => setCoordinatorSearch(e.target.value)}
            placeholder="بحث عن منسق"
            className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/60"
          />
        </div>
        <div className="space-y-2 md:hidden">
          {filteredCoordinators.map((row) => (
            <div
              key={row.coordinatorName}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50"
            >
              <p className="font-semibold">{row.coordinatorName}</p>
              <div className="mt-1 grid grid-cols-2 gap-2 text-sm">
                <p>الطلبات: {row.tripsCount}</p>
                <p>التعويضات: {formatCurrency(row.discount)}</p>
                <p className="col-span-2">العمولة: {formatCurrency(row.commission)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="p-2 text-right">المنسق</th>
                <th className="p-2 text-right">الطلبات</th>
                <th className="p-2 text-right">التعويضات</th>
                <th className="p-2 text-right">العمولة</th>
              </tr>
            </thead>
            <tbody>
              {filteredCoordinators.map((row) => (
                <tr
                  key={row.coordinatorName}
                  className="border-b border-slate-100 dark:border-slate-800"
                >
                  <td className="p-2">{row.coordinatorName}</td>
                  <td className="p-2">{row.tripsCount}</td>
                  <td className="p-2">{formatCurrency(row.discount)}</td>
                  <td className="p-2">{formatCurrency(row.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
