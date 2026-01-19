// import React, { useEffect, useMemo, useState } from "react";
// import FullCalendar from "@fullcalendar/react";
// import dayGridPlugin from "@fullcalendar/daygrid";
// import timeGridPlugin from "@fullcalendar/timegrid";
// import listPlugin from "@fullcalendar/list";
// import interactionPlugin from "@fullcalendar/interaction";
// import WorkplaceCalendar from "./WorkplaceCalendar";

// import {
//   parseISO,
//   eachDayOfInterval,
//   isWithinInterval,
//   format,
// } from "date-fns";
// import ro from "date-fns/locale/ro";

// const API = "http://localhost:5000";

// const AdminManagerDashboard = () => {
//   const [activeTab, setActiveTab] = useState("toate");
//   const [calendarView, setCalendarView] = useState(false);
//   const [leaves, setLeaves] = useState([]);

//   const [selectedDate, setSelectedDate] = useState(null);
//   const [selectedDayLeaves, setSelectedDayLeaves] = useState([]);
//   const [showPopup, setShowPopup] = useState(false);

//   // LOAD CERERI
//   useEffect(() => {
//     const loadLeaves = async () => {
//       try {
//         const url =
//           user.role === "superadmin"
//             ? `${API}/api/leaves/all`
//             : `${API}/api/leaves/by-workplace/${user.workplaceId}`;

//         const res = await fetch(url, {
//           credentials: "include", // OBLIGATORIU pentru JWT din cookie
//         });

//         const data = await res.json();
//         setLeaves(Array.isArray(data) ? data : []);
//       } catch (error) {
//         console.error("❌ Eroare la încărcarea concediilor:", error);
//         setLeaves([]);
//       }
//     };

//     if (user?.role) {
//       loadLeaves();
//     }
//   }, [user]);

//   // UPDATE STATUS
//   const updateStatus = async (id, status) => {
//     await fetch(`${API}/api/leaves/update/${id}`, {
//       method: "PUT",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ status }),
//     });
//     const updated = await fetch(`${API}/api/leaves/all`);
//     setLeaves(await updated.json());
//   };

//   // LISTA FILTRATĂ
//   const filteredLeaves = useMemo(
//     () =>
//       leaves.filter((r) => {
//         if (activeTab === "toate") return true;
//         if (activeTab === "aprobate") return r.status === "Aprobată";
//         if (activeTab === "respinse") return r.status === "Respinsă";
//         if (activeTab === "in_asteptare") return r.status === "În așteptare";
//         return true;
//       }),
//     [leaves, activeTab]
//   );

//   // EVENIMENTE pentru FullCalendar (nu ne mai bazăm pe ele pentru +N)
//   const events = useMemo(() => {
//     const all = [];

//     leaves.forEach((l) => {
//       const start = parseISO(l.startDate);
//       const end = parseISO(l.endDate);
//       const days = eachDayOfInterval({ start, end });

//       days.forEach((d) => {
//         all.push({
//           id: `${l._id}-${d.toISOString().slice(0, 10)}`,
//           title: l.employeeId?.name || "Anonim",
//           start: d,
//           allDay: true,
//           extendedProps: { leave: l },
//         });
//       });
//     });

//     return all;
//   }, [leaves]);

//   // MAP: yyyy-MM-dd -> listă de concedii (unice) în ziua respectivă
//   const leavesByDay = useMemo(() => {
//     const map = {};

//     leaves.forEach((l) => {
//       const start = parseISO(l.startDate);
//       const end = parseISO(l.endDate);
//       const days = eachDayOfInterval({ start, end });

//       days.forEach((d) => {
//         const key = format(d, "yyyy-MM-dd");
//         if (!map[key]) map[key] = [];

//         // deduplicare după employeeId + interval
//         const exists = map[key].some(
//           (item) =>
//             item.employeeId?._id === l.employeeId?._id &&
//             item.startDate === l.startDate &&
//             item.endDate === l.endDate
//         );
//         if (!exists) map[key].push(l);
//       });
//     });

//     return map;
//   }, [leaves]);

//   // deschide popup pentru o anumită dată (folosește leavesByDay)
//   const openPopupForDate = (date) => {
//     setSelectedDate(date);
//     const key = format(date, "yyyy-MM-dd");
//     const matches = leavesByDay[key] || [];
//     setSelectedDayLeaves(matches);
//     setShowPopup(true);
//   };

//   // SELECT PE ZI (click pe casetă)
//   const handleDaySelect = (info) => {
//     openPopupForDate(info.start);
//   };

