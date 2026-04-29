import React, { useState, useEffect, useMemo, useDeferredValue, startTransition } from "react";
import { useNavigate } from "react-router-dom";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { timesheetService } from "@/features/timesheet/services/timesheetService";
import { leaveService } from "@/features/leaves/services/leaveService";
import { formatLeaveType, getLeaveTypeCode } from "@/features/leaves/utils/leave.utils";
import { LeaveRequestPDF } from "@/features/pdf";
import { generateLeavePdfBlob, generateLeaveImageBlob } from "@/features/pdf/services/leaveDocumentService";
import { employeeService } from "@/shared/services/employeeService";
import { workplaceService } from "@/shared/services/workplaceService";
import { getUserFromStorage } from "@/features/auth/utils/auth.utils";
import { AnnouncementsBanner } from "@/shared/components/AnnouncementsBanner";
import AccountancyExportExcelButton from "./AccountancyExportExcelButton";
import type { User } from "@/features/auth/types/auth.types";
import type { Leave } from "@/features/leaves/types/leave.types";
import type { Workplace } from "@/shared/types/workplace.types";
import type { Employee } from "@/shared/types/employee.types";
import type { TimesheetViewerEntry } from "@/features/timesheet/types/timesheet.types";

type ActiveView = "pontaj" | "cereriAprobate" | "cereriAsteptare";

interface MonthDay {
  day: number;
  date: string; // YYYY-MM-DD
  dayOfWeek: number;
  dayName: string;
  isWeekend: boolean;
}

interface DayData {
  type: "leave" | "work";
  value: string;
  leaveTypeFull?: string;
  hasVisitor?: boolean;
  visitorWorkplaces?: Array<{
    workplaceName: string;
    hoursWorked: number;
  }>;
  date?: string;
}

interface LegalHolidays {
  [key: string]: string;
}

/**
 * AccountancyDashboard
 * Componentă pentru contabilitate - rapoarte, ore lucrate, organizate pe puncte de lucru
 * Tabel cu zilele săptămânii din lună (L, M, M, J, V, S)
 */
const AccountancyDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [, setAuthUser] = useState<User | null>(null);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [selectedWorkplace, setSelectedWorkplace] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [timesheets, setTimesheets] = useState<TimesheetViewerEntry[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadingTimesheets, setLoadingTimesheets] = useState(false);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const [error, setError] = useState("");
  const [showOnlyVisitors, setShowOnlyVisitors] = useState(false);
  const showOnlyVisitorsForTable = useDeferredValue(showOnlyVisitors);
  const [activeView, setActiveView] = useState<ActiveView>("pontaj");
  const [searchEmployeeLeaves, setSearchEmployeeLeaves] = useState("");
  const [showCalcHelpModal, setShowCalcHelpModal] = useState(false);
  const [showLeavePDF, setShowLeavePDF] = useState(false);
  const [pdfLeave, setPdfLeave] = useState<Leave | null>(null);
  const [pdfEmployee, setPdfEmployee] = useState<Employee | null>(null);
  const [pdfWorkplaceName, setPdfWorkplaceName] = useState("");
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const [showBulkFormatModal, setShowBulkFormatModal] = useState(false);
  const [pendingBulkLeaves, setPendingBulkLeaves] = useState<Leave[]>([]);

  const getEntityId = (value: unknown): string => {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object" && value !== null && "_id" in value) {
      const maybeId = (value as { _id?: unknown })._id;
      return typeof maybeId === "string" ? maybeId : String(maybeId || "");
    }
    return String(value);
  };

  const openLeavePDF = (leave: Leave, employeeName: string, workplaceName: string) => {
    const leaveEmployeeId = getEntityId(leave.employeeId) || `leave-${leave._id}`;
    const leaveWorkplaceId = getEntityId(leave.workplaceId);
    const employeeFromList = employees.find((e) => String(e._id) === String(leaveEmployeeId));

    const fallbackEmployee: Employee = {
      _id: leaveEmployeeId,
      name: employeeName || "Necunoscut",
      workplaceId: leaveWorkplaceId || "",
      isActive: true,
      function: leave.function || "",
      email: "",
    };

    setPdfLeave(leave);
    setPdfEmployee(employeeFromList || fallbackEmployee);
    setPdfWorkplaceName(workplaceName || "Necunoscut");
    setShowLeavePDF(true);
  };

  const askBulkDownloadFormat = (filteredLeaves: Leave[]) => {
    setPendingBulkLeaves(filteredLeaves);
    setShowBulkFormatModal(true);
  };

  const getAllMonthlyLeavesAcrossWorkplaces = (): Leave[] => {
    const normalized = leaves
      .filter((leave) => {
        const start = normalizeDate(leave.startDate);
        const end = normalizeDate(leave.endDate);
        if (!start || !end) return false;
        return !(end < monthRange.from || start > monthRange.to);
      })
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    return normalized;
  };

  const downloadLeavesBulk = async (format: "pdf" | "image") => {
    const uniqueLeaves = Array.from(
      new Map((pendingBulkLeaves || []).map((leave) => [String(leave._id), leave])).values()
    );
    const filteredLeaves = uniqueLeaves;
    if (filteredLeaves.length === 0) {
      setError("Nu există cereri de descărcat pentru filtrul curent.");
      return;
    }

    try {
      setIsBulkDownloading(true);
      setError("");
      const zip = new JSZip();
      const workplaceMap = new Map(workplaces.map((w) => [String(w._id), w.name]));
      const folderMap = new Map<string, JSZip>();
      const shouldGroupByWorkplaceFolder = !selectedWorkplace;

      for (const leave of filteredLeaves) {
        const employeeName =
          leave.name ||
          (typeof leave.employeeId === "object" && leave.employeeId?.name) ||
          "Necunoscut";
        const leaveEmployeeId = getEntityId(leave.employeeId) || `leave-${leave._id}`;
        const leaveWorkplaceId = getEntityId(leave.workplaceId);
        const workplaceName =
          (typeof leave.workplaceId === "object" && leave.workplaceId?.name) ||
          workplaceMap.get(leaveWorkplaceId) ||
          "Necunoscut";
        const safeFolderName = workplaceName.replace(/[\\/:*?"<>|]+/g, "_");

        let targetFolder: JSZip = zip;
        if (shouldGroupByWorkplaceFolder) {
          if (!folderMap.has(safeFolderName)) {
            folderMap.set(safeFolderName, zip.folder(safeFolderName) || zip);
          }
          targetFolder = folderMap.get(safeFolderName) || zip;
        }

        const employeeFromList = employees.find((e) => String(e._id) === String(leaveEmployeeId));
        const fallbackEmployee: Employee = {
          _id: leaveEmployeeId,
          name: employeeName,
          workplaceId: leaveWorkplaceId || "",
          isActive: true,
          function: leave.function || "",
          email: "",
        };

        const generator = format === "image" ? generateLeaveImageBlob : generateLeavePdfBlob;
        const { blob, fileName } = await generator(leave, employeeFromList || fallbackEmployee, workplaceName);
        targetFolder.file(fileName, blob);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const now = new Date();
      const fileDate = `${String(now.getDate()).padStart(2, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`;
      const scopeName = selectedWorkplace
        ? (workplaces.find((w) => String(w._id) === String(selectedWorkplace))?.name || "punct-lucru")
        : "toate-punctele";
      const scopeSafe = scopeName.replace(/[\\/:*?"<>|]+/g, "_");
      saveAs(zipBlob, `cereri-concediu-${format}-${scopeSafe}-${selectedMonth}-${fileDate}.zip`);
      setShowBulkFormatModal(false);
      setPendingBulkLeaves([]);
    } catch (err) {
      console.error("Eroare la descărcarea cererilor în masă:", err);
      setError("Nu am putut genera arhiva cu cereri. Verifică template-ul PDF și încearcă din nou.");
    } finally {
      setIsBulkDownloading(false);
    }
  };

  const reloadLeaves = async () => {
    setLoadingLeaves(true);
    try {
      if (selectedWorkplace) {
        const leavesData = await leaveService.getByWorkplace(selectedWorkplace);
        setLeaves(leavesData);
      } else {
        const leavesData = await leaveService.getAll();
        setLeaves(leavesData);
      }
    } catch (err) {
      console.error("Eroare la actualizarea concediilor:", err);
      setError((prev) => prev || "Eroare la actualizarea concediilor.");
    } finally {
      setLoadingLeaves(false);
    }
  };

  const getModificationNote = (leave: Leave): string =>
    String(leave.modificationNote || "").trim();

  const isModifiedLeave = (leave: Leave): boolean =>
    Boolean(leave.wasModified || leave.modificationNote);

  const renderModificationNote = (leave: Leave) => {
    const note =
      getModificationNote(leave) ||
      "Cererea a fost editata si necesita reaprobare manager.";
    const parts = note.split(/(\d{2}\.\d{2}\.\d{4})/g);
    return (
      <>
        {parts.map((part, idx) =>
          /^\d{2}\.\d{2}\.\d{4}$/.test(part) ? (
            <strong key={`${part}-${idx}`}>{part}</strong>
          ) : (
            <React.Fragment key={`${part}-${idx}`}>{part}</React.Fragment>
          )
        )}
      </>
    );
  };

  const getEffectiveStatus = (leave: Leave): Leave["status"] | "În așteptare" =>
    isModifiedLeave(leave) ? "În așteptare" : leave.status;

  const isApprovedStatus = (leave: Leave): boolean => {
    const effectiveStatus = getEffectiveStatus(leave);
    return effectiveStatus === "Aprobată" || effectiveStatus === "approved";
  };

  const isPendingStatus = (leave: Leave): boolean => {
    const effectiveStatus = getEffectiveStatus(leave);
    return (
      effectiveStatus === "În așteptare" ||
      effectiveStatus === "pending" ||
      leave.status === "În așteptare" ||
      leave.status === "pending"
    );
  };

  // Verifică autentificarea și rolul
  useEffect(() => {
    const user = getUserFromStorage();
    setAuthUser(user);
    
    if (!user) {
      navigate("/", { replace: true });
      return;
    }
    
    // ✅ Permite acces pentru accountancy, superadmin și admin
    const allowedRoles = ["accountancy", "superadmin", "admin"];
    if (!allowedRoles.includes(user.role)) {
      console.warn("⚠️ Acces neautorizat la AccountancyDashboard. Rol:", user.role);
      navigate("/", { replace: true });
      return;
    }
  }, [navigate]);

  // Încarcă workplaces
  useEffect(() => {
    const loadWorkplaces = async () => {
      try {
        const data = await workplaceService.getAll();
        setWorkplaces(data);
      } catch (err) {
        console.error("Eroare la încărcarea workplaces:", err);
      }
    };
    loadWorkplaces();
  }, []);

  // Încarcă datele pentru luna selectată
  useEffect(() => {
    if (!selectedMonth) return;

    let alive = true;

    const loadData = async () => {
      setLoadingEmployees(true);
      setLoadingTimesheets(true);
      setLoadingLeaves(true);
      setError("");

      try {
        const [year, month] = selectedMonth.split("-").map(Number);
        const lastDay = new Date(year, month, 0);
        
        const from = `${year}-${String(month).padStart(2, "0")}-01`;
        const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;

        // 1) Încărcăm mai întâi angajații (rapid) -> pagina apare instant.
        if (selectedWorkplace) {
          const employeesData = await employeeService.getByWorkplace(selectedWorkplace);
          if (!alive) return;

          const employeesFromSelectedWorkplace = employeesData.filter((emp) => {
            const empWorkplaceId = typeof emp.workplaceId === 'string' 
              ? emp.workplaceId 
              : String((emp.workplaceId as any)?._id || emp.workplaceId || '');
            return empWorkplaceId === String(selectedWorkplace);
          });

          setEmployees(employeesFromSelectedWorkplace);
          setLoadingEmployees(false);

          // 2) Încărcăm progresiv datele grele, în paralel.
          timesheetService
            .getEntriesByWorkplace(selectedWorkplace, from, to)
            .then((timesheetsData) => {
              if (!alive) return;
              startTransition(() => {
                setTimesheets(timesheetsData);
              });
            })
            .catch((err) => {
              console.error("Eroare la încărcarea pontajului:", err);
              if (!alive) return;
              setError((prev) => prev || "Eroare la încărcarea pontajului.");
            })
            .finally(() => {
              if (!alive) return;
              setLoadingTimesheets(false);
            });

          leaveService
            .getByWorkplace(selectedWorkplace)
            .then((leavesData) => {
              if (!alive) return;
              setLeaves(leavesData);
            })
            .catch((err) => {
              console.error("Eroare la încărcarea concediilor:", err);
              if (!alive) return;
              setError((prev) => prev || "Eroare la încărcarea concediilor.");
            })
            .finally(() => {
              if (!alive) return;
              setLoadingLeaves(false);
            });
        } else {
          const employeesData = await employeeService.getAll();
          if (!alive) return;
          setEmployees(employeesData);
          setLoadingEmployees(false);

          timesheetService
            .getAllEntries(from, to)
            .then((timesheetsData) => {
              if (!alive) return;
              startTransition(() => {
                setTimesheets(timesheetsData);
              });
            })
            .catch((err) => {
              console.error("Eroare la încărcarea pontajului:", err);
              if (!alive) return;
              setError((prev) => prev || "Eroare la încărcarea pontajului.");
            })
            .finally(() => {
              if (!alive) return;
              setLoadingTimesheets(false);
            });

          leaveService
            .getAll()
            .then((leavesData) => {
              if (!alive) return;
              setLeaves(leavesData);
            })
            .catch((err) => {
              console.error("Eroare la încărcarea concediilor:", err);
              if (!alive) return;
              setError((prev) => prev || "Eroare la încărcarea concediilor.");
            })
            .finally(() => {
              if (!alive) return;
              setLoadingLeaves(false);
            });
        }
      } catch (err) {
        console.error("Eroare la încărcarea datelor:", err);
        setError("Eroare la încărcarea datelor.");
        if (alive) {
          setLoadingEmployees(false);
          setLoadingTimesheets(false);
          setLoadingLeaves(false);
        }
      }
    };

    loadData();
    return () => {
      alive = false;
    };
  }, [selectedMonth, selectedWorkplace]);

  // ✅ Reîncarcă doar concediile la focus și la modificări externe
  useEffect(() => {
    const onFocus = () => {
      if (activeView !== "pontaj") {
        reloadLeaves();
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, selectedWorkplace]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "leavesChangedAt") return;
      if (activeView !== "pontaj") {
        reloadLeaves();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, selectedWorkplace]);

  // Calculează zilele lunii cu zilele săptămânii
  const monthDays = useMemo<MonthDay[]>(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const lastDay = new Date(year, month, 0);
    const allDays: MonthDay[] = [];

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      const dayName = ["D", "L", "M", "M", "J", "V", "S"][dayOfWeek];
      
      allDays.push({
        day,
        date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        dayOfWeek,
        dayName,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      });
    }

    return allDays;
  }, [selectedMonth]);

  // Helper: normalizează data la format "YYYY-MM-DD"
  const normalizeDate = (dateValue: string | Date | null | undefined): string | null => {
    if (!dateValue) return null;
    
    if (typeof dateValue === "string" && dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateValue;
    }
    
    if (typeof dateValue === "string") {
      const match = dateValue.match(/(\d{4}-\d{2}-\d{2})/);
      if (match) return match[1];
    }
    
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) {
      console.warn("⚠️ Invalid date value:", dateValue);
      return null;
    }
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Map cu toate sărbătorile legale
  const legalHolidays: LegalHolidays = {
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

  // Returnează numele sărbătorii legale pentru o dată (sau null)
  const getLegalHolidayName = (dateStr: string | null): string | null => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const monthDay = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return legalHolidays[monthDay] || null;
  };

  // Verifică dacă o dată este sărbătoare legală
  const isLegalHoliday = (dateStr: string | null): boolean => {
    return !!getLegalHolidayName(dateStr);
  };

  // Verifică dacă o dată este weekend
  const isWeekendDate = (dateStr: string | null): boolean => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
  };

  const monthRange = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const from = `${year}-${String(month).padStart(2, "0")}-01`;
    const to = `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
    return { year, month, from, to };
  }, [selectedMonth]);

  const filteredLeavesForActiveView = useMemo(() => {
    if (activeView !== "cereriAprobate" && activeView !== "cereriAsteptare") return [];

    const isTargetStatus = activeView === "cereriAsteptare" ? isPendingStatus : isApprovedStatus;
    let filteredLeaves = leaves.filter(isTargetStatus);

    filteredLeaves = filteredLeaves.filter((l) => {
      const start = normalizeDate(l.startDate);
      const end = normalizeDate(l.endDate);
      if (!start || !end) return false;
      return !(end < monthRange.from || start > monthRange.to);
    });

    if (selectedWorkplace) {
      filteredLeaves = filteredLeaves.filter((l) => {
        const lWorkplaceId = typeof l.workplaceId === "string"
          ? l.workplaceId
          : String((l.workplaceId as any)?._id || l.workplaceId || "");
        return lWorkplaceId === String(selectedWorkplace);
      });
    }

    if (searchEmployeeLeaves) {
      const searchLower = searchEmployeeLeaves.toLowerCase();
      filteredLeaves = filteredLeaves.filter((l) => {
        let empName = "";
        if (l.name) {
          empName = l.name;
        } else if (typeof l.employeeId === "object" && l.employeeId && "name" in l.employeeId) {
          empName = String((l.employeeId as any).name || "");
        }
        return empName.toLowerCase().includes(searchLower);
      });
    }

    return filteredLeaves.sort((a, b) => {
      const dateA = new Date(a.startDate);
      const dateB = new Date(b.startDate);
      return dateB.getTime() - dateA.getTime();
    });
  }, [
    activeView,
    leaves,
    monthRange.from,
    monthRange.to,
    selectedWorkplace,
    searchEmployeeLeaves,
  ]);

  const dataMaps = useMemo(() => {
    const dayDataMap = new Map<string, DayData>();
    const monthTotals = new Map<string, { total: number; visitor: number; weekend: number; legal: number }>();

    const ensureTotals = (employeeId: string) => {
      if (!monthTotals.has(employeeId)) {
        monthTotals.set(employeeId, { total: 0, visitor: 0, weekend: 0, legal: 0 });
      }
      return monthTotals.get(employeeId)!;
    };

    // 1) Agregăm pontajele pe employee+date și metricile lunare într-o singură trecere
    for (const ts of timesheets) {
      const employeeId = typeof ts.employeeId === "string"
        ? ts.employeeId
        : String((ts.employeeId as any)?._id || ts.employeeId || "");
      if (!employeeId) continue;

      const tsDate = normalizeDate(ts.date);
      if (!tsDate) continue;
      if (tsDate < monthRange.from || tsDate > monthRange.to) continue;

      const totals = ensureTotals(employeeId);
      const hours = ts.hoursWorked && ts.hoursWorked > 0 ? ts.hoursWorked : 0;
      if (hours > 0) {
        totals.total += hours;
        if (ts.type === "visitor") totals.visitor += hours;
        if (!ts.leaveType && isWeekendDate(tsDate)) totals.weekend += hours;
        if (!ts.leaveType && isLegalHoliday(tsDate)) totals.legal += hours;
      }

      const key = `${employeeId}__${tsDate}`;
      const existing = dayDataMap.get(key);
      if (existing?.type === "leave") continue;

      const visitorWorkplaces = existing?.visitorWorkplaces ? [...existing.visitorWorkplaces] : [];
      if (ts.type === "visitor" && ts.workplaceName && hours > 0) {
        visitorWorkplaces.push({ workplaceName: ts.workplaceName, hoursWorked: hours });
      }

      const totalHours = (existing?.type === "work" ? Number(existing.value) || 0 : 0) + (hours > 0 ? hours : 0);

      if (ts.leaveType && !isWeekendDate(tsDate) && !isLegalHoliday(tsDate)) {
        dayDataMap.set(key, {
          type: "leave",
            value: getLeaveTypeCode(ts.leaveType),
          leaveTypeFull: formatLeaveType(ts.leaveType),
        });
      } else if (totalHours > 0) {
        dayDataMap.set(key, {
          type: "work",
          value: String(Math.round(totalHours)),
          hasVisitor: visitorWorkplaces.length > 0,
          visitorWorkplaces,
          date: tsDate,
        });
      }
    }

    // 2) Suprascriem cu concediile aprobate (prioritate) pe zile eligibile
    for (const leave of leaves) {
      if (getEffectiveStatus(leave) !== "Aprobată") continue;
      const employeeId = typeof leave.employeeId === "string"
        ? leave.employeeId
        : String((leave.employeeId as any)?._id || leave.employeeId || "");
      if (!employeeId) continue;

      const start = normalizeDate(leave.startDate);
      const end = normalizeDate(leave.endDate);
      if (!start || !end) continue;

      const overlapStart = start > monthRange.from ? start : monthRange.from;
      const overlapEnd = end < monthRange.to ? end : monthRange.to;
      if (overlapStart > overlapEnd) continue;

      let current = new Date(overlapStart);
      const endDate = new Date(overlapEnd);
      while (current <= endDate) {
        const currentStr = normalizeDate(current);
        if (currentStr && !isWeekendDate(currentStr) && !isLegalHoliday(currentStr)) {
          dayDataMap.set(`${employeeId}__${currentStr}`, {
            type: "leave",
            value: getLeaveTypeCode(leave.type),
            leaveTypeFull: formatLeaveType(leave.type),
          });
        }
        current.setDate(current.getDate() + 1);
      }
    }

    const leaveDaysByEmployee = new Map<string, number>();
    for (const [key, value] of dayDataMap.entries()) {
      if (value.type !== "leave") continue;
      const employeeId = key.split("__")[0];
      leaveDaysByEmployee.set(employeeId, (leaveDaysByEmployee.get(employeeId) || 0) + 1);
    }

    return { dayDataMap, monthTotals, leaveDaysByEmployee };
  }, [timesheets, leaves, monthRange]);

  // Lookups O(1) în render (elimină blocajul la click pe checkbox)
  const getEmployeeDayData = (employeeId: string, date: string): DayData | null => {
    const normalizedDate = normalizeDate(date);
    if (!normalizedDate) return null;
    return dataMaps.dayDataMap.get(`${String(employeeId)}__${normalizedDate}`) || null;
  };

  const getEmployeeMonthTotal = (employeeId: string): number => {
    const totals = dataMaps.monthTotals.get(String(employeeId));
    return Math.round((totals?.total || 0) * 10) / 10;
  };

  const getEmployeeVisitorHours = (employeeId: string): number => {
    const totals = dataMaps.monthTotals.get(String(employeeId));
    return Math.round(totals?.visitor || 0);
  };

  const getEmployeeWeekendHours = (employeeId: string): number => {
    const totals = dataMaps.monthTotals.get(String(employeeId));
    return Math.round((totals?.weekend || 0) * 10) / 10;
  };

  const getEmployeeLegalHolidayHours = (employeeId: string): number => {
    const totals = dataMaps.monthTotals.get(String(employeeId));
    return Math.round((totals?.legal || 0) * 10) / 10;
  };

  const getEmployeeSuplHours = (employeeId: string): number => {
    const totalHours = getEmployeeMonthTotal(employeeId);
    const employee = employees.find((emp) => String(emp._id) === String(employeeId));
    const targetHours = employee?.monthlyTargetHours || 160;
    const suplHours = totalHours > targetHours ? totalHours - targetHours : 0;
    return Math.round(suplHours * 10) / 10;
  };

  const getEmployeeNormHours = (employeeId: string): number => {
    const normalizedEmployeeId = String(employeeId);
    const totalHours = getEmployeeMonthTotal(normalizedEmployeeId);
    const leaveDays = dataMaps.leaveDaysByEmployee.get(normalizedEmployeeId) || 0;
    return Math.round((totalHours + leaveDays * 8) * 10) / 10;
  };

  // Formatare dată
  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString("ro-RO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Formatare tip concediu
  const getLeaveTypeLabel = (type: string | undefined): string => formatLeaveType(type || "");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-[98vw] mx-auto p-6">
        {/* HEADER MODERN */}
        <div className="mb-6">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 mb-1">
                    Raport Contabilitate
                  </h1>
                  <p className="text-sm text-slate-500">
                    Vizualizează orele lucrate și concediile pe farmacii
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCalcHelpModal(true)}
                className="px-3 py-2 rounded-lg border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors text-sm font-semibold"
              >
                Cum se calculează orele
              </button>
            </div>

            {/* ✅ Mesaje de la manager */}
            <AnnouncementsBanner />

            {/* TABS */}
            <div className="flex gap-2 mb-6 border-b border-slate-200">
              <button
                onClick={() => setActiveView("pontaj")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeView === "pontaj"
                    ? "text-emerald-600 border-b-2 border-emerald-600"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Raport Pontaj
              </button>
              <button
                onClick={() => setActiveView("cereriAprobate")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeView === "cereriAprobate"
                    ? "text-emerald-600 border-b-2 border-emerald-600"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Cereri Aprobate
                {leaves.filter(isApprovedStatus).length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                    {leaves.filter(isApprovedStatus).length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveView("cereriAsteptare")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeView === "cereriAsteptare"
                    ? "text-amber-600 border-b-2 border-amber-600"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Cereri În așteptare
                {leaves.filter(isPendingStatus).length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                    {leaves.filter(isPendingStatus).length}
                  </span>
                )}
              </button>
            </div>

            {/* FILTRE */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Farmacie
                </label>
                <select
                  value={selectedWorkplace}
                  onChange={(e) => setSelectedWorkplace(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 bg-white hover:border-slate-400"
                >
                  <option value="">Toate farmaciile</option>
                  {workplaces.map((wp) => (
                    <option key={wp._id} value={wp._id}>
                      {wp.name}
                    </option>
                  ))}
                </select>
              </div>

              {activeView === "pontaj" ? (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Luna
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={selectedMonth ? selectedMonth.split("-")[1] : ""}
                        onChange={(e) => {
                          const year = selectedMonth ? selectedMonth.split("-")[0] : new Date().getFullYear();
                          const month = e.target.value;
                          setSelectedMonth(`${year}-${month}`);
                        }}
                        className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 bg-white hover:border-slate-400"
                      >
                        <option value="01">Ianuarie</option>
                        <option value="02">Februarie</option>
                        <option value="03">Martie</option>
                        <option value="04">Aprilie</option>
                        <option value="05">Mai</option>
                        <option value="06">Iunie</option>
                        <option value="07">Iulie</option>
                        <option value="08">August</option>
                        <option value="09">Septembrie</option>
                        <option value="10">Octombrie</option>
                        <option value="11">Noiembrie</option>
                        <option value="12">Decembrie</option>
                      </select>
                      <select
                        value={selectedMonth ? selectedMonth.split("-")[0] : ""}
                        onChange={(e) => {
                          const year = e.target.value;
                          const month = selectedMonth ? selectedMonth.split("-")[1] : String(new Date().getMonth() + 1).padStart(2, "0");
                          setSelectedMonth(`${year}-${month}`);
                        }}
                        className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 bg-white hover:border-slate-400"
                      >
                        {Array.from({ length: 5 }, (_, i) => {
                          const year = new Date().getFullYear() - 2 + i;
                          return (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-end">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={showOnlyVisitors}
                          onChange={(e) => setShowOnlyVisitors(e.target.checked)}
                          className="w-5 h-5 text-emerald-600 border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 cursor-pointer transition-all duration-200"
                        />
                      </div>
                      <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">
                        Evidențiază orele lucrate ca vizitator
                      </span>
                    </label>
                  </div>

                  <AccountancyExportExcelButton
                    workplaces={workplaces}
                    selectedWorkplace={selectedWorkplace}
                    selectedMonth={selectedMonth}
                    monthDays={monthDays}
                    onSetError={setError}
                  />
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Luna
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={selectedMonth ? selectedMonth.split("-")[1] : ""}
                        onChange={(e) => {
                          const year = selectedMonth ? selectedMonth.split("-")[0] : String(new Date().getFullYear());
                          const month = e.target.value;
                          setSelectedMonth(`${year}-${month}`);
                        }}
                        className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 bg-white hover:border-slate-400"
                      >
                        <option value="01">Ianuarie</option>
                        <option value="02">Februarie</option>
                        <option value="03">Martie</option>
                        <option value="04">Aprilie</option>
                        <option value="05">Mai</option>
                        <option value="06">Iunie</option>
                        <option value="07">Iulie</option>
                        <option value="08">August</option>
                        <option value="09">Septembrie</option>
                        <option value="10">Octombrie</option>
                        <option value="11">Noiembrie</option>
                        <option value="12">Decembrie</option>
                      </select>
                      <select
                        value={selectedMonth ? selectedMonth.split("-")[0] : ""}
                        onChange={(e) => {
                          const year = e.target.value;
                          const month = selectedMonth ? selectedMonth.split("-")[1] : String(new Date().getMonth() + 1).padStart(2, "0");
                          setSelectedMonth(`${year}-${month}`);
                        }}
                        className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 bg-white hover:border-slate-400"
                      >
                        {Array.from({ length: 5 }, (_, i) => {
                          const year = new Date().getFullYear() - 2 + i;
                          return (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Caută angajat
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Introdu numele angajatului..."
                        value={searchEmployeeLeaves}
                        onChange={(e) => setSearchEmployeeLeaves(e.target.value)}
                        className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 bg-white hover:border-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          askBulkDownloadFormat(
                            selectedWorkplace ? filteredLeavesForActiveView : getAllMonthlyLeavesAcrossWorkplaces()
                          )
                        }
                        disabled={isBulkDownloading}
                        className="shrink-0 px-3 py-2.5 text-xs font-semibold rounded-xl border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 hover:border-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                      >
                        {isBulkDownloading
                          ? "Generez ZIP..."
                          : selectedWorkplace
                            ? "Descarcă cererile"
                            : "Descarcă toate cererile"}
                      </button>
                    </div>
                  </div>

                </>
              )}
            </div>
          </div>
        </div>

        {/* CONTENT CARD */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          {error && (
            <div className="m-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-center gap-3">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-700 text-sm font-medium">{error}</p>
            </div>
          )}

          {(loadingEmployees || loadingTimesheets || loadingLeaves) && (
            <div className="mx-6 mt-6 flex flex-col items-center justify-center py-4">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mb-3"></div>
              <p className="text-slate-500 text-sm">Se încarcă...</p>
            </div>
          )}

          {activeView === "cereriAprobate" || activeView === "cereriAsteptare" ? (
            // SECȚIUNE CERERI (separate: aprobate / în așteptare)
            <div className="p-6">
              {(() => {
                const isPendingView = activeView === "cereriAsteptare";
                const isTargetStatus = isPendingView ? isPendingStatus : isApprovedStatus;
                const filteredLeaves = filteredLeavesForActiveView.filter(isTargetStatus);
                
                if (filteredLeaves.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <svg
                        className="mx-auto h-12 w-12 text-slate-300 mb-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <p className="text-slate-500 font-medium">
                        Nu există cereri {isPendingView ? "în așteptare" : "aprobate"}
                        {selectedWorkplace || searchEmployeeLeaves || selectedMonth ? " pentru filtrele selectate" : ""}.
                      </p>
                    </div>
                  );
                }
                
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-slate-900">
                        {isPendingView
                          ? `Cereri de concediu în așteptare (${filteredLeaves.length})`
                          : `Cereri de concediu aprobate (${filteredLeaves.length})`}
                      </h2>
                      <div className="flex items-center gap-2" />
                    </div>
                    
                    <div className="grid gap-4">
                      {filteredLeaves.map((leave) => {
                        let employeeName = "—";
                        if (leave.name) {
                          employeeName = leave.name;
                        } else if (typeof leave.employeeId === 'object' && leave.employeeId && 'name' in leave.employeeId) {
                          employeeName = String((leave.employeeId as any).name || "—");
                        }
                        
                        let workplaceName = "—";
                        if (typeof leave.workplaceId === 'object' && leave.workplaceId && 'name' in leave.workplaceId) {
                          workplaceName = String((leave.workplaceId as any).name || "—");
                        } else if (typeof leave.workplaceId === 'string') {
                          const wp = workplaces.find(w => w._id === leave.workplaceId);
                          workplaceName = wp?.name || "—";
                        }
                        
                        return (
                          <div
                            key={leave._id}
                            className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 hover:border-emerald-300"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-2">
                                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-semibold text-sm">
                                    {employeeName.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <h3 className="font-semibold text-slate-900 truncate">
                                      {employeeName}
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                      {workplaceName}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="ml-13 space-y-1.5">
                                  <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <svg
                                      className="h-4 w-4 text-slate-400"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                      />
                                    </svg>
                                    <span>
                                      {formatDate(leave.startDate)} – {formatDate(leave.endDate)}
                                    </span>
                                    {typeof leave.days === "number" && (
                                      <span className="text-slate-400">• {leave.days} zile</span>
                                    )}
                                  </div>
                                  
                                  {leave.type && (
                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                      <svg
                                        className="h-4 w-4 text-slate-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                                        />
                                      </svg>
                                      <span>{getLeaveTypeLabel(leave.type)}</span>
                                    </div>
                                  )}
                                  
                                  {leave.reason && (
                                    <p className="text-sm text-slate-600 mt-2 line-clamp-2">
                                      {leave.reason}
                                    </p>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex flex-col items-end gap-2">
                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-medium border ${
                                    isPendingStatus(leave)
                                      ? "bg-amber-100 text-amber-800 border-amber-200"
                                      : "bg-emerald-100 text-emerald-800 border-emerald-200"
                                  }`}
                                >
                                  {isPendingStatus(leave) ? "În așteptare" : "Aprobată"}
                                </span>
                                {(isModifiedLeave(leave)) && (
                                  <span className="text-[11px] text-amber-700">
                                    {renderModificationNote(leave)}
                                  </span>
                                )}
                                {leave.updatedAt && (
                                  <span className="text-xs text-slate-400">
                                    {isPendingStatus(leave) ? "Actualizata: " : "Aprobata: "}
                                    {formatDate(leave.updatedAt)}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => openLeavePDF(leave, employeeName, workplaceName)}
                                  className="px-3 py-1.5 text-xs font-semibold rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                                >
                                  Descarcă PDF / JPG
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : selectedWorkplace ? (
            // Tabel pentru o singură farmacie
            <div className="overflow-x-auto p-6">
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-300">
                    <th className="px-2 py-1.5 text-left font-bold text-slate-900 sticky left-0 bg-gradient-to-r from-slate-50 to-slate-100 z-10 min-w-[120px] text-[10px] shadow-sm">
                      <div className="flex items-center gap-1">
                        <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Angajat
                      </div>
                    </th>
                    {monthDays.map((day) => (
                      <th
                        key={day.date}
                        className={`px-0.5 py-2.5 text-center font-bold min-w-[28px] text-[9px] border-l border-slate-200 ${
                          getLegalHolidayName(day.date)
                            ? "bg-violet-100 text-violet-900 border-slate-200"
                            : day.isWeekend
                              ? "bg-amber-50 text-slate-700"
                              : "text-slate-700"
                        }`}
                        title={getLegalHolidayName(day.date) ? `Sărbătoare legală: ${getLegalHolidayName(day.date)}` : undefined}
                      >
                        <div className="text-xs font-bold text-slate-900 leading-tight">{day.dayName}</div>
                        <div className="text-[10px] font-normal text-slate-500 leading-tight mt-0.5">{day.day}</div>
                      </th>
                    ))}
                    <th className="px-1.5 py-2.5 text-center font-bold text-teal-700 min-w-[44px] text-xs bg-teal-50 border-l border-slate-200 border-r border-slate-200 border-t border-slate-200 border-b border-slate-200">
                      Norma
                    </th>
                    <th className="px-1.5 py-2.5 text-center font-bold text-emerald-700 min-w-[40px] text-xs bg-emerald-50 border-l border-slate-200 border-r border-slate-200 border-t border-slate-200 border-b border-slate-200">
                      Total
                    </th>
                    <th className="px-1.5 py-2.5 text-center font-bold text-blue-700 min-w-[40px] text-xs bg-blue-50 border-l border-slate-200 border-r border-slate-200 border-t border-slate-200 border-b border-slate-200">
                      SUPL
                    </th>
                    <th className="px-1.5 py-2.5 text-center font-bold text-purple-700 min-w-[40px] text-xs bg-purple-50 border-l border-slate-200 border-r border-slate-200 border-t border-slate-200 border-b border-slate-200">
                      WE
                    </th>
                    <th className="px-1.5 py-2.5 text-center font-bold text-orange-700 min-w-[40px] text-xs bg-orange-50 border-l border-slate-200 border-t border-slate-200 border-b border-slate-200">
                      S.L
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {employees.length === 0 ? (
                    <tr>
                      <td
                        colSpan={monthDays.length + 7}
                        className="px-6 py-12 text-center"
                      >
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </div>
                          <p className="text-slate-500 font-medium">Nu există angajați pentru această farmacie.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    employees
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((employee) => {
                        return (
                        <tr 
                          key={employee._id} 
                          className="hover:bg-emerald-50/30 transition-colors duration-150 border-b border-slate-100"
                        >
                          <td className="px-2 py-2 font-medium text-slate-900 sticky left-0 bg-white z-10 shadow-sm border-r border-slate-200">
                            <div className="flex items-center gap-1.5">
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-[10px] font-bold shadow-sm shrink-0">
                                {employee.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold leading-tight text-slate-900 truncate">{employee.name}</div>
                                {employee.function && (
                                  <div className="text-[9px] text-slate-500 font-normal leading-tight mt-0.5 truncate">
                                    {employee.function}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          {monthDays.map((day) => {
                            const dayData = getEmployeeDayData(employee._id, day.date);
                            const hasVisitor = dayData && dayData.hasVisitor === true;
                            const shouldHighlight = showOnlyVisitorsForTable && hasVisitor;
                            const holidayName = getLegalHolidayName(day.date);
                            const isHoliday = !!holidayName;
                            
                            let bgClass = "";
                            if (shouldHighlight) {
                              bgClass = "bg-blue-100";
                            } else if (isHoliday) {
                              bgClass = "bg-violet-100";
                            } else if (day.isWeekend) {
                              bgClass = "bg-amber-50";
                            }
                            
                            const tooltipText = hasVisitor && dayData.visitorWorkplaces && dayData.visitorWorkplaces.length > 0
                              ? `Data: ${day.date}\nVizitator la:\n${dayData.visitorWorkplaces.map(vw => `  • ${vw.workplaceName} (${Math.round(vw.hoursWorked)} ore)`).join('\n')}`
                              : null;
                            
                            return (
                              <td
                                key={day.date}
                                className={`px-0.5 py-1 text-center align-middle border-l border-slate-100 transition-all duration-150 ${bgClass} ${hasVisitor ? 'relative group cursor-help' : ''} ${dayData ? 'hover:bg-slate-50' : ''}`}
                                title={holidayName ? `Sărbătoare legală: ${holidayName}` : (tooltipText || undefined)}
                              >
                                {dayData ? (
                                  <span 
                                    className={`inline-flex items-center justify-center px-1 py-0.5 rounded text-xs font-semibold ${
                                      dayData.type === 'leave' 
                                        ? 'bg-amber-100 text-amber-800' 
                                        : 'bg-emerald-50 text-emerald-700'
                                    } ${dayData.type === 'leave' ? 'cursor-help' : ''}`}
                                    title={
                                      dayData.type === 'leave' && dayData.leaveTypeFull 
                                        ? dayData.leaveTypeFull 
                                        : undefined
                                    }
                                  >
                                    {dayData.value}
                                    {hasVisitor && (
                                      <span className="text-blue-600 ml-0.5 font-bold text-[10px]" title="Ore lucrate ca vizitator">
                                        *
                                      </span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 text-[8px]">—</span>
                                )}
                                {hasVisitor && dayData.visitorWorkplaces && dayData.visitorWorkplaces.length > 0 && (
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-pre-line z-50 min-w-[200px] text-left">
                                    <div className="font-semibold mb-1">Data: {day.date}</div>
                                    <div className="font-semibold mb-1">Vizitator la:</div>
                                    {dayData.visitorWorkplaces.map((vw, idx) => (
                                      <div key={idx} className="ml-2">
                                        • {vw.workplaceName} ({Math.round(vw.hoursWorked)} ore)
                                      </div>
                                    ))}
                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900"></div>
                                  </div>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-1.5 py-1.5 text-center align-middle font-bold bg-teal-50 border-l border-slate-200 border-r border-slate-200 border-t border-slate-200 border-b border-slate-200">
                            <div className="text-xs text-teal-700">{getEmployeeNormHours(employee._id)}</div>
                          </td>
                          <td className="px-1.5 py-1.5 text-center align-middle font-bold bg-emerald-50 border-l border-slate-200 border-r border-slate-200 border-t border-slate-200 border-b border-slate-200">
                            <div className="text-xs text-emerald-700">{getEmployeeMonthTotal(employee._id)}</div>
                            {getEmployeeVisitorHours(employee._id) > 0 && (
                              <div className="text-[8px] text-blue-600 font-medium mt-0.5">
                                ({getEmployeeVisitorHours(employee._id)})
                              </div>
                            )}
                          </td>
                          <td className="px-1.5 py-1.5 text-center align-middle font-bold bg-blue-50 border-l border-slate-200 border-r border-slate-200 border-t border-slate-200 border-b border-slate-200">
                            <div className="text-xs text-blue-700">{getEmployeeSuplHours(employee._id)}</div>
                          </td>
                          <td className="px-1.5 py-1.5 text-center align-middle font-bold bg-purple-50 border-l border-slate-200 border-r border-slate-200 border-t border-slate-200 border-b border-slate-200">
                            <div className="text-xs text-purple-700">{getEmployeeWeekendHours(employee._id)}</div>
                          </td>
                          <td className="px-1.5 py-1.5 text-center align-middle font-bold bg-orange-50 border-l border-slate-200 border-t border-slate-200 border-b border-slate-200">
                            <div className="text-xs text-orange-700">{getEmployeeLegalHolidayHours(employee._id)}</div>
                          </td>
                        </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            // Afișează toate farmaciile
            <div className="p-3 space-y-16">
              {workplaces.map((workplace) => {
                const workplaceEmployees = employees.filter((emp) => {
                  const empWorkplaceId = typeof emp.workplaceId === 'string' 
                    ? emp.workplaceId 
                    : String((emp.workplaceId as any)?._id || emp.workplaceId || '');
                  return empWorkplaceId === String(workplace._id);
                });

                if (workplaceEmployees.length === 0) {
                  return null;
                }

                return (
                  <div key={workplace._id} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <h2 className="text-lg font-bold text-slate-900 mb-4 sticky top-0 bg-slate-50 py-2 z-10">
                      {workplace.name}
                    </h2>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-[10px]">
                        <thead>
                          <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-300">
                            <th className="px-2 py-1.5 text-left font-bold text-slate-900 sticky left-0 bg-gradient-to-r from-slate-50 to-slate-100 z-10 min-w-[120px] text-[10px] shadow-sm">
                              <div className="flex items-center gap-1">
                                <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                Angajat
                              </div>
                            </th>
                            {monthDays.map((day) => (
                              <th
                                key={day.date}
                                className={`px-0.5 py-2.5 text-center font-bold min-w-[28px] text-[9px] border-l border-slate-200 ${
                                  getLegalHolidayName(day.date)
                                    ? "bg-violet-100 text-violet-900 border-slate-200"
                                    : day.isWeekend
                                      ? "bg-amber-50 text-slate-700"
                                      : "text-slate-700"
                                }`}
                                title={getLegalHolidayName(day.date) ? `Sărbătoare legală: ${getLegalHolidayName(day.date)}` : undefined}
                              >
                                <div className="text-xs font-bold text-slate-900 leading-tight">{day.dayName}</div>
                                <div className="text-[10px] font-normal text-slate-500 leading-tight mt-0.5">{day.day}</div>
                              </th>
                            ))}
                            <th className="px-1.5 py-2.5 text-center font-bold text-teal-700 min-w-[44px] text-xs bg-teal-50 border-l border-slate-200 border-r border-slate-200 border-t border-slate-200 border-b border-slate-200">
                              Norma
                            </th>
                            <th className="px-1.5 py-2.5 text-center font-bold text-emerald-700 min-w-[40px] text-xs bg-emerald-50 border-l border-slate-200 border-r border-slate-200 border-t border-slate-200 border-b border-slate-200">
                              Total
                            </th>
                            <th className="px-1.5 py-2.5 text-center font-bold text-blue-700 min-w-[40px] text-xs bg-blue-50 border-l border-slate-200 border-r border-slate-200 border-t border-slate-200 border-b border-slate-200">
                              SUPL
                            </th>
                            <th className="px-1.5 py-2.5 text-center font-bold text-purple-700 min-w-[40px] text-xs bg-purple-50 border-l border-slate-200 border-r border-slate-200 border-t border-slate-200 border-b border-slate-200">
                              WE
                            </th>
                            <th className="px-1.5 py-2.5 text-center font-bold text-orange-700 min-w-[40px] text-xs bg-orange-50 border-l border-slate-200 border-t border-slate-200 border-b border-slate-200">
                              S.L
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {workplaceEmployees
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((employee) => {
                              return (
                                <tr 
                                  key={employee._id} 
                                  className="hover:bg-emerald-50/30 transition-colors duration-150 border-b border-slate-100"
                                >
                                  <td className="px-2 py-2 font-medium text-slate-900 sticky left-0 bg-white z-10 shadow-sm border-r border-slate-200">
                                    <div className="flex items-center gap-1.5">
                                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-[10px] font-bold shadow-sm shrink-0">
                                        {employee.name.charAt(0).toUpperCase()}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="text-xs font-bold leading-tight text-slate-900 truncate">{employee.name}</div>
                                        {employee.function && (
                                          <div className="text-[9px] text-slate-500 font-normal leading-tight mt-0.5 truncate">
                                            {employee.function}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  {monthDays.map((day) => {
                                    const dayData = getEmployeeDayData(employee._id, day.date);
                                    const hasVisitor = dayData && dayData.hasVisitor === true;
                                    const shouldHighlight = showOnlyVisitorsForTable && hasVisitor;
                                    const holidayName = getLegalHolidayName(day.date);
                                    const isHoliday = !!holidayName;
                                    
                                    let bgClass = "";
                                    if (shouldHighlight) {
                                      bgClass = "bg-blue-100";
                                    } else if (isHoliday) {
                                      bgClass = "bg-violet-100";
                                    } else if (day.isWeekend) {
                                      bgClass = "bg-amber-50";
                                    }
                                    
                                    const tooltipText = hasVisitor && dayData.visitorWorkplaces && dayData.visitorWorkplaces.length > 0
                                      ? `Data: ${day.date}\nVizitator la:\n${dayData.visitorWorkplaces.map(vw => `  • ${vw.workplaceName} (${Math.round(vw.hoursWorked)} ore)`).join('\n')}`
                                      : null;
                                    
                                    return (
                                      <td
                                        key={day.date}
                                        className={`px-0.5 py-1 text-center align-middle border-l border-slate-100 transition-all duration-150 ${bgClass} ${hasVisitor ? 'relative group cursor-help' : ''} ${dayData ? 'hover:bg-slate-50' : ''}`}
                                        title={holidayName ? `Sărbătoare legală: ${holidayName}` : (tooltipText || undefined)}
                                      >
                                        {dayData ? (
                                          <span 
                                            className={`inline-flex items-center justify-center px-1 py-0.5 rounded text-xs font-semibold ${
                                              dayData.type === 'leave' 
                                                ? 'bg-amber-100 text-amber-800' 
                                                : 'bg-emerald-50 text-emerald-700'
                                            } ${dayData.type === 'leave' ? 'cursor-help' : ''}`}
                                            title={
                                              dayData.type === 'leave' && dayData.leaveTypeFull 
                                                ? dayData.leaveTypeFull 
                                                : undefined
                                            }
                                          >
                                            {dayData.value}
                                            {hasVisitor && (
                                              <span className="text-blue-600 ml-0.5 font-bold text-[10px]" title="Ore lucrate ca vizitator">
                                                *
                                              </span>
                                            )}
                                          </span>
                                        ) : (
                                          <span className="text-slate-300 text-[8px]">—</span>
                                        )}
                                        {hasVisitor && dayData.visitorWorkplaces && dayData.visitorWorkplaces.length > 0 && (
                                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-pre-line z-50 min-w-[200px] text-left">
                                            <div className="font-semibold mb-1">Data: {day.date}</div>
                                            <div className="font-semibold mb-1">Vizitator la:</div>
                                            {dayData.visitorWorkplaces.map((vw, idx) => (
                                              <div key={idx} className="ml-2">
                                                • {vw.workplaceName} ({Math.round(vw.hoursWorked)} ore)
                                              </div>
                                            ))}
                                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900"></div>
                                          </div>
                                        )}
                                      </td>
                                    );
                                  })}
                                  <td className="px-1.5 py-1.5 text-center align-middle font-bold bg-teal-50 border-l border-slate-200 border-r border-slate-200 border-t border-slate-200 border-b border-slate-200">
                                    <div className="text-xs text-teal-700">{getEmployeeNormHours(employee._id)}</div>
                                  </td>
                                  <td className="px-1.5 py-1.5 text-center align-middle font-bold bg-emerald-50 border-l border-slate-200 border-r border-slate-200 border-t border-slate-200 border-b border-slate-200">
                                    <div className="text-xs text-emerald-700">{getEmployeeMonthTotal(employee._id)}</div>
                                    {getEmployeeVisitorHours(employee._id) > 0 && (
                                      <div className="text-[8px] text-blue-600 font-medium mt-0.5">
                                        ({getEmployeeVisitorHours(employee._id)})
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-1.5 py-1.5 text-center align-middle font-bold bg-blue-50 border-l border-slate-200 border-r border-slate-200 border-t border-slate-200 border-b border-slate-200">
                                    <div className="text-xs text-blue-700">{getEmployeeSuplHours(employee._id)}</div>
                                  </td>
                                  <td className="px-1.5 py-1.5 text-center align-middle font-bold bg-purple-50 border-l border-slate-200 border-r border-slate-200 border-t border-slate-200 border-b border-slate-200">
                                    <div className="text-xs text-purple-700">{getEmployeeWeekendHours(employee._id)}</div>
                                  </td>
                                  <td className="px-1.5 py-1.5 text-center align-middle font-bold bg-orange-50 border-l border-slate-200 border-t border-slate-200 border-b border-slate-200">
                                    <div className="text-xs text-orange-700">{getEmployeeLegalHolidayHours(employee._id)}</div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showCalcHelpModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
        >
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-[min(96vw,760px)] max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">
                Cum se calculează orele în Accountancy
              </h2>
              <button
                type="button"
                onClick={() => setShowCalcHelpModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm"
              >
                Închide
              </button>
            </div>

            <div className="space-y-4 text-sm text-slate-700">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <p className="font-semibold text-slate-900 mb-1">Norma</p>
                <p>
                  Coloana <span className="font-semibold">Norma</span> adună orele lucrate cu zilele de concediu din lună,
                  unde fiecare zi de concediu (indiferent de tip) valorează <span className="font-semibold">8 ore</span>.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <p className="font-semibold text-slate-900 mb-1">Total</p>
                <p>
                  Reprezintă totalul orelor lucrate în luna selectată pentru fiecare angajat. În acest total intră orele
                  din zilele lucrate (inclusiv unde este cazul gardă, weekend sau sărbătoare legală), iar zilele de
                  concediu nu adaugă ore.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <p className="font-semibold text-slate-900 mb-1">SUPL (ore suplimentare)</p>
                <p>
                  Orele suplimentare sunt numărate separat în coloana <span className="font-semibold">SUPL</span>. Ele se
                  adună doar după ce este atins targetul lunar al angajatului.
                </p>
                <p className="mt-2">
                  Exemplu: dacă targetul este <span className="font-semibold">160h</span> și angajatul are{" "}
                  <span className="font-semibold">172h</span> total, în coloana SUPL vor apărea{" "}
                  <span className="font-semibold">12h</span>.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <p className="font-semibold text-slate-900 mb-1">WE (weekend)</p>
                <p>
                  În coloana WE se afișează separat orele lucrate sâmbăta și duminica, ca să fie vizibile distinct față de
                  programul normal.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <p className="font-semibold text-slate-900 mb-1">S.L (sărbători legale)</p>
                <p>
                  În coloana S.L se afișează separat orele lucrate în zilele de sărbătoare legală.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <p className="font-semibold text-emerald-800 mb-1">Notă</p>
                <p className="text-emerald-900">
                  Numărul din paranteză de sub coloana <span className="font-semibold">Total</span> reprezintă orele lucrate
                  ca vizitator. Targetul lunar este luat din fișa angajatului; dacă nu este setat explicit, se folosește 160.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLeavePDF && pdfLeave && pdfEmployee && (
        <LeaveRequestPDF
          leave={pdfLeave}
          employee={pdfEmployee}
          workplaceName={pdfWorkplaceName}
          onClose={() => {
            setShowLeavePDF(false);
            setPdfLeave(null);
            setPdfEmployee(null);
            setPdfWorkplaceName("");
          }}
        />
      )}

      {showBulkFormatModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-[min(92vw,520px)] p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Alege formatul pentru descărcare</h3>
            <p className="text-sm text-slate-600 mb-5">
              Toate cererile din punctul de lucru selectat vor fi descărcate într-un fișier ZIP.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => downloadLeavesBulk("pdf")}
                disabled={isBulkDownloading}
                className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
              >
                PDF
              </button>
              <button
                type="button"
                onClick={() => downloadLeavesBulk("image")}
                disabled={isBulkDownloading}
                className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60"
              >
                Imagine (JPG)
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                if (isBulkDownloading) return;
                setShowBulkFormatModal(false);
                setPendingBulkLeaves([]);
              }}
              className="mt-4 w-full px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Anulează
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountancyDashboard;

