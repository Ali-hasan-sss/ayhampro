"use client";

import { FormEvent, useEffect, useState } from "react";

export default function SettingsPage() {
  const [form, setForm] = useState({
    commissionType: "percentage",
    commissionValue: 7,
    companyName: "",
    currentPassword: "",
    newPassword: "",
  });
  const [message, setMessage] = useState("");
  const [backupInProgress, setBackupInProgress] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");

  const [restoreInProgress, setRestoreInProgress] = useState(false);
  const [restoreFileName, setRestoreFileName] = useState("");
  const [restorePayload, setRestorePayload] = useState<any>(null);
  const [restoreMessage, setRestoreMessage] = useState("");

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

  const downloadBackup = async () => {
    setBackupInProgress(true);
    setBackupMessage("");
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setBackupMessage(data.message ?? "فشل إنشاء النسخة الاحتياطية");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const fileDate = new Date();
      const fileName = `backup-${fileDate.toISOString().slice(0, 10)}.json`;
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setBackupMessage("تم إنشاء النسخة الاحتياطية بنجاح. سيتم تحميل الملف.");
    } catch {
      setBackupMessage("فشل إنشاء النسخة الاحتياطية");
    } finally {
      setBackupInProgress(false);
    }
  };

  const onRestoreFileChange = async (file: File | null) => {
    setRestoreMessage("");
    setRestorePayload(null);
    setRestoreFileName("");
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      // Minimal client-side validation.
      if (!json?.data?.drivers || !json?.data?.trips || !json?.data?.settings) {
        setRestoreMessage("الملف لا يبدو أنه نسخة احتياطية صحيحة");
        return;
      }
      setRestorePayload(json);
      setRestoreFileName(file.name);
      setRestoreMessage("جاهز للاستعادة. اضغط زر الاستعادة عندما تكون متأكدًا.");
    } catch {
      setRestoreMessage("فشل قراءة ملف النسخة الاحتياطية");
    }
  };

  const restoreBackup = async () => {
    if (!restorePayload) {
      setRestoreMessage("يرجى اختيار ملف النسخة الاحتياطية أولاً");
      return;
    }
    const ok = confirm("سيتم حذف البيانات الحالية واستبدالها بالنسخة الاحتياطية. هل أنت متأكد؟");
    if (!ok) return;

    setRestoreInProgress(true);
    setRestoreMessage("");
    try {
      const res = await fetch("/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(restorePayload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRestoreMessage(data.message ?? "فشل الاستعادة");
        return;
      }
      setRestoreMessage("تمت الاستعادة بنجاح. جاري إعادة تحميل التطبيق...");
      window.location.reload();
    } catch {
      setRestoreMessage("فشل الاستعادة");
    } finally {
      setRestoreInProgress(false);
    }
  };

  return (
    <div className="space-y-4">
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

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 font-semibold">النسخة الاحتياطية</h2>

        <div className="space-y-3">
          <button
            type="button"
            disabled={backupInProgress}
            onClick={downloadBackup}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {backupInProgress ? "جاري إنشاء النسخة..." : "نسخة احتياطية (تصدير كامل التطبيق)"}
          </button>
          {backupMessage ? <p className="text-sm text-slate-600 dark:text-slate-300">{backupMessage}</p> : null}

          <div className="border-t border-slate-200 pt-3 dark:border-slate-700" />

          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            استعادة نسخة احتياطية (JSON)
          </label>
          <input
            type="file"
            accept="application/json,.json"
            disabled={restoreInProgress}
            onChange={(e) => void onRestoreFileChange(e.target.files?.[0] ?? null)}
            className="w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          {restoreFileName ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">الملف: {restoreFileName}</p>
          ) : null}
          <button
            type="button"
            disabled={restoreInProgress}
            onClick={restoreBackup}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {restoreInProgress ? "جاري الاستعادة..." : "استعادة نسخة احتياطية"}
          </button>
          {restoreMessage ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">{restoreMessage}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
