"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Driver } from "@/types";

const emptyForm = { name: "", phone: "", role: "driver", notes: "" };

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("driver");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const loadDrivers = async (searchQuery = query, selectedRole = role) => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (selectedRole) params.set("role", selectedRole);
    const response = await fetch(`/api/drivers?${params.toString()}`);
    setDrivers(await response.json());
  };

  useEffect(() => {
    void fetch(`/api/drivers?${new URLSearchParams({ q: query, role }).toString()}`)
      .then((res) => res.json())
      .then((data) => setDrivers(data));
  }, [query, role]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    const name = form.name.trim();
    const phone = form.phone.trim();
    if (name.length < 2) {
      setFormError("الاسم يجب أن يكون حرفين على الأقل.");
      return;
    }
    if (phone && phone.length < 5) {
      setFormError("رقم الهاتف يجب أن يكون 5 أرقام على الأقل أو اتركه فارغًا.");
      return;
    }
    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `/api/drivers/${editingId}` : "/api/drivers";
    setSubmitting(true);
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, name, phone }),
    });
    setSubmitting(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({ message: "فشل حفظ السائق" }));
      setFormError(data.message ?? "فشل حفظ السائق");
      setToast({ type: "error", message: data.message ?? "فشل حفظ السائق" });
      return;
    }
    setForm(emptyForm);
    setEditingId(null);
    setToast({ type: "success", message: editingId ? "تم تعديل السائق بنجاح" : "تمت إضافة السائق بنجاح" });
    loadDrivers();
  };

  const remove = async (id: string) => {
    await fetch(`/api/drivers/${id}`, { method: "DELETE" });
    loadDrivers();
  };

  return (
    <section className="space-y-4">
      <form
        onSubmit={submit}
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 className="mb-3 font-semibold">
          {editingId ? "تعديل مستخدم" : "إضافة سائق / منسق"}
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="الاسم"
            className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700"
          />
          <input
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            placeholder="الهاتف (اختياري)"
            className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700"
          />
          <select
            value={form.role}
            onChange={(e) =>
              setForm((p) => ({ ...p, role: e.target.value as "driver" | "coordinator" }))
            }
            className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700"
          >
            <option value="driver">سائق</option>
            <option value="coordinator">منسق</option>
          </select>
          <input
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            placeholder="ملاحظات"
            className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700"
          />
        </div>
        {formError ? <p className="mt-2 text-sm text-red-600">{formError}</p> : null}
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
        <div className="mb-3 space-y-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="بحث بالاسم"
            className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setRole("driver")}
              className={`rounded-lg px-3 py-2 text-sm ${
                role === "driver"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              سائقين
            </button>
            <button
              onClick={() => setRole("coordinator")}
              className={`rounded-lg px-3 py-2 text-sm ${
                role === "coordinator"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              منسقين
            </button>
            <button
              onClick={() => setRole("")}
              className={`rounded-lg px-3 py-2 text-sm ${
                role === ""
                  ? "bg-blue-600 text-white"
                  : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              الكل
            </button>
          </div>
        </div>

        <div className="space-y-2 md:hidden">
          {drivers.map((driver) => (
            <div
              key={driver._id}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50"
            >
              <p className="font-semibold">{driver.name}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{driver.phone}</p>
              <p className="mt-1 text-sm">النوع: {driver.role === "driver" ? "سائق" : "منسق"}</p>
              <p className="text-sm">ملاحظات: {driver.notes || "-"}</p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => {
                    setEditingId(driver._id);
                    setForm({
                      name: driver.name,
                      phone: driver.phone,
                      role: driver.role,
                      notes: driver.notes ?? "",
                    });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="rounded bg-amber-500 px-2 py-1 text-xs text-white"
                >
                  تعديل
                </button>
                <button
                  onClick={() => remove(driver._id)}
                  className="rounded bg-red-600 px-2 py-1 text-xs text-white"
                >
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="p-2 text-right">الاسم</th>
                <th className="p-2 text-right">الهاتف</th>
                <th className="p-2 text-right">النوع</th>
                <th className="p-2 text-right">ملاحظات</th>
                <th className="p-2 text-right">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => (
                <tr key={driver._id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="p-2">{driver.name}</td>
                  <td className="p-2">{driver.phone}</td>
                  <td className="p-2">{driver.role === "driver" ? "سائق" : "منسق"}</td>
                  <td className="p-2">{driver.notes}</td>
                  <td className="p-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingId(driver._id);
                          setForm({
                            name: driver.name,
                            phone: driver.phone,
                            role: driver.role,
                            notes: driver.notes ?? "",
                          });
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="rounded bg-amber-500 px-2 py-1 text-white"
                      >
                        تعديل
                      </button>
                      <button
                        onClick={() => remove(driver._id)}
                        className="rounded bg-red-600 px-2 py-1 text-white"
                      >
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
