"use client";

import { useMemo } from "react";
import { DriverSearchSelect } from "@/components/driver-search-select";
import { calculateCommission } from "@/lib/commission";
import { fareThousandsUnitToStoredAmount } from "@/lib/fare-normalize";
import { formatCurrency } from "@/lib/format";
import type { Driver } from "@/types";
import type { SmartEntryRow } from "@/types/smart-entry";

type CommissionSettings = {
  commissionType: "percentage" | "fixed";
  commissionValue: number;
};

type SmartEntryReviewRowsProps = {
  rows: SmartEntryRow[];
  drivers: Driver[];
  settings: CommissionSettings;
  onChangeRow: (index: number, patch: Partial<SmartEntryRow>) => void;
  onSelectDriver: (index: number, driver: Driver | null) => void;
  onDriverCreated: (driver: Driver) => void;
  onRemoveRow: (index: number) => void;
};

function rowCommission(row: SmartEntryRow, settings: CommissionSettings) {
  const totalAmount = fareThousandsUnitToStoredAmount(row.totalFare);
  const gross = calculateCommission(
    settings.commissionType,
    settings.commissionValue,
    row.tripsCount,
    totalAmount,
  );
  return Math.max(0, Number((gross - (row.discount ?? 0)).toFixed(2)));
}

export function SmartEntryReviewRows({
  rows,
  drivers,
  settings,
  onChangeRow,
  onSelectDriver,
  onDriverCreated,
  onRemoveRow,
}: SmartEntryReviewRowsProps) {
  const inputClass =
    "w-full min-w-[4rem] rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800";

  const desktopRows = useMemo(() => rows, [rows]);

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-right dark:border-slate-700">
              <th className="p-2">اسم الكابتن</th>
              <th className="p-2 min-w-[200px]">السائق في النظام</th>
              <th className="p-2">الطلبات</th>
              <th className="p-2">المجموع (ألف)</th>
              <th className="p-2">التعويض</th>
              <th className="p-2">المحفوظ / العمولة</th>
              <th className="p-2">حالة</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {desktopRows.map((row, index) => (
              <tr
                key={`${row.captainName}-${index}-${row.driverId ?? "x"}`}
                className="border-b border-slate-100 align-top dark:border-slate-800"
              >
                <td className="p-2">
                  <p className="font-medium">{row.captainName}</p>
                  {row.sourceNames && row.sourceNames.length > 1 ? (
                    <p className="text-xs text-slate-500">دُمج: {row.sourceNames.join("، ")}</p>
                  ) : null}
                </td>
                <td className="p-2">
                  <DriverSearchSelect
                    drivers={drivers}
                    selectedId={row.driverId}
                    suggestedCaptainName={row.captainName}
                    autoMatchPercent={Math.round(row.matchConfidence * 100)}
                    onSelect={(driver) => onSelectDriver(index, driver)}
                    onDriverCreated={onDriverCreated}
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={row.tripsCount}
                    onChange={(e) =>
                      onChangeRow(index, {
                        tripsCount: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                    className={inputClass}
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={row.totalFare}
                    onChange={(e) =>
                      onChangeRow(index, {
                        totalFare: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className={inputClass}
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    min={0}
                    inputMode="decimal"
                    value={row.discount ?? 0}
                    onChange={(e) =>
                      onChangeRow(index, {
                        discount: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className={inputClass}
                  />
                </td>
                <td className="p-2 text-xs">
                  <p>{formatCurrency(fareThousandsUnitToStoredAmount(row.totalFare))}</p>
                  <p className="text-blue-600 dark:text-blue-300">
                    عمولة: {formatCurrency(rowCommission(row, settings))}
                  </p>
                </td>
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
                    onClick={() => onRemoveRow(index)}
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
            key={`${row.captainName}-${index}-m`}
            className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"
          >
            <p className="font-semibold">{row.captainName}</p>
            {row.sourceNames && row.sourceNames.length > 1 ? (
              <p className="text-xs text-slate-500">دُمج: {row.sourceNames.join("، ")}</p>
            ) : null}
            <div className="mt-2">
              <DriverSearchSelect
                drivers={drivers}
                selectedId={row.driverId}
                suggestedCaptainName={row.captainName}
                autoMatchPercent={Math.round(row.matchConfidence * 100)}
                onSelect={(driver) => onSelectDriver(index, driver)}
                onDriverCreated={onDriverCreated}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="text-xs">
                عدد الطلبات
                <input
                  type="number"
                  min={1}
                  value={row.tripsCount}
                  onChange={(e) =>
                    onChangeRow(index, {
                      tripsCount: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <label className="text-xs">
                المجموع (ألف)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={row.totalFare}
                  onChange={(e) =>
                    onChangeRow(index, {
                      totalFare: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <label className="text-xs">
                التعويض
                <input
                  type="number"
                  min={0}
                  value={row.discount ?? 0}
                  onChange={(e) =>
                    onChangeRow(index, {
                      discount: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <div className="text-xs">
                <p className="mt-4 text-slate-600 dark:text-slate-300">
                  محفوظ: {formatCurrency(fareThousandsUnitToStoredAmount(row.totalFare))}
                </p>
                <p className="text-blue-600 dark:text-blue-300">
                  عمولة: {formatCurrency(rowCommission(row, settings))}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onRemoveRow(index)}
              className="mt-2 text-xs text-red-600"
            >
              استبعاد
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
