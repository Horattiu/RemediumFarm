import React, { useEffect, useRef, useState } from "react";
import { saveAs } from "file-saver";
import { timesheetService } from "@/features/timesheet/services/timesheetService";
import { leaveService } from "@/features/leaves/services/leaveService";
import { getLeaveTypeCode } from "@/features/leaves/utils/leave.utils";
import { employeeService } from "@/shared/services/employeeService";
import type { Leave } from "@/features/leaves/types/leave.types";
import type { Employee } from "@/shared/types/employee.types";
import type { Workplace } from "@/shared/types/workplace.types";
import type { TimesheetViewerEntry } from "@/features/timesheet/types/timesheet.types";

interface MonthDayLike {
  day: number;
  date: string;
  dayName: string;
  isWeekend: boolean;
}

interface AccountancyExportExcelButtonProps {
  workplaces: Workplace[];
  selectedWorkplace: string;
  selectedMonth: string;
  monthDays: MonthDayLike[];
  onSetError: (message: string) => void;
}

const getEntityId = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "_id" in value) {
    const maybeId = (value as { _id?: unknown })._id;
    return typeof maybeId === "string" ? maybeId : String(maybeId || "");
  }
  return String(value);
};

const normalizeDate = (dateValue: string | Date | null | undefined): string | null => {
  if (!dateValue) return null;
  if (typeof dateValue === "string" && dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) return dateValue;
  if (typeof dateValue === "string") {
    const match = dateValue.match(/(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }

  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const legalHolidays: Record<string, string> = {
  "01-01": "Anul Nou",
  "01-02": "A doua zi de Anul Nou",
  "01-06": "Boboteaza / Epifania",
  "01-07": "Sfântul Ioan Botezătorul",
  "01-24": "Ziua Unirii Principatelor Române",
  "04-10": "Vinerea Mare (Paște ortodox)",
  "04-12": "Paștele Ortodox",
  "04-13": "A doua zi de Paște",
  "05-01": "Ziua Muncii",
  "05-31": "Rusaliile",
  "06-01": "A doua zi de Rusalii & Ziua Copilului",
  "08-15": "Adormirea Maicii Domnului",
  "11-30": "Sfântul Andrei",
  "12-01": "Ziua Națională a României",
  "12-25": "Crăciunul (prima zi)",
  "12-26": "A doua zi de Crăciun",
};

const isLegalHoliday = (dateStr: string | null): boolean => {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const monthDay = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return !!legalHolidays[monthDay];
};

const isWeekendDate = (dateStr: string | null): boolean => {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
};

const escapeHtml = (value: string | number): string =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getMonthLabelForFile = (selectedMonth: string): string => {
  const [year, month] = selectedMonth.split("-").map(Number);
  const monthNames = [
    "ianuarie",
    "februarie",
    "martie",
    "aprilie",
    "mai",
    "iunie",
    "iulie",
    "august",
    "septembrie",
    "octombrie",
    "noiembrie",
    "decembrie",
  ];
  const safeMonth = month >= 1 && month <= 12 ? monthNames[month - 1] : selectedMonth;
  return `${safeMonth}-${year || ""}`.replace(/\s+/g, "-");
};

const getEmployeeMonthEntries = (
  employeeId: string,
  sourceTimesheets: TimesheetViewerEntry[],
  selectedMonth: string
) => {
  const [year, month] = selectedMonth.split("-").map(Number);
  return sourceTimesheets.filter((entry) => {
    const entryEmployeeId = getEntityId(entry.employeeId);
    if (entryEmployeeId !== String(employeeId)) return false;
    const entryDate = normalizeDate(entry.date);
    if (!entryDate) return false;
    const entryDateObj = new Date(entryDate);
    return entryDateObj.getFullYear() === year && entryDateObj.getMonth() + 1 === month;
  });
};

const getEmployeeMonthTotal = (
  employeeId: string,
  sourceTimesheets: TimesheetViewerEntry[],
  selectedMonth: string
): number => {
  const total = getEmployeeMonthEntries(employeeId, sourceTimesheets, selectedMonth).reduce((sum, entry) => {
    if (entry.hoursWorked && entry.hoursWorked > 0) return sum + entry.hoursWorked;
    return sum;
  }, 0);
  return Math.round(total * 10) / 10;
};

const getEmployeeWeekendHours = (
  employeeId: string,
  sourceTimesheets: TimesheetViewerEntry[],
  selectedMonth: string
): number => {
  const total = getEmployeeMonthEntries(employeeId, sourceTimesheets, selectedMonth).reduce((sum, entry) => {
    const entryDate = normalizeDate(entry.date);
    if (!entryDate) return sum;
    if (isWeekendDate(entryDate) && entry.hoursWorked && entry.hoursWorked > 0 && !entry.leaveType) {
      return sum + entry.hoursWorked;
    }
    return sum;
  }, 0);
  return Math.round(total * 10) / 10;
};

const getEmployeeLegalHolidayHours = (
  employeeId: string,
  sourceTimesheets: TimesheetViewerEntry[],
  selectedMonth: string
): number => {
  const total = getEmployeeMonthEntries(employeeId, sourceTimesheets, selectedMonth).reduce((sum, entry) => {
    const entryDate = normalizeDate(entry.date);
    if (!entryDate) return sum;
    if (isLegalHoliday(entryDate) && entry.hoursWorked && entry.hoursWorked > 0 && !entry.leaveType) {
      return sum + entry.hoursWorked;
    }
    return sum;
  }, 0);
  return Math.round(total * 10) / 10;
};

const getEmployeeSuplHours = (
  employee: Employee,
  sourceTimesheets: TimesheetViewerEntry[],
  selectedMonth: string
): number => {
  const totalHours = getEmployeeMonthTotal(employee._id, sourceTimesheets, selectedMonth);
  const targetHours = employee.monthlyTargetHours || 160;
  const suplHours = totalHours > targetHours ? totalHours - targetHours : 0;
  return Math.round(suplHours * 10) / 10;
};

const getEmployeeDayValue = (
  employeeId: string,
  date: string,
  sourceTimesheets: TimesheetViewerEntry[],
  sourceLeaves: Leave[]
): string => {
  const normalizedDate = normalizeDate(date);
  if (!normalizedDate) return "";

  const isExcludedLeaveDay = isWeekendDate(normalizedDate) || isLegalHoliday(normalizedDate);
  const leave = sourceLeaves.find((l) => {
    const leaveEmployeeId = getEntityId(l.employeeId);
    if (leaveEmployeeId !== String(employeeId) || l.status !== "Aprobată") return false;
    const startDate = normalizeDate(l.startDate);
    const endDate = normalizeDate(l.endDate);
    if (!startDate || !endDate) return false;
    return startDate <= normalizedDate && endDate >= normalizedDate;
  });
  if (leave && !isExcludedLeaveDay) return getLeaveTypeCode(leave.type);

  const dayEntries = sourceTimesheets.filter((entry) => {
    const entryEmployeeId = getEntityId(entry.employeeId);
    const entryDate = normalizeDate(entry.date);
    return entryEmployeeId === String(employeeId) && entryDate === normalizedDate;
  });
  if (dayEntries.length === 0) return "";

  const hasLeaveType = dayEntries.some((entry) => !!entry.leaveType);
  if (hasLeaveType && !isExcludedLeaveDay) {
    const leaveType = dayEntries.find((entry) => entry.leaveType)?.leaveType;
    return getLeaveTypeCode(String(leaveType || ""));
  }

  const totalHours = dayEntries.reduce((sum, entry) => {
    if (entry.hoursWorked && entry.hoursWorked > 0) return sum + entry.hoursWorked;
    return sum;
  }, 0);
  return totalHours > 0 ? String(Math.round(totalHours)) : "";
};

const AccountancyExportExcelButton: React.FC<AccountancyExportExcelButtonProps> = React.memo(
  ({ workplaces, selectedWorkplace, selectedMonth, monthDays, onSetError }) => {
    const [selectedExportWorkplaces, setSelectedExportWorkplaces] = useState<string[]>([]);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const exportContainerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      if (selectedWorkplace) {
        setSelectedExportWorkplaces([String(selectedWorkplace)]);
        return;
      }
      setSelectedExportWorkplaces(workplaces.map((wp) => String(wp._id)));
    }, [selectedWorkplace, workplaces]);

    const toggleWorkplace = (workplaceId: string) => {
      setSelectedExportWorkplaces((prev) =>
        prev.includes(workplaceId) ? prev.filter((id) => id !== workplaceId) : [...prev, workplaceId]
      );
    };

    useEffect(() => {
      if (!isExportMenuOpen) return;

      const handleClickOutside = (event: MouseEvent) => {
        if (!exportContainerRef.current) return;
        if (exportContainerRef.current.contains(event.target as Node)) return;
        setIsExportMenuOpen(false);
      };

      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          setIsExportMenuOpen(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }, [isExportMenuOpen]);

    const handleExportExcel = async () => {
      try {
        setIsExporting(true);
        onSetError("");

        const [year, month] = selectedMonth.split("-").map(Number);
        const lastDay = new Date(year, month, 0);
        const from = `${year}-${String(month).padStart(2, "0")}-01`;
        const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;

        const [allTimesheets, allLeaves, allEmployees] = await Promise.all([
          timesheetService.getAllEntries(from, to),
          leaveService.getAll(),
          employeeService.getAll(),
        ]);

        const selectedIds =
          selectedExportWorkplaces.length > 0
            ? selectedExportWorkplaces
            : workplaces.map((wp) => String(wp._id));

        const exportWorkplaces = workplaces.filter((wp) => selectedIds.includes(String(wp._id)));
        if (exportWorkplaces.length === 0) {
          onSetError("Selectează cel puțin un punct de lucru pentru export.");
          return;
        }

        const headerLabels = [
          "Punct de lucru",
          "Angajat",
          ...monthDays.map((day) => `${day.dayName} ${day.day}`),
          "Total",
          "SUPL",
          "WE",
          "S.L",
        ];
        const headerHtml = headerLabels
          .map((label, index) => {
            let cls = "";
            if (index >= 2 && index <= monthDays.length + 1) {
              const day = monthDays[index - 2];
              if (isLegalHoliday(day.date)) cls = " holiday";
              else if (day.isWeekend) cls = " weekend";
            } else if (index > monthDays.length + 1) {
              cls = " totals";
            }
            return `<th class="${cls.trim()}">${escapeHtml(label)}</th>`;
          })
          .join("");

        const sectionsHtml = exportWorkplaces
          .map((workplace) => {
            const workplaceEmployees = allEmployees
              .filter((emp) => getEntityId(emp.workplaceId) === String(workplace._id))
              .sort((a, b) => a.name.localeCompare(b.name));

            if (workplaceEmployees.length === 0) {
              return `
                <h3 class="workplace-title">${escapeHtml(`Punct de lucru: ${workplace.name}`)}</h3>
                <table>
                  <tr><td class="empty-row">Nu există angajați pentru acest punct de lucru.</td></tr>
                </table>
              `;
            }

            const rowsHtml = workplaceEmployees
              .map((employee, rowIndex) => {
                const dayCells = monthDays
                  .map((day) => {
                    const value = getEmployeeDayValue(employee._id, day.date, allTimesheets, allLeaves);
                    let cls = "";
                    if (isLegalHoliday(day.date)) cls = "holiday";
                    else if (day.isWeekend) cls = "weekend";
                    return `<td class="${cls}">${escapeHtml(value || "")}</td>`;
                  })
                  .join("");

                return `
                  <tr class="${rowIndex % 2 === 0 ? "row-even" : "row-odd"}">
                    <td class="workplace-cell">${escapeHtml(workplace.name)}</td>
                    <td class="employee-cell">${escapeHtml(employee.name)}</td>
                    ${dayCells}
                    <td class="totals">${escapeHtml(getEmployeeMonthTotal(employee._id, allTimesheets, selectedMonth))}</td>
                    <td class="totals">${escapeHtml(getEmployeeSuplHours(employee, allTimesheets, selectedMonth))}</td>
                    <td class="totals">${escapeHtml(getEmployeeWeekendHours(employee._id, allTimesheets, selectedMonth))}</td>
                    <td class="totals">${escapeHtml(
                      getEmployeeLegalHolidayHours(employee._id, allTimesheets, selectedMonth)
                    )}</td>
                  </tr>
                `;
              })
              .join("");

            return `
              <h3 class="workplace-title">${escapeHtml(`Punct de lucru: ${workplace.name}`)}</h3>
              <table>
                <thead>
                  <tr>${headerHtml}</tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
            `;
          })
          .join('<div class="section-space"></div>');

        const documentHtml = `
          <html>
            <head>
              <meta charset="utf-8" />
              <style>
                html, body {
                  font-family: Calibri, Arial, sans-serif;
                  color: #0f172a;
                  margin: 0;
                  padding: 0;
                  /* Simulează grid-ul de foi Excel și în afara tabelului */
                  background-image:
                    repeating-linear-gradient(to right, #e2e8f0 0, #e2e8f0 1px, transparent 1px, transparent 64px),
                    repeating-linear-gradient(to bottom, #e2e8f0 0, #e2e8f0 1px, transparent 1px, transparent 22px);
                }
                .sheet {
                  padding: 8px;
                }
                .report-title { background: #0f766e; color: #ffffff; font-size: 18px; font-weight: 700; padding: 8px 10px; }
                .generated-at { color: #475569; font-style: italic; margin: 8px 0 12px; }
                .workplace-title { background: #1d4ed8; color: #ffffff; padding: 6px 10px; margin: 12px 0 0; }
                table { border-collapse: collapse; width: 100%; table-layout: fixed; border: 1px solid #94a3b8; background: #ffffff; }
                th, td { border: 1px solid #e2e8f0; padding: 4px; text-align: center; font-size: 11px; }
                th { background: #dbeafe; font-weight: 700; }
                .workplace-cell { text-align: left; min-width: 180px; }
                .employee-cell { text-align: left; min-width: 220px; }
                .totals { background: #d1fae5; font-weight: 700; }
                .weekend { background: #fef3c7; }
                .holiday { background: #ede9fe; }
                .row-even td { background: #f8fafc; }
                .row-odd td { background: #ffffff; }
                .row-even td.weekend, .row-odd td.weekend { background: #fff7d6; }
                .row-even td.holiday, .row-odd td.holiday { background: #f5f3ff; }
                .row-even td.totals, .row-odd td.totals { background: #ecfdf5; }
                .empty-row { text-align: left; font-style: italic; color: #64748b; padding: 8px; }
                .section-space { height: 16px; }
              </style>
            </head>
            <body>
              <div class="sheet">
                <div class="report-title">${escapeHtml(`Raport contabilitate - ${selectedMonth}`)}</div>
                <div class="generated-at">${escapeHtml(`Generat la: ${new Date().toLocaleString("ro-RO")}`)}</div>
                ${sectionsHtml}
              </div>
            </body>
          </html>
        `;

        const fileBlob = new Blob(["\ufeff", documentHtml], {
          type: "application/vnd.ms-excel;charset=utf-8;",
        });
        const now = new Date();
        const fileDate = `${String(now.getDate()).padStart(2, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`;
        const monthLabel = getMonthLabelForFile(selectedMonth);
        saveAs(fileBlob, `pontaj ${monthLabel} ${fileDate}.xls`);
        setIsExportMenuOpen(false);
      } catch (err) {
        console.error("Eroare la export Excel:", err);
        const errorMessage = err instanceof Error ? err.message : "Eroare necunoscută";
        onSetError(`Nu am putut genera fișierul Excel: ${errorMessage}`);
      } finally {
        setIsExporting(false);
      }
    };

    return (
      <div ref={exportContainerRef} className="relative min-w-0">
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Export raport
        </label>
        <button
          type="button"
          onClick={() => setIsExportMenuOpen((prev) => !prev)}
          disabled={isExporting || workplaces.length === 0}
          className={`group w-auto min-w-[170px] h-[38px] rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 ${
            isExportMenuOpen
              ? "bg-emerald-700 text-white border border-emerald-700"
              : "bg-emerald-600 text-white border border-emerald-600 hover:bg-emerald-700 hover:border-emerald-700"
          }`}
        >
          <span className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16V4m0 12l-4-4m4 4l4-4M4 20h16" />
              </svg>
              {isExporting ? "Generez Excel..." : "Descarcă Excel"}
            </span>
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${isExportMenuOpen ? "rotate-180" : "rotate-0"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </button>

        {isExportMenuOpen && (
          <div className="absolute left-0 top-full mt-2 w-[360px] max-w-[min(90vw,360px)] bg-white border border-slate-200 rounded-xl shadow-xl p-4 z-20">
            <p className="text-sm font-semibold text-slate-800 mb-3">
              Selectează punctele de lucru
            </p>

            <label className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100">
              <input
                type="checkbox"
                checked={workplaces.length > 0 && selectedExportWorkplaces.length === workplaces.length}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedExportWorkplaces(workplaces.map((wp) => String(wp._id)));
                  } else {
                    setSelectedExportWorkplaces([]);
                  }
                }}
                className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
              />
              <span className="text-sm font-medium text-slate-700">Toate punctele de lucru</span>
            </label>

            <div className="max-h-52 overflow-auto space-y-2 pr-1">
              {workplaces.map((wp) => {
                const id = String(wp._id);
                return (
                  <label key={id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedExportWorkplaces.includes(id)}
                      onChange={() => toggleWorkplace(id)}
                      className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-700">{wp.name}</span>
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsExportMenuOpen(false)}
                className="px-3 py-2 text-xs font-semibold text-slate-600 rounded-lg hover:bg-slate-100"
              >
                Închide
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={isExporting || workplaces.length === 0}
                className="px-3 py-2 text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-lg hover:from-emerald-700 hover:to-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Exportă
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
);

AccountancyExportExcelButton.displayName = "AccountancyExportExcelButton";

export default AccountancyExportExcelButton;
