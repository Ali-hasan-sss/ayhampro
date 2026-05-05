"use client";

import { FormEvent, useEffect, useState } from "react";

export default function SettingsPage() {
  const [form, setForm] = useState({
    commissionType: "percentage",
    commissionValue: 10,
    companyName: "",
    currentPassword: "",
    newPassword: "",
  });
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/settings");
      const data = await response.json();
      setForm((p) => ({ ...p, ...data }));
    }
    load();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        commissionValue: Number(form.commissionValue),
        currentPassword: form.currentPassword || undefined,
        newPassword: form.newPassword || undefined,
      }),
    });
    const data = await response.json();
    setMessage(response.ok ? "تم حفظ الإعدادات بنجاح" : data.message ?? "فشل الحفظ");
    if (response.ok) {
      setForm((p) => ({ ...p, currentPassword: "", newPassword: "" }));
    }
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <h2 className="mb-3 font-semibold">الإعدادات العامة</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={form.companyName}
          onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
          placeholder="اسم الشركة"
          className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700"
        />
        <select
          value={form.commissionType}
          onChange={(e) => setForm((p) => ({ ...p, commissionType: e.target.value }))}
          className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700"
        >
          <option value="percentage">نسبة مئوية</option>
          <option value="fixed">مبلغ ثابت لكل طلب</option>
        </select>
        <input
          type="number"
          value={form.commissionValue}
          onChange={(e) => setForm((p) => ({ ...p, commissionValue: Number(e.target.value) }))}
          placeholder="قيمة العمولة"
          className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700"
        />
        <input
          type="password"
          value={form.currentPassword}
          onChange={(e) => setForm((p) => ({ ...p, currentPassword: e.target.value }))}
          placeholder="كلمة المرور الحالية (اختياري)"
          className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700"
        />
        <input
          type="password"
          value={form.newPassword}
          onChange={(e) => setForm((p) => ({ ...p, newPassword: e.target.value }))}
          placeholder="كلمة المرور الجديدة (اختياري)"
          className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 sm:col-span-2"
        />
      </div>
      <button className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-white">حفظ التغييرات</button>
      {message ? <p className="mt-2 text-sm text-emerald-600">{message}</p> : null}
    </form>
  );
}
