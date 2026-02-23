import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, isSameDay } from "date-fns";
import { ro } from "date-fns/locale";
import { AddVisitor } from "./AddVisitor";
import { timesheetService } from "../services/timesheetService";
import { employeeService } from "@/shared/services/employeeService";
import { leaveService } from "@/features/leaves/services/leaveService";
import { normalizeTime, pad2, calcWorkHours } from "../utils/time.utils";
import type { TimesheetViewerEntry, PontajData, OverlapData, DayHoursData } from "../types/timesheet.types";
import type { Employee } from "@/shared/types/employee.types";
import type { TimesheetFormData } from "../types/timesheet.types";
import type { Leave } from "@/features/leaves/types/leave.types";

const HOURS = Array.from({ length: 24 }, (_, i) => pad2(i));

// Helper functions pentru normalizarea ID-urilor
const normalizeId = (id: string | { _id: string }): string => {
  return typeof id === 'string' ? id : id._id;
};

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const TimePicker: React.FC<TimePickerProps> = ({ value, onChange, disabled = false }) => {
  const [h] = normalizeTime(value).split(":");
  const [showHours, setShowHours] = useState<boolean>(false);
  const [hoursPosition, setHoursPosition] = useState<"top" | "bottom">("bottom");
  const [hourInput, setHourInput] = useState<string>(h);
  const hoursRef = useRef<HTMLDivElement>(null);
  const hoursDropdownRef = useRef<HTMLDivElement>(null);
  const hourInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const [newH] = normalizeTime(value).split(":");
    setHourInput(newH);
  }, [value]);

  useEffect(() => {
    if (showHours && hoursRef.current && hoursDropdownRef.current) {
      const rect = hoursRef.current.getBoundingClientRect();
      const dropdownHeight = 200;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
        setHoursPosition("top");
      } else {
        setHoursPosition("bottom");
      }
    }
  }, [showHours]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (hoursRef.current && !hoursRef.current.contains(event.target as Node)) {
        setShowHours(false);
      }
    };

    if (showHours) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showHours]);

  const selectHour = (hour: string) => {
    const normalizedHour = pad2(Math.max(0, Math.min(23, parseInt(hour) || 0)));
    // ✅ Minutele sunt mereu :00
    onChange(`${normalizedHour}:00`);
    setHourInput(normalizedHour);
    setShowHours(false);
  };

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value.replace(/\D/g, "");
    setHourInput(input);
    
    if (input.length === 2) {
      const hour = Math.max(0, Math.min(23, parseInt(input) || 0));
      const normalizedHour = pad2(hour);
      setHourInput(normalizedHour);
      // ✅ Minutele sunt mereu :00
      onChange(`${normalizedHour}:00`);
    } else if (input.length === 0) {
      setHourInput("");
    }
  };

  const handleHourBlur = () => {
    const hour = Math.max(0, Math.min(23, parseInt(hourInput) || 0));
    const normalizedHour = pad2(hour);
    setHourInput(normalizedHour);
    // ✅ Minutele sunt mereu :00
    onChange(`${normalizedHour}:00`);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative" ref={hoursRef}>
        <div className="relative">
          <input
            ref={hourInputRef}
            type="text"
            inputMode="numeric"
            maxLength={2}
            disabled={disabled}
            value={hourInput}
            onChange={handleHourChange}
            onBlur={handleHourBlur}
            onFocus={() => {
              hourInputRef.current?.select();
              setShowHours(false);
            }}
            readOnly
            className={`w-[70px] border rounded-lg px-3 py-2.5 text-sm font-medium text-center transition-all ${
              disabled
                ? "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200"
                : "border-slate-300 bg-white text-slate-900 hover:border-emerald-400 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            } ${showHours ? "border-emerald-500 bg-emerald-50" : ""}`}
            placeholder="08"
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (!disabled) {
                setShowHours(!showHours);
              }
            }}
            className={`absolute right-1 top-1/2 -translate-y-1/2 p-1 transition-all ${
              disabled
                ? "text-slate-300 cursor-not-allowed"
                : "text-emerald-500 hover:text-emerald-600 hover:scale-110 cursor-pointer"
            }`}
            aria-label="Deschide dropdown ore"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        {showHours && !disabled && (
          <div
            ref={hoursDropdownRef}
            className={`absolute z-[9999] w-[70px] bg-white border border-slate-200 rounded-lg shadow-xl max-h-[200px] overflow-y-auto overscroll-contain ${
              hoursPosition === "top" ? "bottom-full mb-1" : "top-full mt-1"
            }`}
            style={{ maxHeight: "200px" }}
          >
            <div className="py-1">
              {HOURS.map((hour) => (
                <button
                  key={hour}
                  type="button"
                  onClick={() => selectHour(hour)}
                  className={`w-full px-3 py-2 text-sm text-left hover:bg-emerald-50 transition-colors ${
                    hour === h
                      ? "bg-emerald-100 text-emerald-700 font-semibold"
                      : "text-slate-700 hover:text-emerald-700"
                  }`}
                >
                  {hour}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <span className="text-slate-400 font-medium">:</span>
      
      {/* ✅ Minutele sunt fixe la :00 - doar afișare */}
      <div className="w-[70px] border rounded-lg px-3 py-2.5 text-sm font-medium text-center bg-slate-100 text-slate-500 border-slate-200">
        00
      </div>
    </div>
  );
};

interface TimesheetViewerProps {
  workplaceId: string;
  workplaceName: string;
}

const TimesheetViewer: React.FC<TimesheetViewerProps> = ({ workplaceId, workplaceName }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [timesheetEntries, setTimesheetEntries] = useState<TimesheetViewerEntry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allEmployeesForPicker, setAllEmployeesForPicker] = useState<Employee[]>([]);
  const [visitorsManual, setVisitorsManual] = useState<Employee[]>([]);
  const [approvedLeaves, setApprovedLeaves] = useState<Leave[]>([]); // ✅ Concedii aprobate
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const [showPontajModal, setShowPontajModal] = useState<boolean>(false);
  const [pontajData, setPontajData] = useState<PontajData | null>(null);
  const [startTime, setStartTime] = useState<string>("08:00");
  const [endTime, setEndTime] = useState<string>("16:00");
  const [overlapData, setOverlapData] = useState<OverlapData | null>(null);
  const [hasExistingPontaj, setHasExistingPontaj] = useState<boolean>(false);

  const monthDays = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const start = startOfMonth(new Date(year, month - 1, 1));
    const end = endOfMonth(start);
    return eachDayOfInterval({ start, end });
  }, [selectedMonth]);

  const today = useMemo(() => new Date(), []);

  useEffect(() => {
    if (!workplaceId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [year, month] = selectedMonth.split("-").map(Number);
        const start = startOfMonth(new Date(year, month - 1, 1));
        const end = endOfMonth(start);

        const from = format(start, "yyyy-MM-dd");
        const to = format(end, "yyyy-MM-dd");

        const [entriesData, leavesData] = await Promise.all([
          timesheetService.getEntriesByWorkplace(workplaceId, from, to),
          leaveService.getByWorkplace(workplaceId).catch(() => [] as Leave[]), // ✅ Încarcă concediile
        ]);
        
        console.log("📥 [FRONTEND] TimesheetViewer.loadData - DATE PRIMITE:", {
          workplaceId,
          from,
          to,
          entriesCount: entriesData.length,
          sampleEntries: entriesData.slice(0, 3).map((e) => ({
            employeeId: normalizeId(e.employeeId),
            employeeName: e.employeeName,
            date: e.date,
            workplaceId: normalizeId(e.workplaceId),
            hoursWorked: e.hoursWorked,
            status: e.status,
            type: e.type,
          })),
        });
        
        const uniqueEntries: TimesheetViewerEntry[] = [];
        const seen = new Set<string>();
        let duplicateCount = 0;
        entriesData.forEach((entry) => {
          const key = `${normalizeId(entry.employeeId)}_${entry.date}_${normalizeId(entry.workplaceId)}_${entry.type || 'home'}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueEntries.push(entry);
          } else {
            duplicateCount++;
          }
        });
        
        if (duplicateCount > 0) {
          console.log("⚠️ [FRONTEND] TimesheetViewer.loadData - DUPLICATE ENTRIES IGNORED:", duplicateCount);
        }
        
        console.log("✅ [FRONTEND] TimesheetViewer.loadData - ENTRIES SET IN STATE:", {
          uniqueCount: uniqueEntries.length,
          totalReceived: entriesData.length,
          duplicatesIgnored: duplicateCount,
        });
        
        setTimesheetEntries(uniqueEntries);

        // ✅ Filtrează doar concediile aprobate
        const approved = leavesData.filter(leave => leave.status === "Aprobată" || leave.status === "approved");
        setApprovedLeaves(approved);

        const employeesData = await employeeService.getByWorkplace(workplaceId);
        setEmployees(employeesData);
      } catch (err) {
        console.error("Eroare la încărcarea datelor:", err);
        setTimesheetEntries([]);
        setEmployees([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [workplaceId, selectedMonth]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await employeeService.getAll();
        if (!alive) return;
        setAllEmployeesForPicker(data);
      } catch (e) {
        console.error(e);
        if (alive) setAllEmployeesForPicker([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const visitorsFromPontaj = useMemo(() => {
    if (!timesheetEntries.length) return [];

    const employeeIdsHere = new Set(employees.map((e) => String(e._id)));
    const allValidEmployeeIds = new Set(
      allEmployeesForPicker
        .filter((e) => e && e.isActive !== false)
        .map((e) => String(e._id))
    );
    const map = new Map<string, Employee>();

    timesheetEntries.forEach((entry) => {
      const empId = normalizeId(entry.employeeId);
      if (employeeIdsHere.has(empId)) return;
      
      if (allEmployeesForPicker.length > 0 && !allValidEmployeeIds.has(empId)) {
        console.warn("⚠️ Vizitator găsit în pontaj care nu apare în lista de angajați disponibili:", {
          employeeId: empId,
          employeeName: entry.employeeName,
          note: "Poate fi un angajat de la altă farmacie sau lista nu e completă"
        });
      }
      
      if (!map.has(empId)) {
        map.set(empId, {
          _id: empId,
          name: entry.employeeName || "Vizitator",
        } as Employee);
      }
    });

    return Array.from(map.values());
  }, [timesheetEntries, employees, allEmployeesForPicker]);

  useEffect(() => {
    if (!visitorsManual.length) return;

    const employeeIdsWithEntries = new Set(
      timesheetEntries.map((entry) => normalizeId(entry.employeeId))
    );

    setVisitorsManual((prev) => {
      const filtered = prev.filter((visitor) => {
        const visitorId = String(visitor._id);
        return employeeIdsWithEntries.has(visitorId);
      });

      if (filtered.length !== prev.length) {
        return filtered;
      }

      return prev;
    });
  }, [timesheetEntries]);

  const peopleInTable = useMemo(() => {
    const map = new Map<string, Employee>();
    // ✅ Vizitatorii la început (visitorsManual, visitorsFromPontaj), apoi employees
    [...visitorsManual, ...visitorsFromPontaj, ...employees].forEach((p) => {
      if (!p?._id) return;
      map.set(p._id, p);
    });
    // Returnează: vizitatori manual, apoi vizitatori din pontaj, apoi employees
    const visitorsManualIds = new Set(visitorsManual.map(v => v._id));
    const visitorsFromPontajIds = new Set(visitorsFromPontaj.map(v => v._id));
    
    return Array.from(map.values()).sort((a, b) => {
      const aIsManualVisitor = visitorsManualIds.has(a._id);
      const bIsManualVisitor = visitorsManualIds.has(b._id);
      const aIsPontajVisitor = visitorsFromPontajIds.has(a._id);
      const bIsPontajVisitor = visitorsFromPontajIds.has(b._id);
      
      // Vizitatori manual la început
      if (aIsManualVisitor && !bIsManualVisitor) return -1;
      if (!aIsManualVisitor && bIsManualVisitor) return 1;
      
      // Apoi vizitatori din pontaj
      if (aIsPontajVisitor && !bIsPontajVisitor) return -1;
      if (!aIsPontajVisitor && bIsPontajVisitor) return 1;
      
      // Apoi employees (ordinea originală)
      return 0;
    });
  }, [employees, visitorsFromPontaj, visitorsManual]);

  const excludeIds = useMemo(() => peopleInTable.map((p) => p._id), [peopleInTable]);

  const visitorIds = useMemo(() => {
    const ids = new Set<string>();
    visitorsFromPontaj.forEach((v) => v?._id && ids.add(v._id));
    visitorsManual.forEach((v) => v?._id && ids.add(v._id));
    return ids;
  }, [visitorsFromPontaj, visitorsManual]);


  const addVisitorManual = useCallback(
    (emp: Employee) => {
      if (!emp || !emp._id) {
        console.error("⚠️ Încercare de adăugare vizitator invalid:", emp);
        alert("⚠️ Eroare: Nu se poate adăuga un vizitator invalid.");
        return;
      }
      
      const existsInAllEmployees = allEmployeesForPicker.some(
        (e) => e && String(e._id) === String(emp._id) && e.isActive !== false
      );
      
      if (!existsInAllEmployees) {
        console.error("⚠️ Încercare de adăugare vizitator inexistent sau inactiv:", emp);
        alert("⚠️ Eroare: Angajatul nu mai există sau nu este activ. Nu se poate adăuga ca vizitator.");
        return;
      }
      
      setVisitorsManual((prev) => {
        if (prev.some((v) => v._id === emp._id)) return prev;
        if (employees.some((e) => e._id === emp._id)) return prev;
        return [...prev, emp];
      });
    },
    [employees, allEmployeesForPicker]
  );

  const reloadTimesheets = useCallback(
    async (): Promise<TimesheetViewerEntry[]> => {
      const [year, month] = selectedMonth.split("-").map(Number);
      const start = startOfMonth(new Date(year, month - 1, 1));
      const end = endOfMonth(start);
      const from = format(start, "yyyy-MM-dd");
      const to = format(end, "yyyy-MM-dd");

      console.log("🔄 TIMESHEETVIEWER - Reload timesheets:", { workplaceId, from, to });
      
      const [entriesData, leavesData] = await Promise.all([
        timesheetService.getEntriesByWorkplace(workplaceId, from, to),
        leaveService.getByWorkplace(workplaceId).catch(() => [] as Leave[]), // ✅ Reîncarcă concediile
      ]);

      console.log("📥 TIMESHEETVIEWER - Date reîncărcate de la backend:", {
        entriesCount: entriesData.length,
        entries: entriesData.map((e) => ({
          employeeId: normalizeId(e.employeeId),
          employeeName: e.employeeName,
          date: e.date,
          workplaceId: normalizeId(e.workplaceId),
          hoursWorked: e.hoursWorked,
          status: e.status,
          type: e.type,
        })),
      });

      // ✅ IMPORTANT: Permitem multiple entries pentru aceeași dată dacă au _id diferite
      // (Există timesheet-uri duplicate în DB pentru aceeași dată - problema de index unic)
      // Eliminăm doar duplicatele EXACTE (același _id, employeeId, date, workplaceId, type)
      const uniqueEntries: TimesheetViewerEntry[] = [];
      const seenKeys = new Set<string>();
      entriesData.forEach((entry) => {
        // ✅ Creăm un key unic bazat pe toate proprietățile relevante
        const empId = normalizeId(entry.employeeId);
        const wpId = normalizeId(entry.workplaceId);
        const entryType = entry.type || "home";
        const key = `${entry._id || 'no-id'}_${empId}_${entry.date}_${wpId}_${entryType}`;
        
        // ✅ Dacă am văzut deja exact acest entry (toate proprietățile sunt identice), îl ignorăm
        if (seenKeys.has(key)) {
          console.log("⚠️ TIMESHEETVIEWER - Entry duplicat exact ignorat:", {
            key,
            _id: entry._id,
            employeeId: empId,
            employeeName: entry.employeeName,
            date: entry.date,
            hoursWorked: entry.hoursWorked,
          });
          return;
        }
        
        seenKeys.add(key);
        uniqueEntries.push(entry);
      });

      console.log("✅ TIMESHEETVIEWER - Entries după reload:", {
        totalFromBackend: entriesData.length,
        uniqueCount: uniqueEntries.length,
        sampleEntries: uniqueEntries.slice(0, 10).map((e) => ({
          _id: e._id,
          employeeId: normalizeId(e.employeeId),
          employeeName: e.employeeName,
          date: e.date,
          hoursWorked: e.hoursWorked,
          status: e.status,
          type: e.type,
        })),
        // ✅ Grupează după angajat pentru a vedea câte entries are fiecare
        entriesByEmployee: uniqueEntries.reduce((acc, e) => {
          const empId = normalizeId(e.employeeId);
          if (!acc[empId]) {
            acc[empId] = { name: e.employeeName, count: 0, totalHours: 0 };
          }
          acc[empId].count++;
          acc[empId].totalHours += Number(e.hoursWorked) || 0;
          return acc;
        }, {} as Record<string, { name: string; count: number; totalHours: number }>),
      });

      setTimesheetEntries(uniqueEntries);
      
      // ✅ Actualizează concediile aprobate
      const approved = leavesData.filter(leave => leave.status === "Aprobată" || leave.status === "approved");
      setApprovedLeaves(approved);
      
      return uniqueEntries;
    },
    [selectedMonth, workplaceId]
  );

  const getDayEntries = (employeeId: string, date: Date): TimesheetViewerEntry[] => {
    const dateStr = format(date, "yyyy-MM-dd");
    // ✅ Normalizează employeeId pentru comparație corectă
    const employeeIdStr = normalizeId(employeeId);
    
    const filtered = timesheetEntries.filter((entry) => {
      const entryEmployeeId = normalizeId(entry.employeeId);
      const entryDate = entry.date;
      const matches = entryEmployeeId === employeeIdStr && entryDate === dateStr;
      
      return matches;
    });
    
    // ✅ DEBUG: Log pentru debugging - arată toate entries-urile găsite pentru această zi
    if (filtered.length > 0) {
      console.log("✅ [FRONTEND] getDayEntries - ENTRIES FOUND:", {
        employeeId: employeeIdStr,
        date: dateStr,
        entriesCount: filtered.length,
        entries: filtered.map(e => ({
          _id: e._id,
          hoursWorked: e.hoursWorked,
          status: e.status,
          type: e.type,
          workplaceId: typeof e.workplaceId === 'object' ? e.workplaceId?._id : e.workplaceId,
        })),
        totalHours: filtered.reduce((sum, e) => sum + (Number(e.hoursWorked) || 0), 0),
      });
    } else if (timesheetEntries.length > 0) {
      const allEntriesForEmployee = timesheetEntries.filter(e => 
        normalizeId(e.employeeId) === employeeIdStr
      );
      if (allEntriesForEmployee.length > 0) {
        console.log("⚠️ [FRONTEND] getDayEntries - NO MATCHES FOUND:", {
          lookingFor: { employeeId: employeeIdStr, date: dateStr },
          totalEntriesInState: timesheetEntries.length,
          allEntriesForEmployee: allEntriesForEmployee.slice(0, 10).map(e => ({
            employeeId: normalizeId(e.employeeId),
            date: e.date,
            hoursWorked: e.hoursWorked,
            status: e.status,
            type: e.type,
            workplaceId: typeof e.workplaceId === 'object' ? e.workplaceId?._id : e.workplaceId,
          })),
          filteredCount: filtered.length,
        });
      }
    }
    
    return filtered;
  };

  const formatHours = (hours: number): string => {
    if (hours === 0) return "-";
    // ✅ Afișăm doar ore (fără minute)
    return `${hours}h`;
  };

  // ✅ Helper: Verifică dacă un angajat are concediu aprobat în ziua respectivă
  const getApprovedLeaveForDay = useCallback((employeeId: string, date: Date | null): Leave | undefined => {
    if (!date) return undefined;
    const dateStr = format(date, "yyyy-MM-dd");
    
    return approvedLeaves.find((leave) => {
      // Verifică dacă concediul este aprobat
      if (leave.status !== "Aprobată" && leave.status !== "approved") return false;
      
      // Verifică dacă angajatul se potrivește
      const leaveEmpId = typeof leave.employeeId === 'object' && leave.employeeId?._id
        ? String(leave.employeeId._id)
        : String(leave.employeeId || '');
      if (leaveEmpId !== String(employeeId)) return false;
      
      // Verifică dacă data se află în intervalul concediului
      const startDate = new Date(leave.startDate);
      const endDate = new Date(leave.endDate);
      const checkDate = new Date(dateStr);
      
      // Setează ora la 00:00:00 pentru comparație corectă
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      checkDate.setHours(0, 0, 0, 0);
      
      return checkDate >= startDate && checkDate <= endDate;
    });
  }, [approvedLeaves]);

  const getDayHours = (entries: TimesheetViewerEntry[], date: Date | null, employeeId?: string): DayHoursData => {
    const dateStr = date ? format(date, "yyyy-MM-dd") : null;
    
    // ✅ DEBUG: Log pentru debugging când există entries dar nu se calculează corect
    if (entries.length > 0) {
      const totalHours = entries.reduce((sum, e) => sum + (Number(e.hoursWorked) || 0), 0);
      if (totalHours === 0 && entries.some(e => e.hoursWorked && e.hoursWorked > 0)) {
        console.log("⚠️ [FRONTEND] getDayHours - ENTRIES CU ORE DAR TOTAL 0:", {
          employeeId,
          date: dateStr,
          entries: entries.map(e => ({
            hoursWorked: e.hoursWorked,
            hoursWorkedType: typeof e.hoursWorked,
            status: e.status,
            type: e.type,
          })),
        });
      }
    }
    
    // ✅ Verifică mai întâi dacă există un concediu aprobat (chiar dacă nu există entry de pontaj)
    if (employeeId && date) {
      const approvedLeave = getApprovedLeaveForDay(employeeId, date);
      if (approvedLeave) {
        return { isLeave: true, leaveType: approvedLeave.type || undefined };
      }
    }

    if (entries.length === 0) return { hours: 0 };

    const leaveEntry = entries.find((e) => e.leaveType);
    if (leaveEntry) {
      return { isLeave: true, leaveType: leaveEntry.leaveType || undefined };
    }

    const visitorEntries = entries.filter((e) => e.type === "visitor");
    const hasVisitorEntry = visitorEntries.length > 0;
    
    const visitorInfo = visitorEntries.map((entry) => ({
      workplaceName: entry.workplaceName || "Farmacie necunoscută",
      date: date ? format(date, "dd.MM.yyyy") : entry.date || "Data necunoscută"
    }));

    let totalHours = 0;
    entries.forEach((entry) => {
      // ✅ Folosim doar ore (nu minute) - rotunjim la număr întreg
      const hours = entry.hoursWorked ? Math.round(Number(entry.hoursWorked)) : 0;
      totalHours += hours;
    });

    return { 
      hours: totalHours,  // ✅ Deja este număr întreg, nu mai rotunjim
      isVisitor: hasVisitorEntry,
      visitorInfo: visitorInfo
    };
  };

  const getEmployeeTotal = (employeeId: string): { totalHours: number } => {
    let totalHours = 0;
    const employeeIdStr = String(employeeId);
    const relevantEntries: Array<{ date: string; hoursWorked: number; _id: string; leaveType?: string }> = [];

    timesheetEntries.forEach((entry) => {
      const entryEmployeeId = normalizeId(entry.employeeId);
      if (entryEmployeeId === employeeIdStr && !entry.leaveType) {
        // ✅ Folosim doar ore (nu minute) - rotunjim la număr întreg
        const hours = entry.hoursWorked ? Math.round(Number(entry.hoursWorked)) : 0;
        totalHours += hours;
        relevantEntries.push({
          date: entry.date,
          hoursWorked: hours,
          _id: String(entry._id || 'no-id'),
          leaveType: entry.leaveType,
        });
      }
    });

    // ✅ DEBUG: Log pentru debugging când totalul nu este corect
    if (employeeIdStr === "697c824a8b0ae89a585a3925") { // Oltean Horatiu ID
      console.log("🔍 [FRONTEND] getEmployeeTotal - Oltean Horatiu:", {
        employeeId: employeeIdStr,
        totalHours,
        relevantEntriesCount: relevantEntries.length,
        relevantEntries: relevantEntries.map(e => ({
          date: e.date,
          hoursWorked: e.hoursWorked,
          _id: e._id,
        })),
        totalFromEntries: relevantEntries.reduce((sum, e) => sum + e.hoursWorked, 0),
        allTimesheetEntriesCount: timesheetEntries.length,
      });
    }

    return { totalHours };  // ✅ Deja este număr întreg, nu mai rotunjim
  };

  const handleCellClick = useCallback(
    (employee: Employee, day: Date, existingEntries: TimesheetViewerEntry[] = []) => {
      setPontajData({ employee, date: format(day, "yyyy-MM-dd") });

      if (existingEntries.length > 0) {
        let earliestStart: string | null = null;
        let latestEnd: string | null = null;

        existingEntries.forEach((entry) => {
          const s = normalizeTime(entry.startTime || "08:00");
          const e = normalizeTime(entry.endTime || "16:00");

          if (!earliestStart || s < earliestStart) earliestStart = s;
          if (!latestEnd || e > latestEnd) latestEnd = e;
        });

        setStartTime(earliestStart || "08:00");
        setEndTime(latestEnd || "16:00");
        setHasExistingPontaj(true);
      } else {
        setStartTime("08:00");
        setEndTime("16:00");
        setHasExistingPontaj(false);
      }

      setShowPontajModal(true);
    },
    []
  );

  const handleSavePontaj = useCallback(async () => {
    if (!pontajData || !workplaceId) return;

    const allValidEmployeeIds = new Set([
      ...employees.map((e) => String(e._id)),
      ...visitorsFromPontaj.map((v) => String(v._id)),
      ...visitorsManual.map((v) => String(v._id)),
    ]);
    
    const employeeIdStr = String(pontajData.employee._id);
    if (!allValidEmployeeIds.has(employeeIdStr)) {
      alert("⚠️ Eroare: Angajatul nu mai există sau nu este activ. Nu se poate salva pontajul.");
      setShowPontajModal(false);
      setPontajData(null);
      return;
    }

    setSaving(true);
    try {
      const finalStartTime = normalizeTime(startTime);
      const finalEndTime = normalizeTime(endTime);
      const hoursWorked = calcWorkHours(finalStartTime, finalEndTime);

      console.log("💾 [FRONTEND] TimesheetViewer - CALCULARE ORE:", {
        startTime,
        endTime,
        finalStartTime,
        finalEndTime,
        hoursWorked,
        hoursWorkedType: typeof hoursWorked,
      });

      const payload: TimesheetFormData = {
        employeeId: pontajData.employee._id,
        workplaceId: workplaceId,
        date: pontajData.date,
        startTime: finalStartTime,
        endTime: finalEndTime,
        hoursWorked: hoursWorked,
        minutesWorked: 0, // ✅ Nu mai folosim minutele, dar le trimitem 0 pentru compatibilitate
        status: "prezent",
        force: false,
      };

      try {
        console.log("💾 [FRONTEND] TimesheetViewer - Salvare pontaj:", {
          employeeId: payload.employeeId,
          employeeName: pontajData.employee.name,
          date: payload.date,
          startTime: payload.startTime,
          endTime: payload.endTime,
          hoursWorked: payload.hoursWorked,
          status: payload.status,
        });
        
        const savedTimesheet = await timesheetService.save(payload);
        console.log("✅ [FRONTEND] TimesheetViewer - Pontaj salvat, răspuns backend:", {
          savedTimesheet,
          employeeId: payload.employeeId,
          date: payload.date,
          hoursWorked: payload.hoursWorked,
        });
        
        console.log("🔄 [FRONTEND] TimesheetViewer - Reîncărcare date după salvare...");
        // ✅ Așteaptă puțin pentru a se asigura că MongoDB a salvat datele
        await new Promise(resolve => setTimeout(resolve, 100));
        const reloadedEntries = await reloadTimesheets();
        
        const entriesForSavedDate = reloadedEntries.filter(e => 
          normalizeId(e.employeeId) === String(payload.employeeId) && 
          e.date === payload.date
        );
        
        console.log("✅ [FRONTEND] TimesheetViewer - Date reîncărcate după salvare:", {
          reloadedCount: reloadedEntries.length,
          lookingFor: {
            employeeId: String(payload.employeeId),
            date: payload.date,
            workplaceId: workplaceId,
          },
          entriesForDate: entriesForSavedDate.length,
          entriesForDateDetails: entriesForSavedDate.map(e => ({
            employeeId: normalizeId(e.employeeId),
            date: e.date,
            workplaceId: normalizeId(e.workplaceId),
            hoursWorked: e.hoursWorked,
            status: e.status,
            type: e.type,
          })),
          allEntriesForEmployee: reloadedEntries.filter(e => 
            normalizeId(e.employeeId) === String(payload.employeeId)
          ).slice(0, 5).map(e => ({
            date: e.date,
            workplaceId: normalizeId(e.workplaceId),
            hoursWorked: e.hoursWorked,
          })),
        });
        
        if (entriesForSavedDate.length === 0) {
          console.error("❌ [FRONTEND] TimesheetViewer - DATELE NU AU FOST GĂSITE DUPĂ SALVARE!", {
            savedPayload: payload,
            reloadedEntriesCount: reloadedEntries.length,
          });
        }
        
        setShowPontajModal(false);
        setPontajData(null);
      } catch (error: any) {
        if (error.status === 404 && error.data?.error?.includes("nu a fost găsit")) {
          alert("⚠️ Eroare: Angajatul nu mai există sau nu este activ. Pontajul nu a fost salvat.");
          await reloadTimesheets();
          setShowPontajModal(false);
          setPontajData(null);
          return;
        }
        if (error.status === 409 && error.data?.code === "OVERLAPPING_HOURS" && error.data?.canForce) {
          setOverlapData({
            payload,
            employeeName: pontajData.employee.name,
            date: pontajData.date,
            overlappingEntry: error.data.overlappingEntry,
            newEntry: error.data.newEntry,
          });
          setShowPontajModal(false);
          return;
        }
        alert(error.data?.error || "Eroare la salvare");
      }
    } catch (err: any) {
      console.error("Eroare la salvare:", err);
      alert("Eroare la salvare");
    } finally {
      setSaving(false);
    }
  }, [pontajData, workplaceId, startTime, endTime, reloadTimesheets, employees, visitorsFromPontaj, visitorsManual]);

  const handleConfirmOverlap = useCallback(async () => {
    if (!overlapData || !workplaceId) return;

    setSaving(true);
    try {
      await timesheetService.save({ ...overlapData.payload, force: true });
      await reloadTimesheets();
      setOverlapData(null);
      setPontajData(null);
    } catch (err: any) {
      console.error("Eroare la salvare (force):", err);
      alert(err.data?.error || "Eroare la salvare");
    } finally {
      setSaving(false);
    }
  }, [overlapData, workplaceId, reloadTimesheets]);

  const handleCancelOverlap = useCallback(() => {
    setOverlapData(null);
  }, []);

  const handleDeletePontaj = useCallback(async () => {
    if (!pontajData || !hasExistingPontaj) return;

    const confirmed = window.confirm(
      `Ești sigur că vrei să ștergi pontajul pentru ${pontajData.employee.name} în data de ${pontajData.date}?`
    );
    if (!confirmed) return;

    const employeeId = pontajData.employee._id;
    const isVisitor = visitorIds.has(employeeId);

    setSaving(true);
    try {
      await timesheetService.delete(employeeId, pontajData.date);
      const newEntries = await reloadTimesheets();

      if (isVisitor && Array.isArray(newEntries)) {
        const hasAnyEntryInMonth = newEntries.some((entry) => {
          const entryEmployeeId = normalizeId(entry.employeeId);
          return entryEmployeeId === String(employeeId);
        });

        if (!hasAnyEntryInMonth) {
          setVisitorsManual((prev) => prev.filter((v) => String(v._id) !== String(employeeId)));
        }
      }

      setShowPontajModal(false);
      setPontajData(null);
      setHasExistingPontaj(false);
    } catch (err: any) {
      console.error("Eroare la ștergerea pontajului:", err);
      alert(err.data?.error || "Eroare la ștergerea pontajului");
    } finally {
      setSaving(false);
    }
  }, [pontajData, hasExistingPontaj, reloadTimesheets, visitorIds]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-500">Se încarcă...</div>
      </div>
    );
  }

  const leaveTypeMap: Record<string, string> = {
    odihna: "CO",      // ✅ Concediu Odihnă
    medical: "CM",     // Concediu Medical
    fara_plata: "CFP", // Concediu Fără Plată
    eveniment: "CE",   // Concediu Eveniment
  };

  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Vizualizare Pontaj</h2>
          <p className="text-sm text-slate-500 mt-1">
            {workplaceName} - {format(new Date(selectedMonth + "-01"), "MMMM yyyy", { locale: ro })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-700">Selectează luna:</label>
          <div className="flex gap-2">
            <select
              value={selectedMonth.split("-")[0]}
              onChange={(e) => {
                const year = e.target.value;
                const month = selectedMonth.split("-")[1];
                setSelectedMonth(`${year}-${month}`);
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
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
            <select
              value={selectedMonth.split("-")[1]}
              onChange={(e) => {
                const month = e.target.value;
                const year = selectedMonth.split("-")[0];
                setSelectedMonth(`${year}-${month}`);
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
            >
              {Array.from({ length: 12 }, (_, i) => {
                const monthNum = String(i + 1).padStart(2, "0");
                const monthName = format(new Date(2024, i, 1), "MMMM", { locale: ro });
                return (
                  <option key={monthNum} value={monthNum}>
                    {monthName}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1" style={{ overflowX: 'scroll', overflowY: 'auto', position: 'relative' }}>
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm" style={{ minWidth: 'max-content' }}>
          <table className="w-full border-collapse" style={{ minWidth: 'max-content' }}>
            <thead>
              <tr>
                <th 
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-700 border-b border-slate-200 bg-slate-50 min-w-[200px]"
                  style={{ 
                    position: 'sticky', 
                    left: 0, 
                    top: 0, 
                    zIndex: 20,
                    backgroundColor: '#f8fafc'
                  }}
                >
                  Angajat
                </th>
                {monthDays.map((day) => {
                  const isWeekendCol = isWeekend(day);
                  const isTodayCol = isSameDay(day, today);
                  const bgColor = isTodayCol 
                    ? '#fef3c7' 
                    : isWeekendCol 
                      ? '#f1f5f9' 
                      : '#f8fafc';
                  return (
                    <th
                      key={day.toISOString()}
                      className={`px-2 py-3 text-center text-xs font-semibold border-b border-slate-200 ${
                        isTodayCol
                          ? "text-slate-900"
                          : isWeekendCol
                            ? "text-slate-800"
                            : "text-slate-700"
                      }`}
                      style={{ 
                        minWidth: "60px", 
                        position: 'sticky', 
                        top: 0, 
                        zIndex: 10,
                        backgroundColor: bgColor
                      }}
                    >
                      <div>{format(day, "d", { locale: ro })}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {format(day, "EEE", { locale: ro })}
                      </div>
                    </th>
                  );
                })}
                <th 
                  className="px-4 py-3 text-center text-xs font-semibold text-slate-700 border-b border-slate-200"
                  style={{ 
                    position: 'sticky', 
                    top: 0, 
                    zIndex: 10,
                    backgroundColor: '#ecfdf5'
                  }}
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {peopleInTable.length === 0 ? (
                <tr>
                  <td colSpan={monthDays.length + 2} className="px-4 py-8 text-center text-slate-500">
                    Nu există angajați
                  </td>
                </tr>
              ) : (
                peopleInTable.map((employee) => {
                  const { totalHours } = getEmployeeTotal(employee._id);
                  const isVisitor = visitorIds.has(employee._id);
                  return (
                    <tr key={employee._id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm sticky left-0 bg-white z-10 border-r border-slate-100">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium text-slate-900">
                              {employee.name || "-"}
                            </div>
                            {isVisitor && (
                              <div className="text-[11px] text-amber-600 font-semibold mt-0.5">
                                vizitator
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      {monthDays.map((day) => {
                        const entries = getDayEntries(employee._id, day);
                        const dayData = getDayHours(entries, day, employee._id); // ✅ Pasează employeeId pentru verificare concedii
                        const isTodayCol = isSameDay(day, today);
                        const isWeekendCol = isWeekend(day);

                        // ✅ Verifică dacă există concediu aprobat chiar dacă nu există entry de pontaj
                        if (entries.length === 0) {
                          const approvedLeave = getApprovedLeaveForDay(employee._id, day);
                          if (approvedLeave) {
                            const leaveType = approvedLeave.type || 'odihna';
                            return (
                              <td
                                key={day.toISOString()}
                                className={`px-2 py-2 text-center text-xs font-medium text-blue-700 border-r border-slate-100 ${
                                  isTodayCol
                                    ? "bg-yellow-100/60"
                                    : isWeekendCol
                                      ? "bg-slate-100/40"
                                      : ""
                                }`}
                                title={leaveTypeMap[leaveType] || "Concediu"}
                              >
                                {leaveTypeMap[leaveType] || "CO"}
                              </td>
                            );
                          }
                          
                          return (
                            <td
                              key={day.toISOString()}
                              onClick={() => handleCellClick(employee, day, entries)}
                              className={`px-2 py-2 text-center text-xs border-r border-slate-100 cursor-pointer hover:bg-emerald-50 transition-colors ${
                                isTodayCol
                                  ? "bg-yellow-100/60"
                                  : isWeekendCol
                                    ? "bg-slate-100/40"
                                    : ""
                              }`}
                              title="Click pentru a ponta"
                            >
                              -
                            </td>
                          );
                        }

                        if (dayData.isLeave) {
                          return (
                            <td
                              key={day.toISOString()}
                              className={`px-2 py-2 text-center text-xs font-medium text-blue-700 border-r border-slate-100 ${
                                isTodayCol
                                  ? "bg-yellow-100/60"
                                  : isWeekendCol
                                    ? "bg-slate-100/40"
                                    : ""
                              }`}
                              title={dayData.leaveType}
                            >
                              {dayData.leaveType ? (leaveTypeMap[dayData.leaveType] || "C") : "C"}
                            </td>
                          );
                        }

                        const getTooltip = () => {
                          if (dayData.isVisitor && dayData.visitorInfo && dayData.visitorInfo.length > 0) {
                            const visitorDetails = dayData.visitorInfo.map(info => 
                              `Vizitator la ${info.workplaceName} pe ${info.date}`
                            ).join("; ");
                            return `Click pentru a edita pontajul\n${visitorDetails}`;
                          }
                          return "Click pentru a edita pontajul";
                        };

                        return (
                          <td
                            key={day.toISOString()}
                            onClick={() => handleCellClick(employee, day, entries)}
                            className={`px-2 py-2 text-center text-xs border-r border-slate-100 cursor-pointer hover:bg-emerald-50 transition-colors ${
                              isTodayCol
                                ? "bg-yellow-100/60"
                                : isWeekendCol
                                  ? "bg-slate-100/40"
                                  : ""
                            }`}
                            title={getTooltip()}
                          >
                            {dayData.isVisitor ? "* " : ""}
                            {formatHours(dayData.hours || 0, dayData.minutes || 0)}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center text-sm font-semibold text-emerald-700 bg-emerald-50/50">
                        {formatHours(totalHours)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-start font-semibold">
        <AddVisitor
          items={allEmployeesForPicker}
          excludeIds={excludeIds}
          onPick={addVisitorManual}
          disabled={false}
          label="Adauga vizitator completand campul ->"
        />
      </div>

      {showPontajModal && pontajData && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            minHeight: '100vh',
            minWidth: '100vw'
          }}
        >
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl" style={{ maxWidth: '28rem' }}>
            <div className="mb-4 text-center">
              <h3 className="text-lg font-bold text-slate-900">
                Pontaj - {pontajData.employee.name}
              </h3>
            </div>
            <p className="text-sm text-slate-600 mb-6 text-center">
              Data: {format(new Date(pontajData.date), "dd MMMM yyyy", { locale: ro })}
            </p>

            <div className="mb-6 space-y-5">
              <div className="flex flex-col items-center">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Ora intrare:
                </label>
                <TimePicker
                  value={startTime}
                  onChange={setStartTime}
                  disabled={false}
                />
              </div>
              <div className="flex flex-col items-center">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Ora ieșire:
                </label>
                <TimePicker
                  value={endTime}
                  onChange={setEndTime}
                  disabled={false}
                />
              </div>
            </div>

            <div className="flex gap-3 justify-center mt-6">
              <button
                onClick={() => {
                  setShowPontajModal(false);
                  setPontajData(null);
                }}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                disabled={saving}
              >
                Anulează
              </button>
              {hasExistingPontaj && (
                <button
                  onClick={handleDeletePontaj}
                  disabled={saving}
                  className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? "Șterge..." : "Șterge pontajul"}
                </button>
              )}
              <button
                onClick={handleSavePontaj}
                disabled={saving}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? "Salvează..." : "Salvează"}
              </button>
            </div>
          </div>
        </div>
      )}

      {overlapData && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            minHeight: '100vh',
            minWidth: '100vw'
          }}
        >
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-slate-900 mb-3">
              Modifici pontajul existent?
            </h3>
            <p className="text-sm text-slate-700 mb-3">
              Pentru <span className="font-semibold">{overlapData.employeeName}</span> în data de{" "}
              <span className="font-semibold">
                {format(new Date(overlapData.date), "dd.MM.yyyy")}
              </span>{" "}
              există deja un pontaj salvat.
            </p>
            {overlapData.overlappingEntry && (
              <p className="text-xs text-slate-600 mb-1">
                Pontaj vechi:{" "}
                <span className="font-mono">
                  {overlapData.overlappingEntry.startTime} - {overlapData.overlappingEntry.endTime}
                </span>
              </p>
            )}
            {overlapData.newEntry && (
              <p className="text-xs text-slate-600 mb-4">
                Pontaj nou:{" "}
                <span className="font-mono">
                  {overlapData.newEntry.startTime} - {overlapData.newEntry.endTime}
                </span>
              </p>
            )}
            <p className="text-sm text-slate-700 mb-4">
              Dacă continui, pontajul vechi va fi <span className="font-semibold">rescris</span> cu
              noul interval de ore (nu se adună și nu se suprapune).
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCancelOverlap}
                disabled={saving}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Anulează
              </button>
              <button
                onClick={handleConfirmOverlap}
                disabled={saving}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Rescrie..." : "Rescrie pontajul"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TimesheetViewer;

