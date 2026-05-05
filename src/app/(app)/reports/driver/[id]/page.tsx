"use client";

import { toPng } from "html-to-image";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatAmount, formatCurrency } from "@/lib/format";

type DriverInvoice = {
  driver: { id: string; name: string; phone: string };
  totals: {
    totalAmount: number;
    totalTrips: number;
    totalDiscount: number;
    totalCommission: number;
  };
  daily: {
    date: string;
    totalAmount: number;
    tripsCount: number;
    discount: number;
    commission: number;
  }[];
};

export default function DriverReportPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [data, setData] = useState<DriverInvoice | null>(null);
  const exportInvoiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = new URLSearchParams();
    const period = searchParams.get("period");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (period) query.set("period", period);
    if (from) query.set("from", from);
    if (to) query.set("to", to);

    void fetch(`/api/reports/driver/${params.id}?${query.toString()}`)
      .then((res) => res.json())
      .then((json) => setData(json));
  }, [params.id, searchParams]);

  if (!data) {
    return <div className="rounded-xl bg-white p-4 dark:bg-slate-900">جاري تحميل الفاتورة...</div>;
  }

  const grossCommission = data.totals.totalCommission + data.totals.totalDiscount;
  const periodLabelMap: Record<string, string> = {
    daily: "يومي",
    weekly: "أسبوعي",
    monthly: "شهري",
    all: "كل الفترات",
  };
  const periodKey = searchParams.get("period") ?? "custom";
  const periodLabel = periodLabelMap[periodKey] ?? "مخصص";
  const fromLabel = searchParams.get("from") ?? "-";
  const toLabel = searchParams.get("to") ?? "-";
  const exportInvoiceImage = async () => {
    if (!exportInvoiceRef.current) return;
    const image = await toPng(exportInvoiceRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#ffffff",
    });
    const a = document.createElement("a");
    const safeDriverName = data.driver.name.replace(/[^\w\u0600-\u06FF-]/g, "_");
    a.download = `invoice-${safeDriverName}-${new Date().toISOString().slice(0, 10)}.png`;
    a.href = image;
    a.click();
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h1 className="text-lg font-bold">فاتورة السائق: {data.driver.name}</h1>
          <p className="text-sm text-slate-500">الهاتف: {data.driver.phone}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportInvoiceImage}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white"
          >
            تصدير الفاتورة كصورة
          </button>
          <Link href="/reports" className="rounded-lg bg-slate-200 px-3 py-2 text-sm dark:bg-slate-800">
            رجوع للتقارير
          </Link>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 text-slate-900">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">فاتورة عمولة سائق</h2>
              <p className="mt-1 text-sm text-slate-600">نظام محاسبة التكسي</p>
            </div>
            <div className="text-sm text-slate-600">
              <p>تاريخ الإصدار: {new Date().toLocaleDateString("ar-SA")}</p>
              <p>الفترة: {periodLabel}</p>
              <p>
                من: {fromLabel} - إلى: {toLabel}
              </p>
            </div>
          </div>
          <div className="mt-3 border-t border-slate-200 pt-3 text-sm text-slate-700">
            <p>اسم السائق: {data.driver.name}</p>
            <p>الهاتف: {data.driver.phone}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">المبلغ الكلي (قبل العمولة)</p>
            <p className="mt-2 text-2xl font-bold">{formatCurrency(data.totals.totalAmount)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">إجمالي عدد الطلبات</p>
            <p className="mt-2 text-2xl font-bold">{data.totals.totalTrips}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">العمولة قبل التعويض</p>
            <p className="mt-2 text-2xl font-bold text-blue-600">{formatCurrency(grossCommission)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">إجمالي التعويضات</p>
            <p className="mt-2 text-2xl font-bold text-amber-600">
              {formatCurrency(data.totals.totalDiscount)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">العمولة الصافية المستحقة</p>
            <p className="mt-2 text-2xl font-bold text-emerald-600">
              {formatCurrency(data.totals.totalCommission)}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 font-semibold">تفصيل يومي (فاتورة)</h3>
          <div className="space-y-2 md:hidden">
            {data.daily.map((row) => (
              <div key={`m-${row.date}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="font-semibold">{new Date(row.date).toLocaleDateString("ar-SA")}</p>
                <div className="mt-1 grid grid-cols-2 gap-2 text-sm">
                  <p>المبلغ: {formatAmount(row.totalAmount)}</p>
                  <p>الطلبات: {row.tripsCount}</p>
                  <p>قبل التعويض: {formatAmount(row.commission + row.discount)}</p>
                  <p>التعويض: {formatAmount(row.discount)}</p>
                  <p className="col-span-2 font-semibold">الصافي: {formatCurrency(row.commission)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="p-2 text-right">اليوم</th>
                  <th className="p-2 text-right">المبلغ الكلي</th>
                  <th className="p-2 text-right">عدد الطلبات</th>
                  <th className="p-2 text-right">العمولة قبل التعويض</th>
                  <th className="p-2 text-right">التعويضات</th>
                  <th className="p-2 text-right">العمولة الصافية</th>
                </tr>
              </thead>
              <tbody>
                {data.daily.map((row) => (
                  <tr key={row.date} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="p-2">{new Date(row.date).toLocaleDateString("ar-SA")}</td>
                    <td className="p-2">{formatCurrency(row.totalAmount)}</td>
                    <td className="p-2">{row.tripsCount}</td>
                    <td className="p-2">{formatCurrency(row.commission + row.discount)}</td>
                    <td className="p-2">{formatCurrency(row.discount)}</td>
                    <td className="p-2">{formatCurrency(row.commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="fixed -left-[99999px] top-0 opacity-0 pointer-events-none">
        <div
          ref={exportInvoiceRef}
          style={{ width: 794, minHeight: 1123 }}
          className="bg-white p-8 text-slate-900"
        >
          <div className="rounded-2xl border-2 border-slate-800 p-5">
            <div className="mb-4 border-b-2 border-slate-300 pb-4 text-center">
              <h2 className="text-3xl font-extrabold tracking-wide">INVOICE</h2>
              <p className="mt-1 text-sm text-slate-600">فاتورة عمولة سائق</p>
              <p className="mt-1 text-sm text-slate-700">الفترة: {periodLabel}</p>
              <p className="text-sm text-slate-700">
                من: {fromLabel} - إلى: {toLabel}
              </p>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4">
              <div>
                <p className="text-xs text-slate-500">بيانات السائق</p>
                <p className="mt-1 text-lg font-bold">{data.driver.name}</p>
                <p className="text-sm text-slate-700">الهاتف: {data.driver.phone}</p>
              </div>
              <div className="text-sm">
                <p>رقم الفاتورة: INV-{data.driver.id.slice(-6).toUpperCase()}</p>
                <p>تاريخ الإصدار: {new Date().toLocaleDateString("ar-SA")}</p>
                <p className="mt-1 text-xs text-slate-500">ملخص مالي</p>
                <p className="mt-1">المبلغ الكلي: {formatCurrency(data.totals.totalAmount)}</p>
                <p>العمولة قبل التعويض: {formatCurrency(grossCommission)}</p>
                <p>التعويضات: {formatCurrency(data.totals.totalDiscount)}</p>
                <p className="font-bold text-emerald-700">
                  العمولة الصافية: {formatCurrency(data.totals.totalCommission)}
                </p>
              </div>
            </div>

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 p-2 text-right">اليوم</th>
                  <th className="border border-slate-300 p-2 text-right">المبلغ الكلي</th>
                  <th className="border border-slate-300 p-2 text-right">عدد الطلبات</th>
                  <th className="border border-slate-300 p-2 text-right">العمولة قبل التعويض</th>
                  <th className="border border-slate-300 p-2 text-right">التعويضات</th>
                  <th className="border border-slate-300 p-2 text-right">العمولة الصافية</th>
                </tr>
              </thead>
              <tbody>
                {data.daily.map((row, index) => (
                  <tr key={`export-${row.date}`} className={index % 2 === 0 ? "bg-slate-100/80" : "bg-white"}>
                    <td className="border border-slate-300 p-2">
                      {new Date(row.date).toLocaleDateString("ar-SA")}
                    </td>
                    <td className="border border-slate-300 p-2">{formatCurrency(row.totalAmount)}</td>
                    <td className="border border-slate-300 p-2">{row.tripsCount}</td>
                    <td className="border border-slate-300 p-2">
                      {formatCurrency(row.commission + row.discount)}
                    </td>
                    <td className="border border-slate-300 p-2">{formatCurrency(row.discount)}</td>
                    <td className="border border-slate-300 p-2 font-semibold">
                      {formatCurrency(row.commission)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
