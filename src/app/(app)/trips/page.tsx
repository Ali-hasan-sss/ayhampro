"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Driver, Trip } from "@/types";
import { formatCurrency, formatGregorianDateAr } from "@/lib/format";
import { calendarDateKeyFromUtcDate } from "@/lib/trip-calendar-date";

function getTodayInputValue() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type CommissionType = "percentage" | "fixed";

export default function TripsPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 50;
  const [dateFilterEnabled, setDateFilterEnabled] = useState(false);
  const [dateFilterValue, setDateFilterValue] = useState(getTodayInputValue());
  const [tableDriverSearchInput, setTableDriverSearchInput] = useState("");
  const [tableDriverSearch, setTableDriverSearch] = useState("");
  const [searchingTrips, setSearchingTrips] = useState(false);
  const [coordinatorFilterEnabled, setCoordinatorFilterEnabled] = useState(false);
  const [coordinatorFilterId, setCoordinatorFilterId] = useState("");
  const [driverQuery, setDriverQuery] = useState("");
  const [coordinatorQuery, setCoordinatorQuery] = useState("");
  const [driverOpen, setDriverOpen] = useState(false);
  const [coordinatorOpen, setCoordinatorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [settings, setSettings] = useState<{
    commissionType: CommissionType;
    commissionValue: number;
  }>({
    commissionType: "percentage",
    commissionValue: 0,
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [form, setForm] = useState({
    driverId: "",
    coordinatorId: "",
    date: getTodayInputValue(),
    tripsCount: "",
    totalAmount: "",
    discount: "",
  });

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const loadAll = async (targetPage = currentPage, driverSearchOverride?: string) => {
    const dayQs =
      dateFilterEnabled && dateFilterValue
        ? `&from=${encodeURIComponent(dateFilterValue)}&to=${encodeURIComponent(dateFilterValue)}`
        : "";
    const effectiveDriverSearch = (driverSearchOverride ?? tableDriverSearch).trim();
    const driverNameQs = effectiveDriverSearch
      ? `&driverName=${encodeURIComponent(effectiveDriverSearch)}`
      : "";
    const coordinatorQs = coordinatorFilterEnabled && coordinatorFilterId
      ? `&coordinatorId=${encodeURIComponent(coordinatorFilterId)}`
      : "";
    const [driversRes, tripsRes, settingsRes] = await Promise.all([
      fetch("/api/drivers"),
      fetch(`/api/trips?page=${targetPage}&limit=${pageSize}${dayQs}${driverNameQs}${coordinatorQs}`),
      fetch("/api/settings"),
    ]);
    if (!driversRes.ok || !tripsRes.ok || !settingsRes.ok) {
      setErrorMessage("تعذر تحميل البيانات، تحقق من إعدادات الموظفين والمنسقين.");
      return;
    }
    const driversData = await driversRes.json();
    setDrivers(driversData);
    const tripsData = await tripsRes.json();
    setTrips(tripsData.items ?? []);
    setCurrentPage(tripsData.pagination?.page ?? targetPage);
    setTotalPages(tripsData.pagination?.totalPages ?? 1);
    const settingsData = await settingsRes.json();
    setSettings({
      commissionType: settingsData.commissionType,
      commissionValue: settingsData.commissionValue,
    });
   if (driversData.length > 0) {
  const lastCoordinator =
    driversData.filter((d: Driver) => d.role === "coordinator").at(-1)?._id ?? "";

  setForm((p) => ({
    ...p,
    coordinatorId: p.coordinatorId || lastCoordinator,
    date: p.date || new Date().toISOString().split("T")[0],
  }));
}
  };

  useEffect(() => {
    void loadAll(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchingTrips(true);
      setTableDriverSearch(tableDriverSearchInput);
      setCurrentPage(1);
      void loadAll(1, tableDriverSearchInput).finally(() => setSearchingTrips(false));
    }, 450);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce search by input text
  }, [tableDriverSearchInput]);

  useEffect(() => {
    setCurrentPage(1);
    void loadAll(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- coordinator filter change
  }, [coordinatorFilterEnabled, coordinatorFilterId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    if (!form.driverId) {
      setErrorMessage("يجب اختيار السائق قبل الحفظ.");
      return;
    }
    if (Number(form.tripsCount || 0) <= 0) {
      setErrorMessage("عدد الطلبات يجب أن يكون أكبر من صفر.");
      return;
    }
    if (Number(form.totalAmount || 0) <= 0) {
      setErrorMessage("المبلغ الإجمالي يجب أن يكون أكبر من صفر.");
      return;
    }
    if (Number(form.discount || 0) < 0) {
      setErrorMessage("قيمة التعويض لا يمكن أن تكون سالبة.");
      return;
    }
    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `/api/trips/${editingId}` : "/api/trips";
    setSubmitting(true);
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        tripsCount: Number(form.tripsCount || 0),
        totalAmount: Number(form.totalAmount || 0) * 1000,        
        discount: Number(form.discount || 0),
      }),
    });
    setSubmitting(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({ message: "فشل حفظ السجل" }));
      setErrorMessage(data.message ?? "فشل حفظ السجل");
      setToast({ type: "error", message: data.message ?? "فشل حفظ السجل" });
      return;
    }
    setEditingId(null);

    setForm((p) => ({
     ...p,
     driverId: "",
     tripsCount: "",
     totalAmount: "",
     discount: "",
   }));

    setToast({
     type: "success",
     message: editingId
      ? "تم تعديل السجل بنجاح"
      : "تمت إضافة السجل بنجاح",
    });

   loadAll(1);
   setDriverQuery("");
  };

  const remove = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا السجل؟")) return;
    setDeletingId(id);
    const response = await fetch(`/api/trips/${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (!response.ok) {
      const data = await response.json().catch(() => ({ message: "فشل حذف السجل" }));
      setErrorMessage(data.message ?? "فشل حذف السجل");
      setToast({ type: "error", message: data.message ?? "فشل حذف السجل" });
      return;
    }
    setToast({ type: "success", message: "تم حذف السجل بنجاح" });
    loadAll(currentPage);
  };

  const filteredDrivers = drivers.filter((driver) =>
    driver.role === "driver" &&
    `${driver.name} ${driver.phone}`.toLowerCase().includes(driverQuery.toLowerCase()),
  );

  const filteredCoordinators = drivers.filter(
    (driver) =>
      driver.role === "coordinator" &&
      `${driver.name} ${driver.phone}`.toLowerCase().includes(coordinatorQuery.toLowerCase()),
  );

  const driverOptions = useMemo(() => {
    const selected = drivers.find((d) => d.role === "driver" && d._id === form.driverId);
    if (!selected) return filteredDrivers;
    const existsInFiltered = filteredDrivers.some((d) => d._id === selected._id);
    return existsInFiltered ? filteredDrivers : [selected, ...filteredDrivers];
  }, [drivers, filteredDrivers, form.driverId]);

  const coordinatorOptions = useMemo(() => {
    const selected = drivers.find((d) => d.role === "coordinator" && d._id === form.coordinatorId);
    if (!selected) return filteredCoordinators;
    const existsInFiltered = filteredCoordinators.some((d) => d._id === selected._id);
    return existsInFiltered ? filteredCoordinators : [selected, ...filteredCoordinators];
  }, [drivers, filteredCoordinators, form.coordinatorId]);

  const selectedDriver = useMemo(
    () => drivers.find((d) => d.role === "driver" && d._id === form.driverId) ?? null,
    [drivers, form.driverId],
  );
  const selectedCoordinator = useMemo(
    () => drivers.find((d) => d.role === "coordinator" && d._id === form.coordinatorId) ?? null,
    [drivers, form.coordinatorId],
  );

  const calculatedCommissionBeforeDiscount =
    settings.commissionType === "percentage"
      ? ((Number(form.totalAmount || 0)*1000) * Number(settings.commissionValue)) / 100
      : Number(form.tripsCount || 0) * Number(settings.commissionValue);
  const calculatedCommission = Math.max(
    0,
    calculatedCommissionBeforeDiscount - Number(form.discount || 0),
  );

  return (
    <section className="space-y-4">
      <form
        onSubmit={submit}
        className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-5 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-900"
      >
        <h2 className="mb-3 font-semibold">إدخال طلب يومي</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid grid-cols-2 gap-4 sm:col-span-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                اختيار السائق
              </label>
              <div className="relative">
                <input
                  value={driverQuery}
                  onFocus={() => setDriverOpen(true)}
                  onChange={(e) => {
                    setDriverQuery(e.target.value);
                    setDriverOpen(true);
                  }}
                  placeholder={
                    selectedDriver
                      ? `${selectedDriver.name} - ${selectedDriver.phone}`
                      : "ابحث بالاسم أو الهاتف"
                  }
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60"
                />
                {driverOpen ? (
                  <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    {driverOptions.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-slate-500">لا توجد نتائج</p>
                    ) : (
                      driverOptions.map((driver) => (
                        <button
                          key={driver._id}
                          type="button"
                          onClick={() => {
                            setForm((p) => ({ ...p, driverId: driver._id }));
                            setDriverQuery(`${driver.name} ${driver.phone}`.trim());
                            setDriverOpen(false);
                          }}
                          className={`block w-full px-3 py-2 text-right text-sm hover:bg-slate-100 dark:hover:bg-slate-800 ${
                            form.driverId === driver._id ? "bg-blue-50 dark:bg-blue-900/20" : ""
                          }`}
                        >
                          {driver.name} - {driver.phone}
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                اختيار المنسق
              </label>
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
                      : "ابحث بالاسم أو الهاتف"
                  }
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60"
                />
                {coordinatorOpen ? (
                  <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    {coordinatorOptions.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-slate-500">لا توجد نتائج</p>
                    ) : (
                      coordinatorOptions.map((coordinator) => (
                        <button
                          key={coordinator._id}
                          type="button"
                          onClick={() => {
                            setForm((p) => ({ ...p, coordinatorId: coordinator._id }));
                            setCoordinatorQuery(`${coordinator.name} ${coordinator.phone}`.trim());
                            setCoordinatorOpen(false);
                          }}
                          className={`block w-full px-3 py-2 text-right text-sm hover:bg-slate-100 dark:hover:bg-slate-800 ${
                            form.coordinatorId === coordinator._id
                              ? "bg-blue-50 dark:bg-blue-900/20"
                              : ""
                          }`}
                        >
                          {coordinator.name} - {coordinator.phone}
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:col-span-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">التاريخ</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                عدد الطلبات
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={form.tripsCount}
                onChange={(e) => setForm((p) => ({ ...p, tripsCount: e.target.value }))}
                placeholder="ادخل عدد الطلبات"
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:col-span-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                قيمة التعويض (اختياري)
              </label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={form.discount}
                onChange={(e) => setForm((p) => ({ ...p, discount: e.target.value }))}
                placeholder="أدخل قيمة التعويض إن وجدت"
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                المبلغ اليومي (الإجمالي)
              </label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={form.totalAmount}
                onChange={(e) => setForm((p) => ({ ...p, totalAmount: e.target.value }))}
                placeholder="ادخل المبلغ الإجمالي اليومي"
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60"
              />
            </div>
          </div>
        </div>
        <div className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
          العمولة اليومية بعد التعويض (محسوبة تلقائيًا من الإعدادات):{" "}
          <span className="font-semibold">{formatCurrency(calculatedCommission)}</span>
        </div>
        {errorMessage ? <p className="mt-2 text-sm text-red-600">{errorMessage}</p> : null}
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
          disabled={submitting}
          className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "جاري الحفظ..." : "حفظ"}
        </button>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
              بحث باسم السائق (تلقائي بعد التوقف عن الكتابة)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tableDriverSearchInput}
                onChange={(e) => setTableDriverSearchInput(e.target.value)}
                placeholder="اكتب اسم السائق للبحث"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
              />
              {searchingTrips ? (
                <span className="whitespace-nowrap text-sm text-blue-600 dark:text-blue-300">
                  جاري البحث...
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                فلتر التاريخ (اختياري)
              </label>
              <input
                type="date"
                value={dateFilterValue}
                onChange={(e) => setDateFilterValue(e.target.value)}
                disabled={!dateFilterEnabled}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900"
              />
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={dateFilterEnabled}
                  onChange={(e) => setDateFilterEnabled(e.target.checked)}
                />
                <span>تفعيل فلتر التاريخ</span>
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                فلتر المنسق (اختياري)
              </label>
              <select
                value={coordinatorFilterId}
                onChange={(e) => setCoordinatorFilterId(e.target.value)}
                disabled={!coordinatorFilterEnabled}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">اختر المنسق</option>
                {drivers.filter(d => d.role === "coordinator").map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={coordinatorFilterEnabled}
                  onChange={(e) => setCoordinatorFilterEnabled(e.target.checked)}
                />
                <span>تفعيل فلتر المنسق</span>
              </label>
            </div>

            <div className="flex gap-2 md:col-span-2">
              <button
                type="button"
                onClick={() => {
                  setCurrentPage(1);
                  void loadAll(1);
                }}
                className="rounded bg-blue-600 px-3 py-2 text-sm text-white"
              >
                تطبيق الفلاتر
              </button>
              <button
                type="button"
                onClick={() => {
                  setDateFilterEnabled(false);
                  setCoordinatorFilterEnabled(false);
                  setCoordinatorFilterId("");
                  setCurrentPage(1);
                  void loadAll(1);
                }}
                className="rounded bg-slate-200 px-3 py-2 text-sm dark:bg-slate-700"
              >
                عرض الكل
              </button>
            </div>
          </div>
        </div>
        <div className="space-y-2 md:hidden">
          {trips.map((trip) => (
            <div
              key={trip._id}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50"
            >
              <p className="font-semibold">{trip.driverId?.name ?? "-"}</p>
              <p className="text-sm">المنسق: {trip.coordinatorId?.name ?? "-"}</p>
              <p className="text-sm">{formatGregorianDateAr(trip.date)}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <p>الطلبات: {trip.tripsCount}</p>
                <p>المبلغ: {formatCurrency(trip.totalAmount)}</p>
                <p>التعويض: {formatCurrency(trip.discount ?? 0)}</p>
                <p>العمولة: {formatCurrency(trip.commission)}</p>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => {
                    setEditingId(trip._id);
                    setForm({
                      driverId: trip.driverId?._id,
                      coordinatorId: trip.coordinatorId?._id,
                      date: calendarDateKeyFromUtcDate(new Date(trip.date)),
                      tripsCount: String(trip.tripsCount),
                      totalAmount: String(trip.totalAmount),
                      discount: String(trip.discount ?? 0),
                    });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="rounded bg-amber-500 px-2 py-1 text-xs text-white"
                >
                  تعديل
                </button>
                <button
                  disabled={deletingId === trip._id}
                  onClick={() => remove(trip._id)}
                  className="rounded bg-red-600 px-2 py-1 text-xs text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingId === trip._id ? "جاري الحذف..." : "حذف"}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-slate-600 dark:text-slate-300">
                <th className="px-4 py-3 text-right">السائق</th>
                <th className="px-4 py-3 text-right">المنسق</th>
                <th className="px-4 py-3 text-right">التاريخ</th>
                <th className="px-4 py-3 text-right">الطلبات</th>
                <th className="px-4 py-3 text-right">المبلغ</th>
                <th className="px-4 py-3 text-right">التعويض</th>
                <th className="px-4 py-3 text-right">العمولة</th>
                <th className="px-4 py-3 text-right">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((trip) => (
                <tr
                  key={trip._id}
                  className="rounded-xl bg-slate-50 shadow-[0_1px_0_rgba(15,23,42,0.04)] dark:bg-slate-800/50"
                >
                  <td className="rounded-r-xl px-4 py-3">{trip.driverId?.name ?? "-"}</td>
                  <td className="px-4 py-3">{trip.coordinatorId?.name ?? "-"}</td>
                  <td className="px-4 py-3">{formatGregorianDateAr(trip.date)}</td>
                  <td className="px-4 py-3">{trip.tripsCount}</td>
                  <td className="px-4 py-3">{formatCurrency(trip.totalAmount)}</td>
                  <td className="px-4 py-3">{formatCurrency(trip.discount ?? 0)}</td>
                  <td className="px-4 py-3">{formatCurrency(trip.commission)}</td>
                  <td className="rounded-l-xl px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingId(trip._id);
                          setForm({
                            driverId: trip.driverId?._id,
                            coordinatorId: trip.coordinatorId?._id,
                            date: calendarDateKeyFromUtcDate(new Date(trip.date)),
                            tripsCount: String(trip.tripsCount),
                            totalAmount: String(trip.totalAmount),
                            discount: String(trip.discount ?? 0),
                          });
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="rounded bg-amber-500 px-2 py-1 text-white"
                      >
                        تعديل
                      </button>
                      <button
                        disabled={deletingId === trip._id}
                        onClick={() => remove(trip._id)}
                        className="rounded bg-red-600 px-2 py-1 text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingId === trip._id ? "جاري الحذف..." : "حذف"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            صفحة {currentPage} من {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => loadAll(currentPage - 1)}
              disabled={currentPage <= 1}
              className="rounded bg-slate-200 px-3 py-1 text-sm disabled:opacity-40 dark:bg-slate-700"
            >
              السابق
            </button>
            <button
              onClick={() => loadAll(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="rounded bg-slate-200 px-3 py-1 text-sm disabled:opacity-40 dark:bg-slate-700"
            >
              التالي
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