//   // CLICK PE EVENIMENT (text)
//   const handleEventClick = (clickInfo) => {
//     openPopupForDate(clickInfo.event.start);
//   };

//   // conținut custom pentru fiecare celulă de zi: max 2 nume + „+N”
//   const renderDayCell = (arg) => {
//     const date = arg.date;
//     const key = format(date, "yyyy-MM-dd");
//     const dayLeaves = leavesByDay[key] || [];

//     // păstrăm numărul zilei pus de FullCalendar
//     const dayNumberEl = arg.el.querySelector(".fc-daygrid-day-number");

//     // ștergem TOT conținutul din celulă și îl reconstruim
//     arg.el.innerHTML = "";

//     const wrapper = document.createElement("div");
//     wrapper.className = "flex flex-col h-full";

//     // rândul cu ziua (sus, aliniat ca înainte)
//     if (dayNumberEl) {
//       const dayHeader = document.createElement("div");
//       dayHeader.className = "flex justify-end px-1 pt-1 text-xs";
//       dayHeader.appendChild(dayNumberEl);
//       wrapper.appendChild(dayHeader);
//     }

//     // conținutul cu numele începe imediat sub număr
//     if (dayLeaves.length > 0) {
//       const maxToShow = 2;
//       const first = dayLeaves.slice(0, maxToShow);
//       const remaining = dayLeaves.length - first.length;

//       const list = document.createElement("div");
//       list.className = "mt-1 flex flex-col gap-0.5";

//       first.forEach((l) => {
//         const div = document.createElement("div");
//         div.className =
//           "text-[10px] leading-tight px-1 py-0.5 rounded bg-emerald-600 text-white truncate cursor-pointer";
//         div.innerText = l.employeeId?.name || "Anonim";
//         list.appendChild(div);
//       });

//       if (remaining > 0) {
//         const more = document.createElement("div");
//         more.className =
//           "text-[10px] leading-tight px-1 py-0.5 rounded bg-emerald-100 text-emerald-800 cursor-pointer";
//         more.innerText = `+${remaining}`;
//         list.appendChild(more);
//       }

//       wrapper.appendChild(list);
//     }

//     arg.el.appendChild(wrapper);
//   };

//   const getTabClasses = (tab) =>
//     `w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
//       activeTab === tab
//         ? "bg-slate-900 text-white"
//         : "text-slate-700 hover:bg-slate-100"
//     }`;

//   return (
//     <div className="min-h-screen bg-slate-50 flex justify-center p-6">
//       <div className="w-full max-w-6xl bg-white border border-slate-200 shadow-sm rounded-2xl flex overflow-hidden">
//         {/* SIDEBAR */}
//         <aside className="w-60 border-r border-slate-200 bg-slate-50 px-4 py-6 flex flex-col gap-6">
//           <img
//             src="/logo.svg"
//             alt="Remedium Logo"
//             className="w-30 mx-auto mb-4 opacity-90"
//           />

//           <div>
//             <h2 className="text-sm font-semibold text-slate-900 mb-1">
//               Admin Manager
//             </h2>
//             <p className="text-xs text-slate-500">
//               Gestionează toate concediile
//             </p>
//           </div>

//           <button
//             className="w-full px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-blue-700"
//             onClick={() => setCalendarView(true)}
//           >
//             Calendar concedii
//           </button>

//           <nav className="space-y-2 pt-2 border-t border-slate-200">
//             <button
//               className={getTabClasses("toate")}
//               onClick={() => {
//                 setCalendarView(false);
//                 setActiveTab("toate");
//               }}
//             >
//               Toate cererile
//             </button>
//             <button
//               className={getTabClasses("in_asteptare")}
//               onClick={() => {
//                 setCalendarView(false);
//                 setActiveTab("in_asteptare");
//               }}
//             >
//               În așteptare
//             </button>
//             <button
//               className={getTabClasses("aprobate")}
//               onClick={() => {
//                 setCalendarView(false);
//                 setActiveTab("aprobate");
//               }}
//             >
//               Aprobate
//             </button>
//             <button
//               className={getTabClasses("respinse")}
//               onClick={() => {
//                 setCalendarView(false);
//                 setActiveTab("respinse");
//               }}
//             >
//               Respinse
//             </button>
//           </nav>
//         </aside>

