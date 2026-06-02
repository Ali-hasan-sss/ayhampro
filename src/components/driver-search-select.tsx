"use client";

import { FormEvent, useMemo, useState } from "react";
import type { Driver } from "@/types";

type DriverSearchSelectProps = {
  drivers: Driver[];
  selectedId: string | null;
  suggestedCaptainName?: string;
  autoMatchPercent?: number;
  onSelect: (driver: Driver | null) => void;
  onDriverCreated: (driver: Driver) => void;
};

export function DriverSearchSelect({
  drivers,
  selectedId,
  suggestedCaptainName,
  autoMatchPercent,
  onSelect,
  onDriverCreated,
}: DriverSearchSelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);

  const selected = useMemo(
    () => drivers.find((d) => d._id === selectedId) ?? null,
    [drivers, selectedId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = drivers.filter((d) => d.role === "driver");
    if (!q) return list;
    return list.filter((d) => `${d.name} ${d.phone}`.toLowerCase().includes(q));
  }, [drivers, query]);

  const openAddForm = () => {
    setAddName(suggestedCaptainName?.trim() ?? "");
    setAddPhone("");
    setAddNotes("");
    setAddError("");
    setShowAddForm(true);
    setOpen(true);
  };

  const createDriver = async (e: FormEvent) => {
    e.preventDefault();
    setAddError("");
    const name = addName.trim();
    if (name.length < 2) {
      setAddError("الاسم يجب أن يكون حرفين على الأقل.");
      return;
    }
    setAdding(true);
    const response = await fetch("/api/drivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone: addPhone.trim(),
        role: "driver",
        notes: addNotes.trim(),
      }),
    });
    setAdding(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({ message: "فشل إضافة السائق" }));
      setAddError(data.message ?? "فشل إضافة السائق");
      return;
    }
    const created = (await response.json()) as Driver;
    onDriverCreated(created);
    onSelect(created);
    setShowAddForm(false);
    setOpen(false);
    setQuery(`${created.name} ${created.phone}`.trim());
  };

  const matchBadge =
    autoMatchPercent !== undefined && autoMatchPercent > 0 ? (
      <span
        className={`mt-1 inline-block rounded px-1.5 py-0.5 text-xs ${
          autoMatchPercent >= 85
            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
            : autoMatchPercent >= 72
              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        }`}
      >
        تطابق تلقائي: {Math.round(autoMatchPercent)}%
      </span>
    ) : null;

  return (
    <div className="space-y-1">
      <div className="relative">
        <input
          value={open ? query : selected ? `${selected.name} ${selected.phone}`.trim() : query}
          onFocus={() => {
            setOpen(true);
            if (selected) setQuery(`${selected.name} ${selected.phone}`.trim());
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onBlur={() => {
            window.setTimeout(() => {
              setOpen(false);
              setShowAddForm(false);
            }, 200);
          }}
          placeholder={selected ? `${selected.name} - ${selected.phone}` : "ابحث بالاسم أو الهاتف"}
          className="w-full min-w-[160px] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
        {open ? (
          <div className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
            {showAddForm ? (
              <form onSubmit={createDriver} className="border-b border-slate-200 p-3 dark:border-slate-700">
                <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                  إضافة سائق جديد
                </p>
                <input
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="الاسم"
                  className="mb-2 w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
                />
                <input
                  value={addPhone}
                  onChange={(e) => setAddPhone(e.target.value)}
                  placeholder="الهاتف (اختياري)"
                  className="mb-2 w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
                />
                <input
                  value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  placeholder="ملاحظات"
                  className="mb-2 w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
                />
                {addError ? <p className="mb-2 text-xs text-red-600">{addError}</p> : null}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={adding}
                    className="rounded bg-emerald-600 px-2 py-1 text-xs text-white disabled:opacity-60"
                  >
                    {adding ? "جاري الحفظ..." : "حفظ واعتماد"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-600"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            ) : null}
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-500">لا توجد نتائج</p>
            ) : (
              filtered.map((driver) => (
                <button
                  key={driver._id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSelect(driver);
                    setQuery(`${driver.name} ${driver.phone}`.trim());
                    setOpen(false);
                  }}
                  className={`block w-full px-3 py-2 text-right text-sm hover:bg-slate-100 dark:hover:bg-slate-800 ${
                    selectedId === driver._id ? "bg-blue-50 dark:bg-blue-900/20" : ""
                  }`}
                >
                  {driver.name} - {driver.phone}
                </button>
              ))
            )}
            {!showAddForm ? (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={openAddForm}
                className="block w-full border-t border-slate-200 px-3 py-2 text-right text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:border-slate-700 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
              >
                + إضافة سائق جديد
              </button>
            ) : null}
            {selectedId ? (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(null);
                  setQuery("");
                }}
                className="block w-full border-t border-slate-200 px-3 py-2 text-right text-xs text-red-600 dark:border-slate-700"
              >
                إلغاء الربط
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {matchBadge}
    </div>
  );
}
