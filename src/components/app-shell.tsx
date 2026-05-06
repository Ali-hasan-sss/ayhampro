"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/dashboard", label: "لوحة التحكم" },
  { href: "/drivers", label: "الموظفين" },
  { href: "/trips", label: "الطلبات اليومية" },
  { href: "/reports", label: "التقارير" },
  { href: "/settings", label: "الإعدادات" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col p-3 pb-[calc(env(safe-area-inset-bottom)+6.5rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:p-6 sm:pb-6">
      <header className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-bold">نظام محاسبة التكسي</h1>
          <button
            onClick={logout}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white dark:bg-slate-100 dark:text-slate-900"
          >
            تسجيل خروج
          </button>
        </div>
        <nav className="hidden flex-wrap gap-2 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-2 text-sm ${
                pathname === link.href
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.4rem)] pt-2 shadow-[0_-8px_20px_rgba(15,23,42,0.08)] backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto grid max-w-6xl grid-cols-5 gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-2 py-2 text-center text-xs ${
                pathname === link.href
                  ? "bg-blue-600 text-white"
                  : "text-slate-700 dark:text-slate-200"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
