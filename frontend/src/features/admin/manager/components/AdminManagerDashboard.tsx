import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WorkplaceCalendar } from "@/shared/components/WorkplaceCalendar";
import { leaveService } from "@/features/leaves/services/leaveService";
import { workplaceService } from "@/shared/services/workplaceService";
import { employeeService } from "@/shared/services/employeeService";
import { timesheetService } from "@/features/timesheet/services/timesheetService";
import { getUserFromStorage } from "@/features/auth/utils/auth.utils";
import { API_URL } from "@/config/api";
import { FetchError } from "@/shared/types/api.types";
import type { User } from "@/features/auth/types/auth.types";
import type { Leave } from "@/features/leaves/types/leave.types";
import type { Workplace } from "@/shared/types/workplace.types";
import type { Employee } from "@/shared/types/employee.types";
import type { TimesheetStatistics } from "@/features/timesheet/types/timesheet.types";

type ActiveTab = "toate" | "in_asteptare" | "aprobate" | "respinse";

interface EmployeeStat {
  employeeId: string;
  employeeName: string;
  workplaceId: string;
  workplaceName: string;
  targetHours: number;
  workedHours: number;
  workedMinutes?: number;
}

interface LeaveWithActive extends Leave {
  isActive?: boolean;
}

const AdminManagerDashboard: React.FC = () => {
  const navigate = useNavigate();
  
  // ✅ Default tab: "În așteptare" pentru a vedea cererile noi
  const [activeTab, setActiveTab] = useState<ActiveTab>("in_asteptare");
  const [calendarView, setCalendarView] = useState(false);
  const [hoursStatsView, setHoursStatsView] = useState(false);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtru simplu - doar căutare după nume
  const [searchEmployee, setSearchEmployee] = useState("");

  // ✅ Obține user-ul din localStorage (o singură dată la mount)
  const [user] = useState<User | null>(() => {
    return getUserFromStorage();
  });

  // ✅ Statistici ore
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [timesheets, setTimesheets] = useState<TimesheetStatistics[]>([]);
  const [selectedWorkplaceStats, setSelectedWorkplaceStats] = useState("all");
  const [selectedMonthStats, setSelectedMonthStats] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [loadingStats, setLoadingStats] = useState(false);
  const [searchEmployeeStats, setSearchEmployeeStats] = useState("");
  const [showOvertime, setShowOvertime] = useState(false);
  const [showWorkplaceModal, setShowWorkplaceModal] = useState(false);
  const [selectedWorkplaceForModal, setSelectedWorkplaceForModal] = useState<Workplace | null>(null);
  
  // ✅ Notificări pentru cererile noi aprobate
  const [recentApprovedLeaves, setRecentApprovedLeaves] = useState<Leave[]>([]);
  
  // ✅ Tracking pentru cererile văzute (folosind localStorage)
  const [viewedLeaveIds, setViewedLeaveIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("viewedNewLeaves");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  
  // ✅ Toggle pentru notificări email (salvat în backend - User model)
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true); // Default: activat
  
  // ✅ Încarcă preferința din backend la mount
  useEffect(() => {
    const loadEmailPreference = async () => {
      try {
        const res = await fetch(`${API_URL}/api/users/email-notifications`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.emailNotificationsEnabled !== undefined) {
            setEmailNotificationsEnabled(data.emailNotificationsEnabled);
          }
        }
      } catch (err) {
        console.error("Eroare la încărcarea preferinței email:", err);
      }
    };
    
    loadEmailPreference();
  }, []);

  // ✅ LOAD CERERI – FĂRĂ BLOCAJ, FĂRĂ localStorage
  const loadLeaves = async () => {
    try {
      setLoading(true);

      // 1️⃣ ÎNCERCARE SUPERADMIN (vede tot)
      try {
        const allLeaves = await leaveService.getAll();
        setLeaves(allLeaves);
      } catch (err: unknown) {
        // Dacă nu e superadmin (403) → fallback pe farmacie
        const isForbidden = err instanceof FetchError && err.status === 403;
        if (isForbidden && user?.workplaceId) {
          const workplaceId = typeof user.workplaceId === 'string' 
            ? user.workplaceId 
            : String((user.workplaceId as any)?._id || user.workplaceId || '');
          try {
            const workplaceLeaves = await leaveService.getByWorkplace(workplaceId);
            setLeaves(workplaceLeaves);
          } catch (fallbackErr) {
            console.error("❌ Eroare la încărcarea concediilor pentru farmacie:", fallbackErr);
            setLeaves([]);
          }
        } else {
          // Altă eroare sau nu are workplaceId
          console.error("❌ Eroare la încărcarea concediilor:", err);
          setLeaves([]);
        }
      }
    } catch (err) {
      console.error("❌ Eroare neașteptată la încărcarea concediilor:", err);
      setLeaves([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Reîncarcă concediile doar o singură dată la mount
  useEffect(() => {
    loadLeaves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - se execută doar o dată
  
  // ✅ Detectează cererile noi în așteptare pentru notificări
  useEffect(() => {
    if (leaves.length === 0) return;
    
    // Găsește cererile în așteptare din ultimele 24 de ore (cereri noi)
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recent = leaves.filter(leave => {
      if (leave.status !== "În așteptare") return false;
      const createdAt = new Date(leave.createdAt || leave.updatedAt || 0);
      return createdAt >= yesterday;
    });
    
    setRecentApprovedLeaves(recent);
  }, [leaves]);
  
  // ✅ Salvează cererile văzute în localStorage
  const markLeavesAsViewed = (leaveIds: string[]) => {
    const newViewedIds = [...new Set([...viewedLeaveIds, ...leaveIds])];
    setViewedLeaveIds(newViewedIds);
    try {
      localStorage.setItem("viewedNewLeaves", JSON.stringify(newViewedIds));
    } catch (err) {
      console.error("Eroare la salvarea cererilor văzute:", err);
    }
  };
  
  // ✅ Filtrează cererile noi care nu au fost văzute
  const unseenNewLeaves = useMemo(() => {
    return recentApprovedLeaves.filter(leave => {
      const leaveId = String(leave._id);
      return !viewedLeaveIds.includes(leaveId);
    });
  }, [recentApprovedLeaves, viewedLeaveIds]);
  

  // ✅ RESETEAZĂ CĂUTAREA CÂND SE SCHIMBĂ TAB-UL
  useEffect(() => {
    setSearchEmployee("");
  }, [activeTab]);

  // ✅ LOAD WORKPLACES pentru statistici
  useEffect(() => {
    const loadWorkplaces = async () => {
      try {
        const list = await workplaceService.getAllForAdmin();
        setWorkplaces(list);
      } catch (err) {
        console.error("❌ Eroare la încărcarea farmaciilor:", err);
        setWorkplaces([]);
      }
    };
    loadWorkplaces();
  }, []);

  // ✅ LOAD STATISTICI ORE (optimizat pentru 250+ angajați)
  const loadHoursStats = async () => {
    if (!selectedMonthStats) return;
    
    setLoadingStats(true);
    try {
      const [year, month] = selectedMonthStats.split("-").map(Number);
      const lastDay = new Date(year, month, 0);
      
      const from = `${year}-${String(month).padStart(2, "0")}-01`;
      const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;

      // Încarcă toți angajații
      const employeesData = await employeeService.getAll();
      setEmployees(employeesData);

      // ✅ Optimizare: folosim endpoint-ul nou pentru statistici agregate
      const stats = await timesheetService.getStats(
        from,
        to,
        selectedWorkplaceStats === "all" ? undefined : selectedWorkplaceStats
      );
      
      // Transformă statisticile în format compatibil cu codul existent
      const transformedStats: TimesheetStatistics[] = stats.map(stat => ({
        employeeId: stat.employeeId,
        employeeName: stat.employeeName || "",
        workplaceId: stat.workplaceId,
        totalHours: stat.totalHours || 0,
        totalMinutes: stat.totalMinutes || 0,
        visitorHours: stat.visitorHours || 0,
      }));
      
      setTimesheets(transformedStats);
    } catch (err) {
      console.error("❌ Eroare la încărcarea statisticilor:", err);
      setTimesheets([]);
      setEmployees([]);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (hoursStatsView && workplaces.length > 0) {
      loadHoursStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoursStatsView, selectedMonthStats, selectedWorkplaceStats, workplaces.length]);

  // ✅ APROBARE CERERE
  const approveLeave = async (id: string) => {
    try {
      await leaveService.approve(id);
      // Reîncarcă lista după update
      await loadLeaves();
    } catch (err) {
      console.error("❌ Eroare la aprobarea cererii:", err);
      alert((err as Error).message || "Eroare la aprobare");
    }
  };

  // ✅ RESPINGERE CERERE
  const rejectLeave = async (id: string) => {
    try {
      await leaveService.reject(id);
      // Reîncarcă lista după update
      await loadLeaves();
    } catch (err) {
      console.error("❌ Eroare la respingerea cererii:", err);
      alert((err as Error).message || "Eroare la respingere");
    }
  };


  // ✅ FILTRARE CERERI
  const filteredLeaves = useMemo(
    () => {
      let filtered = leaves;

      // Filtrare pe status în funcție de activeTab
      if (activeTab === "in_asteptare") {
        filtered = filtered.filter((r) => r.status === "În așteptare");
      } else if (activeTab === "aprobate") {
        filtered = filtered.filter((r) => r.status === "Aprobată");
      } else if (activeTab === "respinse") {
        filtered = filtered.filter((r) => r.status === "Respinsă");
      }
      // activeTab === "toate" - nu filtrează pe status

      // Filtrare pe angajat (căutare după nume)
      if (searchEmployee) {
        const searchLower = searchEmployee.toLowerCase();
        filtered = filtered.filter((r) => {
          // Extrage numele angajatului din diferite surse
          let empName = "";
          if (r.name) {
            empName = r.name;
          } else if (typeof r.employeeId === 'object' && r.employeeId && 'name' in r.employeeId) {
            empName = String((r.employeeId as any).name || "");
          }
          return empName.toLowerCase().includes(searchLower);
        });
      }

      // Sortare după data creării - cele mai recente primele
      filtered = filtered.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.updatedAt || 0);
        const dateB = new Date(b.createdAt || b.updatedAt || 0);
        return dateB.getTime() - dateA.getTime(); // Descrescător - cele mai recente primele
      });

      return filtered;
    },
    [leaves, activeTab, searchEmployee]
  );


  if (loading) {
    return <div className="p-10 text-center">Se încarcă concediile…</div>;
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "Aprobată":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "Respinsă":
        return "bg-red-100 text-red-800 border-red-200";
      case "În așteptare":
        return "bg-amber-100 text-amber-800 border-amber-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString("ro-RO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Helper pentru calcularea statisticilor angajaților
  const calculateEmployeeStats = (): EmployeeStat[] => {
    const employeeStatsMap: Record<string, EmployeeStat> = {};
    
    employees.forEach((emp) => {
      const empId = String(emp._id);
      const targetHours = emp.monthlyTargetHours || 160;
      const workplaceId = typeof emp.workplaceId === 'string' 
        ? emp.workplaceId 
        : String((emp.workplaceId as any)?._id || emp.workplaceId || '');
      const workplaceName = typeof emp.workplaceId === 'object' && emp.workplaceId && 'name' in emp.workplaceId
        ? String((emp.workplaceId as any).name)
        : workplaces.find(w => w._id === workplaceId)?.name || "—";
      
      employeeStatsMap[empId] = {
        employeeId: empId,
        employeeName: emp.name,
        workplaceId,
        workplaceName,
        targetHours,
        workedHours: 0,
        workedMinutes: 0,
      };
    });

    timesheets.forEach((ts) => {
      const empId = typeof ts.employeeId === 'string' 
        ? ts.employeeId 
        : String((ts.employeeId as any)?._id || ts.employeeId || '');
      if (employeeStatsMap[empId]) {
        employeeStatsMap[empId].workedHours += ts.totalHours || 0;
        employeeStatsMap[empId].workedMinutes = (employeeStatsMap[empId].workedMinutes || 0) + (ts.totalMinutes || 0);
      }
    });

    return Object.values(employeeStatsMap);
  };

  const isDateInRange = (date: Date, startDate: string, endDate: string): boolean => {
    const d = new Date(date);
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    d.setHours(0, 0, 0, 0);
    return d >= start && d <= end;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex justify-center p-4">
      <div className="w-full max-w-[98vw] bg-white border border-slate-200 shadow-sm rounded-2xl flex h-[calc(100vh-2rem)] overflow-hidden">
        {/* SIDEBAR */}
        <aside className="w-64 shrink-0 border-r border-slate-200 bg-gradient-to-b from-slate-50 to-white px-4 py-6 flex flex-col gap-4">
          {/* HEADER */}
          <div className="mb-4">
            <div className="flex items-center justify-center mb-4">
              <img 
                src="/logo.svg" 
                alt="Remedium Logo" 
                className="h-12 w-auto object-contain"
              />
            </div>
            <div className="text-center">
              <h2 className="text-sm font-bold text-slate-900 mb-1">
                Admin Manager
              </h2>
              <p className="text-xs text-emerald-600 font-medium">
                Gestionează toate concediile
              </p>
            </div>
          </div>

          {/* MENIU PRINCIPAL */}
          <div className="space-y-1.5">
            <button
              className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-3 ${
                calendarView
                  ? "bg-emerald-100 text-emerald-700 shadow-sm border-l-4 border-emerald-600"
                  : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
              }`}
              onClick={() => {
                setCalendarView(true);
                setHoursStatsView(false);
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Calendar concedii
            </button>

            <button
              className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-3 ${
                hoursStatsView
                  ? "bg-emerald-100 text-emerald-700 shadow-sm border-l-4 border-emerald-600"
                  : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
              }`}
              onClick={() => {
                setHoursStatsView(true);
                setCalendarView(false);
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Statistici ore
            </button>

            <button
              className="w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-3 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
              onClick={() => {
                navigate("/accountancy");
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Resurse Umane
            </button>
          </div>

          {/* SECȚIUNE SETĂRI */}
          <div className="pt-4 border-t border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-2">
              Setări
            </p>
            {/* Toggle pentru notificări email */}
            <div className="px-2 mb-4">
              <label className="flex items-center justify-between cursor-pointer group">
                <div className="flex items-center gap-3 flex-1">
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm text-slate-700 group-hover:text-slate-900">
                    Notificări email
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={emailNotificationsEnabled}
                    onChange={async (e) => {
                      const newValue = e.target.checked;
                      const oldValue = emailNotificationsEnabled;
                      
                      // Optimistic update - setează imediat pentru răspuns rapid UI
                      setEmailNotificationsEnabled(newValue);
                      
                      // ✅ Salvează preferința în backend (User model)
                      try {
                        const res = await fetch(`${API_URL}/api/users/email-notifications`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({ emailNotificationsEnabled: newValue }),
                        });
                        
                        if (res.ok) {
                          const data = await res.json();
                          console.log("✅ Preferință email salvată în backend:", data.emailNotificationsEnabled);
                          
                          // Actualizează state-ul cu valoarea returnată de backend
                          if (data.emailNotificationsEnabled !== undefined) {
                            setEmailNotificationsEnabled(data.emailNotificationsEnabled);
                          }
                        } else {
                          console.error("❌ Eroare la salvarea preferinței email");
                          // Revert la valoarea veche dacă nu s-a putut salva
                          setEmailNotificationsEnabled(oldValue);
                        }
                      } catch (err) {
                        console.error("❌ Eroare la salvarea preferinței email:", err);
                        // Revert la valoarea veche dacă nu s-a putut salva
                        setEmailNotificationsEnabled(oldValue);
                      }
                    }}
                    className="sr-only"
                  />
                  <div
                    className={`w-11 h-6 rounded-full transition-colors duration-200 ${
                      emailNotificationsEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                        emailNotificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* SECȚIUNE FILTRE CERERI */}
          <div className="pt-4 border-t border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-2">
              Filtre Cereri
            </p>
            <nav className="space-y-1">
              <button
                className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-3 ${
                  activeTab === "in_asteptare" && !calendarView && !hoursStatsView
                    ? "bg-amber-100 text-amber-700 shadow-sm border-l-4 border-amber-600"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                onClick={() => {
                  setCalendarView(false);
                  setHoursStatsView(false);
                  setActiveTab("in_asteptare");
                  // Marchează cererile noi ca văzute când se deschide tab-ul "În așteptare"
                  if (unseenNewLeaves.length > 0) {
                    const leaveIds = unseenNewLeaves.map(leave => String(leave._id));
                    markLeavesAsViewed(leaveIds);
                  }
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                În așteptare
                {leaves.filter(l => l.status === "În așteptare").length > 0 && (
                  <span className="ml-auto px-2 py-0.5 bg-amber-600 text-white text-xs font-bold rounded-full">
                    {leaves.filter(l => l.status === "În așteptare").length}
                  </span>
                )}
              </button>

              <button
                className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-3 ${
                  activeTab === "aprobate" && !calendarView && !hoursStatsView
                    ? "bg-emerald-100 text-emerald-700 shadow-sm border-l-4 border-emerald-600"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                onClick={() => {
                  setCalendarView(false);
                  setHoursStatsView(false);
                  setActiveTab("aprobate");
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Cereri aprobate
              </button>

              <button
                className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-3 ${
                  activeTab === "respinse" && !calendarView && !hoursStatsView
                    ? "bg-red-100 text-red-700 shadow-sm border-l-4 border-red-600"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                onClick={() => {
                  setCalendarView(false);
                  setHoursStatsView(false);
                  setActiveTab("respinse");
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Cereri respinse
              </button>

              <button
                className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-3 ${
                  activeTab === "toate" && !calendarView && !hoursStatsView
                    ? "bg-emerald-100 text-emerald-700 shadow-sm border-l-4 border-emerald-600"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                onClick={() => {
                  setCalendarView(false);
                  setHoursStatsView(false);
                  setActiveTab("toate");
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Istoric cereri
              </button>
            </nav>
          </div>
        </aside>

        {/* MAIN */}
        <main className="flex-1 p-4 overflow-y-auto box-border">
          {calendarView ? (
            <WorkplaceCalendar leaves={leaves.filter(l => l.status === "Aprobată")} />
          ) : hoursStatsView ? (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">
                  Statistici Ore Lucrate
                </h2>
                
                {/* Filtre - toate pe același rând */}
                <div className="flex flex-wrap items-end gap-4 mb-4">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Farmacie
                    </label>
                    <select
                      value={selectedWorkplaceStats}
                      onChange={(e) => setSelectedWorkplaceStats(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value="all">Toate farmaciile</option>
                      {workplaces.map((wp) => (
                        <option key={wp._id} value={wp._id}>
                          {wp.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Lună
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={selectedMonthStats ? selectedMonthStats.split("-")[1] : ""}
                        onChange={(e) => {
                          const year = selectedMonthStats ? selectedMonthStats.split("-")[0] : new Date().getFullYear();
                          const month = e.target.value;
                          setSelectedMonthStats(`${year}-${month}`);
                        }}
                        className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                        value={selectedMonthStats ? selectedMonthStats.split("-")[0] : new Date().getFullYear()}
                        onChange={(e) => {
                          const month = selectedMonthStats ? selectedMonthStats.split("-")[1] : String(new Date().getMonth() + 1).padStart(2, "0");
                          const year = e.target.value;
                          setSelectedMonthStats(`${year}-${month}`);
                        }}
                        className="w-24 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                  
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Caută angajat sau farmacie
                    </label>
                    <input
                      type="text"
                      placeholder="Introdu numele angajatului sau farmaciei..."
                      value={searchEmployeeStats}
                      onChange={(e) => setSearchEmployeeStats(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                {loadingStats ? (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mb-4"></div>
                    <p className="text-slate-500 text-sm">Se încarcă statisticile...</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Card-uri KPI */}
                    {(() => {
                      // Calculează statistici agregate
                      const employeeStats = calculateEmployeeStats();
                      
                      let filteredStats = employeeStats;
                      if (selectedWorkplaceStats !== "all") {
                        filteredStats = filteredStats.filter(
                          (stat) => stat.workplaceId === selectedWorkplaceStats
                        );
                      }

                      const totalEmployees = filteredStats.length;
                      const employeesWithOvertime = filteredStats.filter(
                        (s) => s.workedHours > s.targetHours
                      ).length;

                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs text-blue-600 font-medium mb-1">Total Angajați</p>
                                <p className="text-2xl font-bold text-blue-900">{totalEmployees}</p>
                              </div>
                              <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                              </div>
                            </div>
                          </div>

                          <div 
                            className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-4 cursor-pointer hover:shadow-md transition-all duration-200"
                            onClick={() => setShowOvertime(!showOvertime)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs text-emerald-600 font-medium mb-1">Au făcut ore suplimentare</p>
                                <p className="text-2xl font-bold text-emerald-900">{employeesWithOvertime}</p>
                                <p className="text-xs text-emerald-600 mt-1">
                                  {showOvertime ? "Click pentru a ascunde" : "Click pentru a vedea"}
                                </p>
                              </div>
                              <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Angajați cu ore suplimentare - se deschide când dai click pe card */}
                    {showOvertime && (() => {
                      const employeeStats = calculateEmployeeStats();
                      
                      let filteredStats = employeeStats;
                      if (selectedWorkplaceStats !== "all") {
                        filteredStats = filteredStats.filter(
                          (stat) => stat.workplaceId === selectedWorkplaceStats
                        );
                      }

                      // Doar cei care au lucrat PESTE target-ul lor
                      const withOvertime = filteredStats
                        .filter((s) => s.workedHours > s.targetHours)
                        .sort((a, b) => {
                          const aOvertime = a.workedHours - a.targetHours;
                          const bOvertime = b.workedHours - b.targetHours;
                          return bOvertime - aOvertime; // Sortare descrescătoare după ore suplimentare
                        });

                      if (withOvertime.length === 0) {
                        return (
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                            <p className="text-sm text-slate-500 text-center">
                              Nu există angajați cu ore suplimentare în această perioadă.
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div>
                          <h3 className="text-md font-semibold text-slate-800 mb-3 flex items-center gap-2">
                            <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Angajați cu ore suplimentare
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {withOvertime.map((stat) => {
                              const workedHoursRounded = Math.round(stat.workedHours * 10) / 10;
                              const overtimeHours = workedHoursRounded - stat.targetHours;
                              
                              return (
                                <div
                                  key={stat.employeeId}
                                  className="bg-emerald-50 border border-emerald-200 rounded-lg p-3"
                                >
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-semibold text-xs">
                                      {stat.employeeName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-slate-900 text-sm truncate">
                                        {stat.employeeName}
                                      </p>
                                      <p className="text-xs text-slate-500">{stat.workplaceName}</p>
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                      <span className="text-slate-600">Target:</span>
                                      <span className="font-semibold text-slate-700">{stat.targetHours}h</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                      <span className="text-slate-600">Lucrate:</span>
                                      <span className="font-semibold text-emerald-700">{workedHoursRounded.toFixed(1)}h</span>
                                    </div>
                                    <div className="pt-1 border-t border-emerald-200">
                                      <div className="flex justify-between items-center">
                                        <span className="text-xs font-medium text-emerald-700">Ore suplimentare:</span>
                                        <span className="text-sm font-bold text-emerald-800">+{overtimeHours.toFixed(1)}h</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Detalii per angajat - doar când există căutare activă */}
                    {(() => {
                      // Nu afișa nimic dacă nu există căutare activă (nici farmacie selectată, nici text în căutare)
                      if (!searchEmployeeStats && selectedWorkplaceStats === "all") {
                        return (
                          <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
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
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                              />
                            </svg>
                            <p className="text-sm text-slate-500">
                              Selectează o farmacie sau caută un angajat pentru a vedea statisticile.
                            </p>
                          </div>
                        );
                      }

                      // ✅ Optimizare: timesheets conține deja statisticile agregate din backend
                      // Calculează statistici per angajat
                      const employeeStats = calculateEmployeeStats();

                      // Filtrare pe farmacie
                      let filteredStats = employeeStats;
                      if (selectedWorkplaceStats !== "all") {
                        filteredStats = filteredStats.filter(
                          (stat) => stat.workplaceId === selectedWorkplaceStats
                        );
                      }

                      // Filtrare pe căutare (nume angajat sau farmacie)
                      if (searchEmployeeStats) {
                        const searchLower = searchEmployeeStats.toLowerCase();
                        filteredStats = filteredStats.filter((stat) => {
                          const nameMatch = stat.employeeName.toLowerCase().includes(searchLower);
                          const workplaceMatch = stat.workplaceName.toLowerCase().includes(searchLower);
                          return nameMatch || workplaceMatch;
                        });
                      }

                      if (filteredStats.length === 0) {
                        return (
                          <div className="text-center py-8 bg-slate-50 rounded-lg border border-slate-200">
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
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                              />
                            </svg>
                            <p className="text-sm text-slate-500">
                              Nu s-au găsit rezultate pentru căutarea ta.
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div>
                          <h3 className="text-md font-semibold text-slate-800 mb-3">
                            Rezultate
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredStats.map((stat) => {
                              const workedHoursRounded = Math.round(stat.workedHours * 10) / 10;
                              const remainingHours = Math.max(0, stat.targetHours - workedHoursRounded);
                              const percentage = stat.targetHours > 0 
                                ? Math.round((workedHoursRounded / stat.targetHours) * 100) 
                                : 0;
                              
                              return (
                                <div
                                  key={stat.employeeId}
                                  className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-all duration-200 hover:border-emerald-300"
                                >
                                  <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                                      {stat.employeeName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-semibold text-slate-900 text-sm truncate">
                                        {stat.employeeName}
                                      </h4>
                                      <p className="text-xs text-slate-500 truncate">
                                        {stat.workplaceName}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <div className="flex justify-between items-center text-sm">
                                      <span className="text-slate-600">Target:</span>
                                      <span className="font-semibold text-slate-900">{stat.targetHours}h</span>
                                    </div>

                                    <div className="flex justify-between items-center text-sm">
                                      <span className="text-slate-600">Lucrate:</span>
                                      <span className={`font-semibold ${
                                        workedHoursRounded >= stat.targetHours
                                          ? "text-emerald-600"
                                          : workedHoursRounded >= stat.targetHours * 0.8
                                          ? "text-amber-600"
                                          : "text-red-600"
                                      }`}>
                                        {workedHoursRounded.toFixed(1)}h
                                      </span>
                                    </div>

                                    <div className="flex justify-between items-center text-sm">
                                      <span className="text-slate-600">Rămase:</span>
                                      <span className={`font-semibold ${
                                        remainingHours === 0
                                          ? "text-emerald-600"
                                          : remainingHours <= stat.targetHours * 0.2
                                          ? "text-amber-600"
                                          : "text-red-600"
                                      }`}>
                                        {remainingHours.toFixed(1)}h
                                      </span>
                                    </div>

                                    <div className="pt-2 border-t border-slate-200">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs text-slate-600">Progres</span>
                                        <span className="text-xs font-semibold text-slate-700">{percentage}%</span>
                                      </div>
                                      <div className="w-full bg-slate-200 rounded-full h-2">
                                        <div
                                          className="h-2 rounded-full transition-all bg-emerald-500"
                                          style={{ width: `${Math.min(percentage, 100)}%` }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Rezumat per farmacie - doar numărul de angajați (mereu vizibil când "Toate farmaciile" este selectat) */}
                    {selectedWorkplaceStats === "all" && (
                      <div>
                        <h3 className="text-md font-semibold text-slate-800 mb-3">
                          Rezumat per farmacie
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {workplaces.map((wp) => {
                            const wpEmployees = employees.filter((emp) => {
                              const wpId = typeof emp.workplaceId === 'string' 
                                ? emp.workplaceId 
                                : String((emp.workplaceId as any)?._id || emp.workplaceId || '');
                              return wpId === String(wp._id);
                            });
                            
                            return (
                              <div
                                key={wp._id}
                                onClick={() => {
                                  setSelectedWorkplaceForModal(wp);
                                  setShowWorkplaceModal(true);
                                }}
                                className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                              >
                                <h4 className="font-semibold text-slate-900 mb-3">{wp.name}</h4>
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-600 text-sm">Angajați:</span>
                                  <span className="font-semibold text-slate-900 text-lg">
                                    {wpEmployees.length}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : filteredLeaves.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <svg
                className="mx-auto h-12 w-12 text-slate-400"
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
              <p className="mt-4 text-sm text-slate-500">Nu există cereri de concediu.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Căutare după nume angajat */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Caută concedii după nume angajat
                </label>
                <input
                  type="text"
                  placeholder="Introdu numele angajatului..."
                  value={searchEmployee}
                  onChange={(e) => setSearchEmployee(e.target.value)}
                  className="w-full max-w-md border border-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                />
                {searchEmployee && (
                  <p className="mt-2 text-xs text-slate-500">
                    Afișează toate concediile pentru: <span className="font-medium text-slate-700">{searchEmployee}</span>
                  </p>
                )}
              </div>

              <div className="grid gap-4">
                {filteredLeaves.map((req) => {
                // Extrage numele angajatului
                let employeeName = "—";
                if (req.name) {
                  employeeName = req.name;
                } else if (typeof req.employeeId === 'object' && req.employeeId && 'name' in req.employeeId) {
                  employeeName = String((req.employeeId as any).name || "—");
                }
                
                // Extrage numele farmaciei
                let workplaceName = "—";
                if (typeof req.workplaceId === 'object' && req.workplaceId && 'name' in req.workplaceId) {
                  workplaceName = String((req.workplaceId as any).name || "—");
                } else if (typeof req.workplaceId === 'string') {
                  const wp = workplaces.find(w => w._id === req.workplaceId);
                  workplaceName = wp?.name || "—";
                }

                return (
                  <div
                    key={req._id}
                    className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 hover:border-slate-300"
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Left side - Info */}
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
                              {formatDate(req.startDate)} – {formatDate(req.endDate)}
                            </span>
                            {typeof req.days === "number" && (
                              <span className="text-slate-400">• {req.days} zile</span>
                            )}
                          </div>

                          {req.type && (
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
                              <span className="capitalize">{req.type}</span>
                            </div>
                          )}

                          {req.reason && (
                            <p className="text-sm text-slate-600 mt-2 line-clamp-2">
                              {req.reason}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right side - Status & Actions */}
                      <div className="flex flex-col items-end gap-3">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                            req.status
                          )}`}
                        >
                          {req.status}
                        </span>

                        {/* Butoane pentru aprobare/respingere - doar pentru cererile în așteptare */}
                        {req.status === "În așteptare" && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => approveLeave(req._id)}
                              className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Aprobă
                            </button>
                            <button
                              onClick={() => rejectLeave(req._id)}
                              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Respinge
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ✅ Modal pentru angajații unei farmacii */}
      {showWorkplaceModal && selectedWorkplaceForModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                {selectedWorkplaceForModal.name}
              </h2>
              <button
                onClick={() => {
                  setShowWorkplaceModal(false);
                  setSelectedWorkplaceForModal(null);
                }}
                className="text-white hover:text-slate-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {(() => {
                // Filtrează angajații pentru farmacia selectată
                const wpEmployees = employees.filter((emp) => {
                  const wpId = typeof emp.workplaceId === 'string' 
                    ? emp.workplaceId 
                    : String((emp.workplaceId as any)?._id || emp.workplaceId || '');
                  return wpId === String(selectedWorkplaceForModal._id);
                });

                if (wpEmployees.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <p className="text-slate-500">Nu există angajați pentru această farmacie.</p>
                    </div>
                  );
                }

                const today = new Date();
                today.setHours(0, 0, 0, 0);

                return (
                  <div className="space-y-3">
                    {wpEmployees
                      .sort((a, b) => a.name.localeCompare(b.name, "ro"))
                      .map((emp) => {
                        // Găsește concediile active și viitoare pentru acest angajat
                        const relevantLeaves: LeaveWithActive[] = leaves.filter((leave) => {
                          // Extrage employeeId din leave (poate fi string sau obiect)
                          const leaveEmployeeId = typeof leave.employeeId === 'string' 
                            ? leave.employeeId 
                            : String((leave.employeeId as any)?._id || leave.employeeId || '');
                          const empId = String(emp._id);
                          if (leaveEmployeeId !== empId) return false;
                          if (leave.status !== "Aprobată") return false;
                          
                          const startDate = new Date(leave.startDate);
                          const endDate = new Date(leave.endDate);
                          startDate.setHours(0, 0, 0, 0);
                          endDate.setHours(23, 59, 59, 999);
                          
                          // Concediu activ (astăzi este în interval) sau viitor (data de început este în viitor)
                          const isActive = isDateInRange(today, leave.startDate, leave.endDate);
                          const isFuture = startDate > today;
                          return isActive || isFuture;
                        }).map((leave) => {
                          const startDate = new Date(leave.startDate);
                          startDate.setHours(0, 0, 0, 0);
                          const isActive = isDateInRange(today, leave.startDate, leave.endDate);
                          return { ...leave, isActive };
                        });

                        return (
                          <div
                            key={emp._id}
                            className="bg-slate-50 border border-slate-200 rounded-lg p-4 hover:bg-slate-100 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-semibold text-sm">
                                  {emp.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-slate-900 truncate">
                                    {emp.name}
                                  </h3>
                                  {emp.function && (
                                    <p className="text-xs text-slate-500 truncate">
                                      {emp.function}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {relevantLeaves.length > 0 ? (
                                  <div className="flex flex-col items-end gap-1">
                                    {relevantLeaves.map((leave, idx) => (
                                      <div key={idx} className="flex flex-col items-end gap-1">
                                        <span className={`px-3 py-1 text-xs font-medium rounded-full border ${
                                          leave.isActive
                                            ? "bg-amber-100 text-amber-800 border-amber-200"
                                            : "bg-blue-100 text-blue-800 border-blue-200"
                                        }`}>
                                          {leave.isActive ? "Concediu" : "Urmează concediu"}
                                        </span>
                                        <span className="text-xs text-slate-600">
                                          {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminManagerDashboard;