//         {/* MAIN */}
//         <main className="flex-1 p-8">
//           {calendarView ? (
//             <WorkplaceCalendar leaves={leaves} />
//           ) : (
//             <section>
//               {filteredLeaves.map((req) => (
//                 <div
//                   key={req._id}
//                   className="border p-4 mb-3 rounded flex justify-between"
//                 >
//                   <div>
//                     <p>
//                       <b>{req.employeeId?.name}</b> – {req.workplaceId?.name}
//                     </p>
//                     <p>
//                       Perioadă:{" "}
//                       {format(parseISO(req.startDate), "dd.MM.yyyy", {
//                         locale: ro,
//                       })}{" "}
//                       –{" "}
//                       {format(parseISO(req.endDate), "dd.MM.yyyy", {
//                         locale: ro,
//                       })}
//                     </p>
//                     <p>{req.reason}</p>
//                     <p>Status: {req.status}</p>
//                   </div>

//                   {req.status === "În așteptare" && (
//                     <div className="flex gap-2">
//                       <button
//                         className="bg-green-600 text-white px-3 py-1 rounded"
//                         onClick={() => updateStatus(req._id, "Aprobată")}
//                       >
//                         Aprobă
//                       </button>
//                       <button
//                         className="bg-red-600 text-white px-3 py-1 rounded"
//                         onClick={() => updateStatus(req._id, "Respinsă")}
//                       >
//                         Respinge
//                       </button>
//                     </div>
//                   )}
//                 </div>
//               ))}
//             </section>
//           )}
//         </main>
//       </div>
//     </div>
//   );
// };

// export default AdminManagerDashboard;

import React, { useEffect, useMemo, useState } from "react";
import WorkplaceCalendar from "./WorkplaceCalendar";
import { parseISO, eachDayOfInterval, format } from "date-fns";
import ro from "date-fns/locale/ro";

