export function MetricCard({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:rounded-2xl sm:p-4">
      <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">{title}</p>
      <p className="mt-1 text-lg font-bold sm:mt-2 sm:text-2xl">{value}</p>
    </div>
  );
}
