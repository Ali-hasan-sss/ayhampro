"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Driver } from "@/types";
import type { SmartEntryImportResult, SmartEntryParseResult, SmartEntryRow } from "@/types/smart-entry";
import { fareThousandsUnitToStoredAmount } from "@/lib/fare-normalize";
import { mergeSmartEntryRows } from "@/lib/smart-entry-merge";
import { formatCurrency } from "@/lib/format";

function getTodayInputValue() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fareToDisplayAmount(totalFare: number) {
  return fareThousandsUnitToStoredAmount(totalFare);
}

export default function SmartEntryPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<SmartEntryParseResult | null>(null);
  const [rows, setRows] = useState<SmartEntryRow[]>([]);
  const [coordinatorId, setCoordinatorId] = useState("");
  const [coordinatorQuery, setCoordinatorQuery] = useState("");
  const [coordinatorOpen, setCoordinatorOpen] = useState(false);
  const [date, setDate] = useState(getTodayInputValue());
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [importResult, setImportResult] = useState<SmartEntryImportResult | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/drivers");
      if (!res.ok) return;
      const data: Driver[] = await res.json();
      setDrivers(data);
      const lastCoordinator = data.filter((d) => d.role === "coordinator").at(-1)?._id ?? "";
      setCoordinatorId((prev) => prev || lastCoordinator);
    })();
  }, []);

  const driverOptions = useMemo(
    () => drivers.filter((d) => d.role === "driver"),
    [drivers],
  );

  const coordinators = useMemo(
    () =>
      drivers.filter(
        (d) =>
          d.role === "coordinator" &&
          `${d.name} ${d.phone}`.toLowerCase().includes(coordinatorQuery.toLowerCase()),
      ),
    [drivers, coordinatorQuery],
  );

  const selectedCoordinator = useMemo(
    () => drivers.find((d) => d.role === "coordinator" && d._id === coordinatorId) ?? null,
    [drivers, coordinatorId],
  );

  const reviewStats = useMemo(() => {
    const needsReview = rows.filter((r) => r.needsReview || !r.driverId).length;
    const ready = rows.length - needsReview;
    return { needsReview, ready, totalTrips: rows.reduce((s, r) => s + r.tripsCount, 0) };
  }, [rows]);

  const parseFile = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setImportResult(null);
    if (!file) {
      setErrorMessage("اختر ملف دردشة واتساب أولًا.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setParsing(true);
    const response = await fetch("/api/smart-entry/parse", {
      method: "POST",
      body: formData,
    });
    setParsing(false);

    const data = await response.json().catch(() => ({ message: "فشل تحليل الملف" }));
    if (!response.ok) {
      setErrorMessage(data.message ?? "فشل تحليل الملف");
      setToast({ type: "error", message: data.message ?? "فشل تحليل الملف" });
      return;
    }

    const result = data as SmartEntryParseResult;
    setParseResult(result);
    setRows(result.rows);
    setToast({
      type: "success",
      message: `تم استخراج ${result.rawInvoiceCount} فاتورة → ${result.rows.length} سائق`,
    });
  };

  const updateRowDriver = (index: number, driverId: string) => {
    const driver = driverOptions.find((d) => d._id === driverId);
    setRows((prev) =>
      mergeSmartEntryRows(
        prev.map((row, i) =>
          i === index
            ? {
                ...row,
                driverId: driverId || null,
                matchedDriverName: driver?.name ?? null,
                matchConfidence: driver ? 1 : 0,
                needsReview: !driverId,
              }
            : row,
        ),
      ),
    );
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const importAll = async () => {
    setErrorMessage("");
    setImportResult(null);

    if (!coordinatorId) {
      setErrorMessage("يجب اختيار المنسق.");
      return;
    }
    if (!date) {
      setErrorMessage("يجب اختيار التاريخ.");
      return;
    }
    if (rows.length === 0) {
      setErrorMessage("لا توجد سجلات للإدخال.");
      return;
    }

    const missingDriver = rows.filter((r) => !r.driverId);
    if (missingDriver.length > 0) {
      setErrorMessage(
        `يوجد ${missingDriver.length} سائق بدون ربط في النظام. راجع الأسماء أو أضفهم من صفحة الموظفين.`,
      );
      return;
    }

    const mergedRows = mergeSmartEntryRows(rows);

    setImporting(true);
    const response = await fetch("/api/smart-entry/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        coordinatorId,
        date,
        entries: mergedRows.map((r) => ({
          driverId: r.driverId,
          captainName: r.captainName,
          tripsCount: r.tripsCount,
          totalFare: r.totalFare,
        })),
      }),
    });
    setImporting(false);

    const data = await response.json().catch(() => ({ message: "فشل الإدخال" }));
    if (!response.ok && !data.created) {
      setErrorMessage(data.message ?? "فشل الإدخال");
      setToast({ type: "error", message: data.message ?? "فشل الإدخال" });
      return;
    }

    const result = data as SmartEntryImportResult;
    setImportResult(result);
    setToast({
      type: result.created > 0 ? "success" : "error",
      message:
        result.created > 0
          ? `تم إدخال ${result.created} طلب بنجاح`
          : "لم يتم إدخال أي طلب",
    });

    if (result.created > 0) {
      const importedDriverIds = new Set(
        rows.filter((r) => r.driverId).map((r) => r.driverId as string),
      );
      setRows((prev) =>
        prev.filter((r) => !r.driverId || !importedDriverIds.has(r.driverId)),
      );
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-emerald-50/80 to-white p-5 shadow-sm dark:border-slate-800 dark:from-emerald-950/20 dark:to-slate-900">
        <h2 className="mb-1 text-lg font-semibold">إدخال ذكي من واتساب</h2>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
          ارفع ملف تصدير دردشة واتساب (.txt) لاستخراج طلبات كل كابتن تلقائيًا عبر الذكاء
          الاصطناعي، ثم راجع النتائج واختر المنسق والتاريخ وأدخل الكل دفعة واحدة.
        </p>

        <form onSubmit={parseFile} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">ملف الدردشة</label>
            <input
              type="file"
              accept=".txt,text/plain"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          {errorMessage && !parseResult ? (
            <p className="text-sm text-red-600">{errorMessage}</p>
          ) : null}
          <button
            type="submit"
            disabled={parsing || !file}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {parsing ? "جاري التحليل..." : "تحليل الملف"}
          </button>
        </form>
      </div>

      {parseResult ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold">مراجعة المستخرج</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {parseResult.rawInvoiceCount} فاتورة خام • {rows.length} سائق •{" "}
                {parseResult.usedAi ? "تحليل بالذكاء الاصطناعي" : "تحليل محلي"}
                {parseResult.removedDuplicates > 0
                  ? ` • أزيل ${parseResult.removedDuplicates} تكرار`
                  : ""}
              </p>
              {parseResult.notes ? (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{parseResult.notes}</p>
              ) : null}
            </div>
            <div className="text-sm">
              <span className="rounded bg-emerald-100 px-2 py-1 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                جاهز: {reviewStats.ready}
              </span>{" "}
              <span className="rounded bg-amber-100 px-2 py-1 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                يحتاج مراجعة: {reviewStats.needsReview}
              </span>
            </div>
          </div>

          <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">المنسق</label>
              <div className="relative">
                <input
                  value={coordinatorQuery}
                  onFocus={() => setCoordinatorOpen(true)}
                  onChange={(e) => {
                    setCoordinatorQuery(e.target.value);
                    setCoordinatorOpen(true);
                  }}
                  placeholder={
                    selectedCoordinator
                      ? `${selectedCoordinator.name} - ${selectedCoordinator.phone}`
                      : "ابحث عن المنسق"
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                />
                {coordinatorOpen ? (
                  <div className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    {coordinators.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-slate-500">لا توجد نتائج</p>
                    ) : (
                      coordinators.map((c) => (
                        <button
                          key={c._id}
                          type="button"
                          onClick={() => {
                            setCoordinatorId(c._id);
                            setCoordinatorQuery(`${c.name} ${c.phone}`.trim());
                            setCoordinatorOpen(false);
                          }}
                          className="block w-full px-3 py-2 text-right text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          {c.name} - {c.phone}
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">تاريخ الطلبات</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-right dark:border-slate-700">
                  <th className="p-2">اسم الكابتن (من الواتساب)</th>
                  <th className="p-2">السائق في النظام</th>
                  <th className="p-2">عدد الطلبات</th>
                  <th className="p-2">المجموع (ألف ل.س)</th>
                  <th className="p-2">المبلغ المحفوظ</th>
                  <th className="p-2">حالة</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={`${row.captainName}-${index}`}
                    className="border-b border-slate-100 dark:border-slate-800"
                  >
                    <td className="p-2">
                      <p className="font-medium">{row.captainName}</p>
                      {row.sourceNames && row.sourceNames.length > 1 ? (
                        <p className="text-xs text-slate-500">
                          دُمج: {row.sourceNames.join("، ")}
                        </p>
                      ) : null}
                    </td>
                    <td className="p-2">
                      <select
                        value={row.driverId ?? ""}
                        onChange={(e) => updateRowDriver(index, e.target.value)}
                        className="w-full min-w-[160px] rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
                      >
                        <option value="">— اختر سائقًا —</option>
                        {driverOptions.map((d) => (
                          <option key={d._id} value={d._id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                      {row.matchedDriverName && row.matchConfidence > 0 ? (
                        <p className="mt-1 text-xs text-slate-500">
                          تطابق: {Math.round(row.matchConfidence * 100)}%
                        </p>
                      ) : null}
                    </td>
                    <td className="p-2">{row.tripsCount}</td>
                    <td className="p-2">{row.totalFare}</td>
                    <td className="p-2">{formatCurrency(fareToDisplayAmount(row.totalFare))}</td>
                    <td className="p-2">
                      {row.driverId && !row.needsReview ? (
                        <span className="text-emerald-600">جاهز</span>
                      ) : (
                        <span className="text-amber-600">مراجعة</span>
                      )}
                    </td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        className="text-xs text-red-600"
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {rows.map((row, index) => (
              <div
                key={`${row.captainName}-${index}`}
                className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"
              >
                <p className="font-semibold">{row.captainName}</p>
                <p className="text-sm">
                  {row.tripsCount} طلب • مجموع {row.totalFare} (ألف) ={" "}
                  {formatCurrency(fareToDisplayAmount(row.totalFare))}
                </p>
                <select
                  value={row.driverId ?? ""}
                  onChange={(e) => updateRowDriver(index, e.target.value)}
                  className="mt-2 w-full rounded border border-slate-300 bg-white px-2 py-2 dark:border-slate-600 dark:bg-slate-800"
                >
                  <option value="">— اختر سائقًا —</option>
                  {driverOptions.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  className="mt-2 text-xs text-red-600"
                >
                  استبعاد من القائمة
                </button>
              </div>
            ))}
          </div>

          {errorMessage ? <p className="mt-3 text-sm text-red-600">{errorMessage}</p> : null}
          {toast ? (
            <p
              className={`mt-2 text-sm ${
                toast.type === "success" ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {toast.message}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => void importAll()}
            disabled={importing || rows.length === 0}
            className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {importing ? "جاري الإدخال..." : `إدخال ${rows.length} طلب دفعة واحدة`}
          </button>

          {importResult ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/50">
              <p className="font-medium">نتيجة الإدخال</p>
              <p>تم الإدخال: {importResult.created}</p>
              {importResult.skipped.length > 0 ? (
                <div className="mt-2">
                  <p className="text-amber-700 dark:text-amber-300">تم تخطيه (مكرر):</p>
                  <ul className="list-inside list-disc">
                    {importResult.skipped.map((s) => (
                      <li key={s.captainName}>
                        {s.captainName}: {s.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {importResult.errors.length > 0 ? (
                <div className="mt-2">
                  <p className="text-red-600">أخطاء:</p>
                  <ul className="list-inside list-disc">
                    {importResult.errors.map((e) => (
                      <li key={e.captainName}>
                        {e.captainName}: {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