// Folosește variabile de mediu pentru URL-ul backend-ului
const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const AdminManagerDashboard = () => {
  const [activeTab, setActiveTab] = useState("toate");
  const [calendarView, setCalendarView] = useState(false);
  const [hoursStatsView, setHoursStatsView] = useState(false);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtru simplu - doar căutare după nume
  const [searchEmployee, setSearchEmployee] = useState("");

  // ✅ Obține user-ul din localStorage (o singură dată la mount)
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // ✅ Statistici ore
  const [workplaces, setWorkplaces] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [selectedWorkplaceStats, setSelectedWorkplaceStats] = useState("all");
  const [selectedMonthStats, setSelectedMonthStats] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [loadingStats, setLoadingStats] = useState(false);
  const [searchEmployeeStats, setSearchEmployeeStats] = useState("");
  const [showOvertime, setShowOvertime] = useState(false);
  
  // ✅ Notificări pentru cererile noi aprobate
  const [recentApprovedLeaves, setRecentApprovedLeaves] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showNewLeavesMenu, setShowNewLeavesMenu] = useState(false);
  
  // ✅ Tracking pentru cererile văzute (folosind localStorage)
  const [viewedLeaveIds, setViewedLeaveIds] = useState(() => {
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
        const res = await fetch(`${API}/api/users/email-notifications`, {
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
      let res = await fetch(`${API}/api/leaves/all`, {
        credentials: "include",
      });

      // Dacă nu e superadmin → fallback pe farmacie
      if (res.status === 403 && user?.workplaceId) {
        res = await fetch(
          `${API}/api/leaves/by-workplace/${user.workplaceId}`,
          { credentials: "include" }
        );
      }

      const data = await res.json();
      setLeaves(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("❌ Eroare la încărcarea concediilor:", err);
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
  
  // ✅ Detectează cererile noi aprobate pentru notificări
  useEffect(() => {
    if (leaves.length === 0) return;
    
    // Găsește cererile aprobate din ultimele 24 de ore
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recent = leaves.filter(leave => {
      if (leave.status !== "Aprobată") return false;
      const createdAt = new Date(leave.createdAt || leave.updatedAt);
      return createdAt >= yesterday;
    });
    
    setRecentApprovedLeaves(recent);
  }, [leaves]);
  
  // ✅ Salvează cererile văzute în localStorage
  const markLeavesAsViewed = (leaveIds) => {
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
        const res = await fetch(`${API}/api/workplaces/all`, {
          credentials: "include",
        });
        const data = await res.json();
        setWorkplaces(Array.isArray(data) ? data : []);
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
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      
      const from = `${year}-${String(month).padStart(2, "0")}-01`;
      const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;

      // Încarcă toți angajații
      const employeesRes = await fetch(`${API}/api/users/employees`, {
        credentials: "include",
      });
      const employeesData = await employeesRes.json();
      setEmployees(Array.isArray(employeesData) ? employeesData : []);

      // ✅ Optimizare: folosim endpoint-ul nou pentru statistici agregate
      // Acesta calculează statisticile direct în MongoDB, nu returnează toate timesheet-urile
      const statsUrl = selectedWorkplaceStats === "all"
        ? `${API}/api/pontaj/stats?from=${from}&to=${to}`
        : `${API}/api/pontaj/stats?from=${from}&to=${to}&workplaceId=${selectedWorkplaceStats}`;
      
      const statsRes = await fetch(statsUrl, {
        credentials: "include",
      });
      const statsData = await statsRes.json();
      
      // Transformă statisticile în format compatibil cu codul existent
      // (pentru a nu trebui să modificăm toată logica de afișare)
      const transformedStats = Array.isArray(statsData) ? statsData.map(stat => ({
        employeeId: stat.employeeId,
        employeeName: stat.employeeName,
        workplaceId: stat.workplaceId,
        totalHours: stat.totalHours || 0,
        totalMinutes: stat.totalMinutes || 0,
        visitorHours: stat.visitorHours || 0,
      })) : [];
      
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

  // ✅ UPDATE STATUS
  const updateStatus = async (id, status) => {
    try {
      await fetch(`${API}/api/leaves/update/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        credentials: "include",
      });

      // Reîncarcă lista după update pentru a actualiza calendarul
      await loadLeaves();
    } catch (err) {
      console.error("❌ Eroare la actualizarea statusului:", err);
    }
  };


  // ✅ FILTRARE CERERI
  const filteredLeaves = useMemo(
    () => {
      // Afișăm toate cererile (fără filtrare pe status)
      let filtered = leaves;

      // Filtrare pe angajat (căutare după nume)
      if (searchEmployee) {
        const searchLower = searchEmployee.toLowerCase();
        filtered = filtered.filter((r) => {
          const empName = (r.employeeId?.name || r.name || "").toLowerCase();
          return empName.includes(searchLower);
        });
      }

      // Sortare după data creării - cele mai recente primele
      filtered = filtered.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.updatedAt || 0);
        const dateB = new Date(b.createdAt || b.updatedAt || 0);
        return dateB - dateA; // Descrescător - cele mai recente primele
      });

      return filtered;
    },
    [leaves, searchEmployee]
  );

  // ✅ ZILE PE INTERVAL
  const leavesByDay = useMemo(() => {
    const map = {};
    leaves.forEach((l) => {
      const start = parseISO(l.startDate);
      const end = parseISO(l.endDate);
      const days = eachDayOfInterval({ start, end });

      days.forEach((d) => {
        const key = format(d, "yyyy-MM-dd");
        if (!map[key]) map[key] = [];
        map[key].push(l);
      });
    });
    return map;
  }, [leaves]);

  if (loading) {
    return <div className="p-10 text-center">Se încarcă concediile…</div>;
  }

  const getStatusColor = (status) => {
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

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString("ro-RO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
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
                        const res = await fetch(`${API}/api/users/email-notifications`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({ emailNotificationsEnabled: newValue }),
                        });
                        
                        if (res.ok) {
                          const data = await res.json();
                          // ✅ Reîncarcă preferința din backend pentru a fi sigur că e sincronizată
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
              {/* ✅ Cereri noi concediu */}
              {unseenNewLeaves.length > 0 && (
                <button
                  className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-3 ${
                    showNewLeavesMenu && !calendarView && !hoursStatsView
                      ? "bg-emerald-100 text-emerald-700 shadow-sm border-l-4 border-emerald-600"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                  onClick={() => {
                    setCalendarView(false);
                    setHoursStatsView(false);
                    setShowNewLeavesMenu(!showNewLeavesMenu);
                    // Marchează cererile ca văzute când se deschide meniul
                    if (!showNewLeavesMenu) {
                      const leaveIds = unseenNewLeaves.map(leave => String(leave._id));
                      markLeavesAsViewed(leaveIds);
                    }
                  }}
                >
                  <div className="flex items-center gap-2 flex-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    <span className="flex-1 text-left">Cereri noi concediu</span>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-600 text-white text-xs font-bold rounded-full">
                    {unseenNewLeaves.length}
                  </span>
                </button>
              )}
              
              <button
                className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-3 ${
                  activeTab === "toate" && !calendarView && !hoursStatsView && !showNewLeavesMenu
                    ? "bg-emerald-100 text-emerald-700 shadow-sm border-l-4 border-emerald-600"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                onClick={() => {
                  setCalendarView(false);
                  setHoursStatsView(false);
                  setShowNewLeavesMenu(false);
                  setActiveTab("toate");
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Toate cererile
              </button>
            </nav>
          </div>
        </aside>

        {/* MAIN */}
        <main className="flex-1 p-4 overflow-y-auto box-border">
          {showNewLeavesMenu ? (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    Cereri noi concediu
                  </h2>
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
                    {recentApprovedLeaves.length} {recentApprovedLeaves.length === 1 ? 'cerere' : 'cereri'}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mb-4">
                  Cererile de concediu aprobate în ultimele 24 de ore
                </p>
              </div>

              {recentApprovedLeaves.length === 0 ? (
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
                  <p className="mt-4 text-sm text-slate-500">Nu există cereri noi de concediu.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {recentApprovedLeaves.map((req) => {
                    const employeeName = req.employeeId?.name || req.name || "—";
                    const workplaceName = req.workplaceId?.name || "—";

                    return (
                      <div
                        key={req._id}
                        className="bg-white border border-emerald-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 hover:border-emerald-300"
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

                          {/* Right side - Status */}
                          <div className="flex flex-col items-end gap-3">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                                req.status
                              )}`}
                            >
                              {req.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : calendarView ? (
            <WorkplaceCalendar leaves={leaves} />
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
                      const employeeStats = {};
                      
                      employees.forEach((emp) => {
                        const empId = String(emp._id);
                        const targetHours = emp.monthlyTargetHours || 160;
                        
                        employeeStats[empId] = {
                          employeeId: empId,
                          employeeName: emp.name,
                          workplaceId: String(emp.workplaceId?._id || emp.workplaceId),
                          workplaceName: emp.workplaceId?.name || "—",
                          targetHours,
                          workedHours: 0,
                        };
                      });

                      timesheets.forEach((ts) => {
                        const empId = String(ts.employeeId?._id || ts.employeeId);
                        if (employeeStats[empId]) {
                          employeeStats[empId].workedHours += ts.totalHours || 0;
                        }
                      });

                      let filteredStats = Object.values(employeeStats);
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
                      const employeeStats = {};
                      
                      employees.forEach((emp) => {
                        const empId = String(emp._id);
                        const targetHours = emp.monthlyTargetHours || 160;
                        
                        employeeStats[empId] = {
                          employeeId: empId,
                          employeeName: emp.name,
                          workplaceId: String(emp.workplaceId?._id || emp.workplaceId),
                          workplaceName: emp.workplaceId?.name || "—",
                          targetHours,
                          workedHours: 0,
                        };
                      });

                      timesheets.forEach((ts) => {
                        const empId = String(ts.employeeId?._id || ts.employeeId);
                        if (employeeStats[empId]) {
                          employeeStats[empId].workedHours += ts.totalHours || 0;
                        }
                      });

                      let filteredStats = Object.values(employeeStats);
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
                      const employeeStats = {};
                      
                      employees.forEach((emp) => {
                        const empId = String(emp._id);
                        const targetHours = emp.monthlyTargetHours || 160;
                        
                        // Caută statisticile pentru acest angajat în timesheets (care sunt de fapt stats)
                        const stat = timesheets.find(ts => String(ts.employeeId?._id || ts.employeeId) === empId);
                        
                        employeeStats[empId] = {
                          employeeId: empId,
                          employeeName: emp.name,
                          workplaceId: String(emp.workplaceId?._id || emp.workplaceId),
                          workplaceName: emp.workplaceId?.name || "—",
                          targetHours,
                          workedHours: stat ? (stat.totalHours || 0) : 0,
                          workedMinutes: stat ? (stat.totalMinutes || 0) : 0,
                        };
                      });

                      // Filtrare pe farmacie
                      let filteredStats = Object.values(employeeStats);
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
                                          className={`h-2 rounded-full transition-all ${
                                            percentage >= 100
                                              ? "bg-emerald-500"
                                              : percentage >= 80
                                              ? "bg-amber-500"
                                              : "bg-red-500"
                                          }`}
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
                              const wpId = String(emp.workplaceId?._id || emp.workplaceId);
                              return wpId === String(wp._id);
                            });
                            
                            return (
                              <div
                                key={wp._id}
                                className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
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
                const employeeName = req.employeeId?.name || req.name || "—";
                const workplaceName = req.workplaceId?.name || "—";

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

                        {/* Butoanele de aprobare/respingere au fost eliminate - cererile sunt aprobate automat */}
                        {/* Butonul de ștergere a fost eliminat - managerul nu poate șterge cererile */}
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
    </div>
  );
};

export default AdminManagerDashboard;
