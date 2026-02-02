import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { UserGuide } from "@/shared/components/UserGuide";
import { timesheetService } from "@/features/timesheet/services/timesheetService";
import { leaveService } from "@/features/leaves/services/leaveService";
import { employeeService } from "@/shared/services/employeeService";
import { workplaceService } from "@/shared/services/workplaceService";
import { getUserFromStorage } from "@/features/auth/utils/auth.utils";
import type { User } from "@/features/auth/types/auth.types";
import type { Leave } from "@/features/leaves/types/leave.types";
import type { Workplace } from "@/shared/types/workplace.types";
import type { Employee } from "@/shared/types/employee.types";
import type { TimesheetViewerEntry } from "@/features/timesheet/types/timesheet.types";

type ActiveView = "pontaj" | "cereri";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showOnlyVisitors, setShowOnlyVisitors] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>("pontaj");
  const [searchEmployeeLeaves, setSearchEmployeeLeaves] = useState("");

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

    const loadData = async () => {
      setLoading(true);
      setError("");

      try {
        const [year, month] = selectedMonth.split("-").map(Number);
        const lastDay = new Date(year, month, 0);
        
        const from = `${year}-${String(month).padStart(2, "0")}-01`;
        const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;

        // Dacă e selectat un workplace, încarcă doar pentru acela
        if (selectedWorkplace) {
          const [timesheetsData, leavesData, employeesData] = await Promise.all([
            timesheetService.getEntriesByWorkplace(selectedWorkplace, from, to),
            leaveService.getByWorkplace(selectedWorkplace),
            employeeService.getByWorkplace(selectedWorkplace),
          ]);

          setTimesheets(timesheetsData);
          setLeaves(leavesData);
          
          // Filtrează doar angajații care au workplaceId egal cu farmacia selectată
          const employeesFromSelectedWorkplace = employeesData.filter((emp) => {
            const empWorkplaceId = typeof emp.workplaceId === 'string' 
              ? emp.workplaceId 
              : String((emp.workplaceId as any)?._id || emp.workplaceId || '');
            return empWorkplaceId === String(selectedWorkplace);
          });
          
          setEmployees(employeesFromSelectedWorkplace);
        } else {
          // Dacă nu e selectat workplace, încarcă toate datele pentru toate farmaciile
          const [timesheetsData, leavesData, employeesData] = await Promise.all([
            timesheetService.getAllEntries(from, to),
            leaveService.getAll(),
            employeeService.getAll(),
          ]);

          setTimesheets(timesheetsData);
          setLeaves(leavesData);
          setEmployees(employeesData);
        }
      } catch (err) {
        console.error("Eroare la încărcarea datelor:", err);
        setError("Eroare la încărcarea datelor.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedMonth, selectedWorkplace]);

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

  // Helper: obține datele pentru un angajat într-o zi specifică
  const getEmployeeDayData = (employeeId: string, date: string): DayData | null => {
    const normalizedDate = normalizeDate(date);
    if (!normalizedDate) {
      return null;
    }

    // Verifică PRIMUL leaves (concedii aprobate)
    const leave = leaves.find((l) => {
      const lEmployeeId = typeof l.employeeId === 'string' 
        ? l.employeeId 
        : String((l.employeeId as any)?._id || l.employeeId || '');
      if (lEmployeeId !== String(employeeId) || l.status !== "Aprobată") {
        return false;
      }
      const startDate = normalizeDate(l.startDate);
      const endDate = normalizeDate(l.endDate);
      if (!startDate || !endDate) return false;
      return startDate <= normalizedDate && endDate >= normalizedDate;
    });

    if (leave) {
      const leaveTypeFullMap: Record<string, string> = {
        odihna: "Concediu de odihnă",
        medical: "Concediu medical",
        fara_plata: "Concediu fără plată",
        eveniment: "Concediu pentru evenimente familiale",
      };
      return {
        type: "leave",
        value: "C",
        leaveTypeFull: leaveTypeFullMap[leave.type] || leave.type,
      };
    }

    // Găsește TOATE entry-urile pentru acest angajat în această zi
    const dayEntries = timesheets.filter((ts) => {
      const tsEmployeeId = typeof ts.employeeId === 'string' 
        ? ts.employeeId 
        : String((ts.employeeId as any)?._id || ts.employeeId || '');
      const tsDate = normalizeDate(ts.date);
      return tsEmployeeId === String(employeeId) && tsDate === normalizedDate;
    });

    if (dayEntries.length === 0) {
      return null;
    }

    // Verifică dacă există leaveType în timesheet
    const entryWithLeave = dayEntries.find((ts) => ts.leaveType);
    if (entryWithLeave) {
      const leaveTypeFullMap: Record<string, string> = {
        odihna: "Concediu de odihnă",
        medical: "Concediu medical",
        fara_plata: "Concediu fără plată",
        eveniment: "Concediu pentru evenimente familiale",
      };
      return {
        type: "leave",
        value: "C",
        leaveTypeFull: leaveTypeFullMap[entryWithLeave.leaveType || ''] || entryWithLeave.leaveType || '',
      };
    }

    // Agregă orele lucrate din toate entry-urile pentru aceeași zi
    let totalHours = 0;
    let hasVisitorHours = false;
    const visitorWorkplaces: Array<{ workplaceName: string; hoursWorked: number }> = [];
    
    dayEntries.forEach((ts) => {
      if (ts.hoursWorked !== undefined && ts.hoursWorked !== null && ts.hoursWorked > 0) {
        totalHours += ts.hoursWorked;
        
        if (ts.type === "visitor") {
          hasVisitorHours = true;
          if (ts.workplaceName) {
            visitorWorkplaces.push({
              workplaceName: ts.workplaceName,
              hoursWorked: ts.hoursWorked || 0,
            });
          }
        }
      }
    });

    if (totalHours > 0) {
      const hours = Math.round(totalHours);
      return {
        type: "work",
        value: `${hours}`,
        hasVisitor: hasVisitorHours,
        visitorWorkplaces: visitorWorkplaces,
        date: normalizedDate,
      };
    }

    return null;
  };

  // Calculează totalul orelor lucrate pentru un angajat în luna selectată
  const getEmployeeMonthTotal = (employeeId: string): number => {
    let totalHours = 0;
    
    timesheets.forEach((entry) => {
      const entryEmployeeId = typeof entry.employeeId === 'string' 
        ? entry.employeeId 
        : String((entry.employeeId as any)?._id || entry.employeeId || '');
      if (entryEmployeeId === String(employeeId)) {
        const entryDate = normalizeDate(entry.date);
        if (!entryDate) return;
        
        const [year, month] = selectedMonth.split("-").map(Number);
        const entryDateObj = new Date(entryDate);
        if (entryDateObj.getFullYear() === year && entryDateObj.getMonth() + 1 === month) {
          if (entry.hoursWorked !== undefined && entry.hoursWorked !== null && entry.hoursWorked > 0) {
            totalHours += entry.hoursWorked;
          }
        }
      }
    });
    
    return Math.round(totalHours * 10) / 10;
  };

  // Calculează totalul orelor ca vizitator pentru un angajat în luna selectată
  const getEmployeeVisitorHours = (employeeId: string): number => {
    let visitorHours = 0;
    
    timesheets.forEach((ts) => {
      const tsEmployeeId = typeof ts.employeeId === 'string' 
        ? ts.employeeId 
        : String((ts.employeeId as any)?._id || ts.employeeId || '');
      if (tsEmployeeId === String(employeeId)) {
        const tsDate = normalizeDate(ts.date);
        if (!tsDate) return;
        
        const [year, month] = selectedMonth.split("-").map(Number);
        const tsDateObj = new Date(tsDate);
        if (tsDateObj.getFullYear() === year && tsDateObj.getMonth() + 1 === month) {
          if (ts.type === "visitor" && ts.hoursWorked && ts.hoursWorked > 0) {
            visitorHours += ts.hoursWorked;
          }
        }
      }
    });
    
    return Math.round(visitorHours);
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

  // Verifică dacă o dată este sărbătoare legală
  const isLegalHoliday = (dateStr: string | null): boolean => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const monthDay = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return legalHolidays[monthDay] !== undefined;
  };

  // Verifică dacă o dată este weekend
  const isWeekendDate = (dateStr: string | null): boolean => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
  };

  // Calculează orele lucrate în weekend (WE)
  const getEmployeeWeekendHours = (employeeId: string): number => {
    let weekendHours = 0;
    
    timesheets.forEach((ts) => {
      const tsEmployeeId = typeof ts.employeeId === 'string' 
        ? ts.employeeId 
        : String((ts.employeeId as any)?._id || ts.employeeId || '');
      if (tsEmployeeId === String(employeeId)) {
        const tsDate = normalizeDate(ts.date);
        if (!tsDate) return;
        
        const [year, month] = selectedMonth.split("-").map(Number);
        const tsDateObj = new Date(tsDate);
        if (tsDateObj.getFullYear() === year && tsDateObj.getMonth() + 1 === month) {
          if (isWeekendDate(tsDate) && ts.hoursWorked && ts.hoursWorked > 0 && !ts.leaveType) {
            weekendHours += ts.hoursWorked;
          }
        }
      }
    });
    
    return Math.round(weekendHours * 10) / 10;
  };

  // Calculează orele lucrate în sărbătorile legale (S.L)
  const getEmployeeLegalHolidayHours = (employeeId: string): number => {
    let holidayHours = 0;
    
    timesheets.forEach((ts) => {
      const tsEmployeeId = typeof ts.employeeId === 'string' 
        ? ts.employeeId 
        : String((ts.employeeId as any)?._id || ts.employeeId || '');
      if (tsEmployeeId === String(employeeId)) {
        const tsDate = normalizeDate(ts.date);
        if (!tsDate) return;
        
        const [year, month] = selectedMonth.split("-").map(Number);
        const tsDateObj = new Date(tsDate);
        if (tsDateObj.getFullYear() === year && tsDateObj.getMonth() + 1 === month) {
          if (isLegalHoliday(tsDate) && ts.hoursWorked && ts.hoursWorked > 0 && !ts.leaveType) {
            holidayHours += ts.hoursWorked;
          }
        }
      }
    });
    
    return Math.round(holidayHours * 10) / 10;
  };

  // Calculează orele lucrate în garda
  const getEmployeeGardaHours = (employeeId: string): number => {
    let gardaHours = 0;
    
    timesheets.forEach((ts) => {
      const tsEmployeeId = typeof ts.employeeId === 'string' 
        ? ts.employeeId 
        : String((ts.employeeId as any)?._id || ts.employeeId || '');
      if (tsEmployeeId === String(employeeId)) {
        const tsDate = normalizeDate(ts.date);
        if (!tsDate) return;
        
        const [year, month] = selectedMonth.split("-").map(Number);
        const tsDateObj = new Date(tsDate);
        if (tsDateObj.getFullYear() === year && tsDateObj.getMonth() + 1 === month) {
          if (ts.status === "garda" && ts.hoursWorked && ts.hoursWorked > 0) {
            gardaHours += ts.hoursWorked;
          }
        }
      }
    });
    
    return Math.round(gardaHours * 10) / 10;
  };

  // Calculează orele suplimentare (SUPL)
  const getEmployeeSuplHours = (employeeId: string): number => {
    const totalHours = getEmployeeMonthTotal(employeeId);
    const employee = employees.find(emp => String(emp._id) === String(employeeId));
    const targetHours = employee?.monthlyTargetHours || 160;
    const suplHours = totalHours > targetHours ? totalHours - targetHours : 0;
    return Math.round(suplHours * 10) / 10;
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
  const getLeaveTypeLabel = (type: string | undefined): string => {
    const types: Record<string, string> = {
      odihna: "Concediu de odihnă",
      medical: "Concediu medical",
      fara_plata: "Concediu fără plată",
      eveniment: "Concediu pentru evenimente familiale",
    };
    return types[type || ''] || type || '';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-[98vw] mx-auto p-6">
        {/* HEADER MODERN */}
        <div className="mb-6">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <div className="flex items-center gap-4 mb-6">
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
                onClick={() => setActiveView("cereri")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeView === "cereri"
                    ? "text-emerald-600 border-b-2 border-emerald-600"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Cereri Aprobate
                {leaves.filter(l => l.status === "Aprobată").length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                    {leaves.filter(l => l.status === "Aprobată").length}
                  </span>
                )}
              </button>
            </div>

            {/* FILTRE */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 bg-white hover:border-slate-400"
                    />
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
                </>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Caută angajat
                  </label>
                  <input
                    type="text"
                    placeholder="Introdu numele angajatului..."
                    value={searchEmployeeLeaves}
                    onChange={(e) => setSearchEmployeeLeaves(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 bg-white hover:border-slate-400"
                  />
                </div>
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

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
              <p className="text-slate-500 font-medium">Se încarcă datele...</p>
            </div>
          ) : activeView === "cereri" ? (
            // SECȚIUNE CERERI APROBATE
            <div className="p-6">
              {(() => {
                let approvedLeaves = leaves.filter(l => l.status === "Aprobată");
                
                if (selectedWorkplace) {
                  approvedLeaves = approvedLeaves.filter(l => {
                    const lWorkplaceId = typeof l.workplaceId === 'string' 
                      ? l.workplaceId 
                      : String((l.workplaceId as any)?._id || l.workplaceId || '');
                    return lWorkplaceId === String(selectedWorkplace);
                  });
                }
                
                if (searchEmployeeLeaves) {
                  const searchLower = searchEmployeeLeaves.toLowerCase();
                  approvedLeaves = approvedLeaves.filter(l => {
                    let empName = "";
                    if (l.name) {
                      empName = l.name;
                    } else if (typeof l.employeeId === 'object' && l.employeeId && 'name' in l.employeeId) {
                      empName = String((l.employeeId as any).name || "");
                    }
                    return empName.toLowerCase().includes(searchLower);
                  });
                }
                
                approvedLeaves = approvedLeaves.sort((a, b) => {
                  const dateA = new Date(a.startDate);
                  const dateB = new Date(b.startDate);
                  return dateB.getTime() - dateA.getTime();
                });
                
                if (approvedLeaves.length === 0) {
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
                        Nu există cereri aprobate{selectedWorkplace || searchEmployeeLeaves ? " pentru filtrele selectate" : ""}.
                      </p>
                    </div>
                  );
                }
                
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-slate-900">
                        Cereri de concediu aprobate ({approvedLeaves.length})
                      </h2>
                    </div>
                    
                    <div className="grid gap-4">
                      {approvedLeaves.map((leave) => {
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
                                <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  Aprobată
                                </span>
                                {leave.updatedAt && (
                                  <span className="text-xs text-slate-400">
                                    Aprobată: {formatDate(leave.updatedAt)}
                                  </span>
                                )}
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
                        className={`px-0.5 py-2.5 text-center font-bold text-slate-700 min-w-[28px] text-[9px] border-l border-slate-200 ${
                          day.isWeekend ? "bg-amber-50" : ""
                        }`}
                      >
                        <div className="text-xs font-bold text-slate-900 leading-tight">{day.dayName}</div>
                        <div className="text-[10px] font-normal text-slate-500 leading-tight mt-0.5">{day.day}</div>
                      </th>
                    ))}
                    <th className="px-1.5 py-2.5 text-center font-bold text-emerald-700 min-w-[40px] text-xs bg-emerald-50 border-l-2 border-emerald-300 border-r border-slate-200 border-t border-slate-200 border-b border-slate-200">
                      Total
                    </th>
                    <th className="px-1.5 py-2.5 text-center font-bold text-indigo-700 min-w-[40px] text-xs bg-indigo-50 border-l border-slate-200 border-r border-slate-200 border-t border-slate-200 border-b border-slate-200">
                      Garda
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
                        colSpan={monthDays.length + 6}
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
                            const shouldHighlight = showOnlyVisitors && hasVisitor;
                            
                            let bgClass = "";
                            if (shouldHighlight) {
                              bgClass = "bg-blue-50";
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
                                style={shouldHighlight ? { backgroundColor: '#eff6ff' } : undefined}
                                title={tooltipText || undefined}
                              >
                                {dayData ? (
                                  <span 
                                    className={`inline-flex items-center justify-center px-1 py-0.5 rounded text-xs font-semibold ${
                                      dayData.type === 'leave' 
                                        ? 'bg-amber-100 text-amber-800' 
                                        : 'bg-emerald-50 text-emerald-700'
                                    } ${dayData.type === 'leave' ? 'cursor-help' : ''}`}
                                    title={dayData.type === 'leave' && dayData.leaveTypeFull ? dayData.leaveTypeFull : undefined}
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
                          <td className="px-1.5 py-1.5 text-center align-middle font-bold bg-emerald-50 border-l-2 border-emerald-300 border-r border-slate-200 border-t border-slate-200 border-b border-slate-200">
                            <div className="text-xs text-emerald-700">{getEmployeeMonthTotal(employee._id)}</div>
                            {getEmployeeVisitorHours(employee._id) > 0 && (
                              <div className="text-[8px] text-blue-600 font-medium mt-0.5">
                                ({getEmployeeVisitorHours(employee._id)})
                              </div>
                            )}
                          </td>
                          <td className="px-1.5 py-1.5 text-center align-middle font-bold bg-indigo-50 border-l border-slate-200 border-r border-slate-200 border-t border-slate-200 border-b border-slate-200">
                            <div className="text-xs text-indigo-700">{getEmployeeGardaHours(employee._id)}</div>
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
                                className={`px-0.5 py-2.5 text-center font-bold text-slate-700 min-w-[28px] text-[9px] border-l border-slate-200 ${
                                  day.isWeekend ? "bg-amber-50" : ""
                                }`}
                              >
                                <div className="text-xs font-bold text-slate-900 leading-tight">{day.dayName}</div>
                                <div className="text-[10px] font-normal text-slate-500 leading-tight mt-0.5">{day.day}</div>
                              </th>
                            ))}
                            <th className="px-1.5 py-2.5 text-center font-bold text-emerald-700 min-w-[40px] text-xs bg-emerald-50 border-l-2 border-emerald-300 border-r border-slate-200 border-t border-slate-200 border-b border-slate-200">
                              Total
                            </th>
                            <th className="px-1.5 py-2.5 text-center font-bold text-indigo-700 min-w-[40px] text-xs bg-indigo-50 border-l border-slate-200 border-r border-slate-200 border-t border-slate-200 border-b border-slate-200">
                              Garda
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
                                    const shouldHighlight = showOnlyVisitors && hasVisitor;
                                    
                                    let bgClass = "";
                                    if (shouldHighlight) {
                                      bgClass = "bg-blue-50";
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
                                        style={shouldHighlight ? { backgroundColor: '#eff6ff' } : undefined}
                                        title={tooltipText || undefined}
                                      >
                                        {dayData ? (
                                          <span 
                                            className={`inline-flex items-center justify-center px-1 py-0.5 rounded text-xs font-semibold ${
                                              dayData.type === 'leave' 
                                                ? 'bg-amber-100 text-amber-800' 
                                                : 'bg-emerald-50 text-emerald-700'
                                            } ${dayData.type === 'leave' ? 'cursor-help' : ''}`}
                                            title={dayData.type === 'leave' && dayData.leaveTypeFull ? dayData.leaveTypeFull : undefined}
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
                                  <td className="px-1.5 py-1.5 text-center align-middle font-bold bg-emerald-50 border-l-2 border-emerald-300 border-r border-slate-200 border-t border-slate-200 border-b border-slate-200">
                                    <div className="text-xs text-emerald-700">{getEmployeeMonthTotal(employee._id)}</div>
                                    {getEmployeeVisitorHours(employee._id) > 0 && (
                                      <div className="text-[8px] text-blue-600 font-medium mt-0.5">
                                        ({getEmployeeVisitorHours(employee._id)})
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-1.5 py-1.5 text-center align-middle font-bold bg-indigo-50 border-l border-slate-200 border-r border-slate-200 border-t border-slate-200 border-b border-slate-200">
                                    <div className="text-xs text-indigo-700">{getEmployeeGardaHours(employee._id)}</div>
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
      <UserGuide />
    </div>
  );
};

export default AccountancyDashboard;

