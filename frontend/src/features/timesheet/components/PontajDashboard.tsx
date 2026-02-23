import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { AddVisitor } from "../components/AddVisitor";
import { timesheetService } from "../services/timesheetService";
import { employeeService } from "@/shared/services/employeeService";
import { workplaceService } from "@/shared/services/workplaceService";
import { leaveService } from "@/features/leaves/services/leaveService";
import { getUserFromStorage } from "@/features/auth/utils/auth.utils";
import { normalizeTime, calcWorkHours, formatHM, pad2 } from "../utils/time.utils";
import type { Employee } from "@/shared/types/employee.types";
import type { Workplace } from "@/shared/types/workplace.types";
import type { Leave } from "@/features/leaves/types/leave.types";
import type { TimesheetViewerEntry, TimesheetFormData } from "../types/timesheet.types";
import { FetchError } from "@/shared/types/api.types";

// /** =================== CONFIG =================== */
// const DEFAULTS = {
//   startTime: "08:00",
//   endTime: "16:00",
//   status: "necompletat",
// };

// const STATUSES = [
//   { value: "necompletat", label: "Necompletat" },
//   { value: "prezent", label: "Prezent" },
//   { value: "concediu", label: "Concediu" },
//   { value: "liber", label: "Liber" },
//   { value: "medical", label: "Medical" },
// ];

// const pad2 = (n) => String(n).padStart(2, "0");
// const HOURS = Array.from({ length: 24 }, (_, i) => pad2(i));
// const MINUTES = Array.from({ length: 60 }, (_, i) => pad2(i));

// const normalizeTime = (t, fallback = "08:00") => {
//   const s = (t ? String(t) : fallback).slice(0, 5);
//   const [h = "08", m = "00"] = s.split(":");
//   const hh = pad2(Number.isFinite(+h) ? +h : 8);
//   const mm = pad2(Number.isFinite(+m) ? +m : 0);
//   return `${HOURS.includes(hh) ? hh : "08"}:${
//     MINUTES.includes(mm) ? mm : "00"
//   }`;
// };

// const toMinutes = (t) => {
//   const [h, m] = normalizeTime(t).split(":");
//   return Number(h) * 60 + Number(m);
// };

// // ture peste miezul nopții: dacă end <= start -> end + 1440
// const calcWorkMinutes = (start, end) => {
//   const s = toMinutes(start);
//   let e = toMinutes(end);
//   if (e <= s) e += 1440;
//   return Math.max(0, e - s);
// };

// const formatHM = (mins) => `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;

// const statusToLeaveType = (status) =>
//   ({ concediu: "odihna", medical: "medical", liber: "liber" }[status] ?? null);

// const getMonthRange = (yyyyMmDd) => {
//   const [y, m] = yyyyMmDd.split("-").map(Number);
//   const from = `${y}-${pad2(m)}-01`;
//   const lastDay = new Date(y, m, 0).getDate();
//   const to = `${y}-${pad2(m)}-${pad2(lastDay)}`;
//   return { from, to };
// };

// /** =================== UI SMALLS =================== */
// const TimePicker = React.memo(({ value, onChange, disabled }) => {
//   const [h, m] = normalizeTime(value).split(":");
//   const cls = `w-[62px] border rounded-lg px-2 py-2 text-sm ${
//     disabled
//       ? "bg-slate-100 text-slate-400 cursor-not-allowed"
//       : "border-slate-200 bg-white"
//   }`;

//   return (
//     <div className="flex items-center gap-1">
//       <select
//         disabled={disabled}
//         value={h}
//         onChange={(e) => onChange(`${e.target.value}:${m}`)}
//         className={cls}
//       >
//         {HOURS.map((hour) => (
//           <option key={hour} value={hour}>
//             {hour}
//           </option>
//         ))}
//       </select>

//       <select
//         disabled={disabled}
//         value={m}
//         onChange={(e) => onChange(`${h}:${e.target.value}`)}
//         className={cls}
//       >
//         {MINUTES.map((min) => (
//           <option key={min} value={min}>
//             {min}
//           </option>
//         ))}
//       </select>
//     </div>
//   );
// });

// /** =================== MAIN =================== */
// const PontajDashboard = ({ lockedWorkplaceId = "" }) => {
//   /** ============== CURRENT USER (DIN LOCALSTORAGE) ============== */
//   const currentUser = useMemo(() => {
//     try {
//       return JSON.parse(localStorage.getItem("user") || "{}");
//     } catch {
//       return {};
//     }
//   }, []);

//   const isAdmin = currentUser?.role === "admin";
//   const userWorkplaceId = currentUser?.workplaceId || "";

//   // dacă e admin, forțăm workplace-ul din user, indiferent ce vine ca prop
//   const effectiveLockedWorkplaceId = isAdmin
//     ? userWorkplaceId
//     : lockedWorkplaceId;

//   /** ============== STATE ============== */
//   const [workplaces, setWorkplaces] = useState([]);
//   const [selectedWorkplace, setSelectedWorkplace] = useState(
//     effectiveLockedWorkplaceId || ""
//   );

//   const [employees, setEmployees] = useState([]);

//   // ✅ vizitatori (persistenți după refresh, reconstruiți din pontaj)
//   const [visitors, setVisitors] = useState([]);

//   // ✅ toți angajații din toate farmaciile (pentru AddVisitor search)
//   const [globalEmployees, setGlobalEmployees] = useState([]);

//   const [entries, setEntries] = useState({});
//   const [monthWorkedMins, setMonthWorkedMins] = useState({});

//   const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

//   const [loadingW, setLoadingW] = useState(false);
//   const [loadingE, setLoadingE] = useState(false);
//   const [loadingGlobal, setLoadingGlobal] = useState(false);
//   const [saving, setSaving] = useState(false);

//   const [error, setError] = useState("");
//   const [success, setSuccess] = useState("");

//   const isBusy = loadingW || loadingE || loadingGlobal || saving;

//   /** ============== HARD LOCK pt ADMIN ============== */
//   useEffect(() => {
//     if (effectiveLockedWorkplaceId) {
//       setSelectedWorkplace(effectiveLockedWorkplaceId);
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [effectiveLockedWorkplaceId]);

//   /** ============== LOAD GLOBAL EMPLOYEES (PT VIZITATORI) ============== */
//   useEffect(() => {
//     let alive = true;

//     (async () => {
//       try {
//         setLoadingGlobal(true);

//         // ✅ avem deja endpoint /api/users (întoarce și admini) -> filtrăm doar employee
//         const res = await fetch(`${API}/api/users`, { credentials: "include" });
//         const data = await res.json();

//         if (!alive) return;

//         const list = Array.isArray(data) ? data : [];
//         const onlyEmployees = list.filter(
//           (u) => u?.role === "employee" && u?.isActive !== false
//         );

//         setGlobalEmployees(onlyEmployees);
//       } catch (e) {
//         console.error(e);
//         if (alive) setGlobalEmployees([]);
//       } finally {
//         if (alive) setLoadingGlobal(false);
//       }
//     })();

//     return () => {
//       alive = false;
//     };
//   }, []);

//   /** ============== DERIVED ============== */
//   const allPeople = useMemo(
//     () => [...employees, ...visitors],
//     [employees, visitors]
//   );

//   const excludeIds = useMemo(() => {
//     const a = employees.map((e) => e._id);
//     const b = visitors.map((v) => v._id);
//     return [...a, ...b];
//   }, [employees, visitors]);

//   const canSave = useMemo(() => {
//     if (!selectedWorkplace || allPeople.length === 0 || isBusy) return false;
//     return allPeople.some((p) => {
//       const e = entries[p._id];
//       return e?.dirty && e?.status && e.status !== "necompletat";
//     });
//   }, [selectedWorkplace, allPeople, isBusy, entries]);

//   const safeEntry = useCallback(
//     (id) => {
//       const e = entries[id] || {};
//       return {
//         startTime: normalizeTime(e.startTime, DEFAULTS.startTime),
//         endTime: normalizeTime(e.endTime, DEFAULTS.endTime),
//         status: e.status ?? DEFAULTS.status,
//         completed: !!e.completed,
//         pontajId: e.pontajId ?? null,
//         dirty: !!e.dirty,
//         isVisitor: !!e.isVisitor,
//       };
//     },
//     [entries]
//   );

//   const updateEntry = useCallback((id, patch) => {
//     setEntries((prev) => {
//       const current = prev[id] || {};
//       return {
//         ...prev,
//         [id]: {
//           ...DEFAULTS,
//           ...current,
//           ...patch,
//           dirty: true,
//         },
//       };
//     });
//   }, []);

//   /** ============== VISITORS HELPERS ============== */
//   const addVisitor = useCallback(
//     (emp) => {
//       if (!emp?._id) return;

//       // ✅ îl adăugăm în vizitatori (chiar dacă e din alt workplace)
//       setVisitors((prev) => {
//         if (employees.some((e) => e._id === emp._id)) return prev;
//         if (prev.some((v) => v._id === emp._id)) return prev;
//         return [...prev, emp];
//       });

//       // ✅ asigurăm entry
//       setEntries((prev) => {
//         if (prev[emp._id]) return prev;
//         return {
//           ...prev,
//           [emp._id]: {
//             ...DEFAULTS,
//             dirty: false,
//             completed: false,
//             isVisitor: true,
//           },
//         };
//       });
//     },
//     [employees]
//   );

//   const removeVisitor = useCallback((empId) => {
//     setVisitors((prev) => prev.filter((v) => v._id !== empId));
//     setEntries((prev) => {
//       const next = { ...prev };
//       delete next[empId];
//       return next;
//     });
//   }, []);

//   /** ============== LOAD WORKPLACES ============== */
//   useEffect(() => {
//     let alive = true;

//     (async () => {
//       try {
//         setLoadingW(true);
//         const res = await fetch(`${API}/api/workplaces`, {
//           credentials: "include",
//         });
//         const list = await res.json();
//         const arr = Array.isArray(list) ? list : [];
//         if (!alive) return;

//         setWorkplaces(arr);

//         if (!effectiveLockedWorkplaceId && !selectedWorkplace && arr.length) {
//           setSelectedWorkplace(arr[0]._id);
//         }
//       } catch (e) {
//         console.error(e);
//         if (alive) setError("Nu s-au putut încărca farmaciile.");
//       } finally {
//         if (alive) setLoadingW(false);
//       }
//     })();

//     return () => {
//       alive = false;
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [effectiveLockedWorkplaceId]);

//   /** ============== LOAD EMPLOYEES + PONTAJ (ZI + LUNĂ) ============== */
//   useEffect(() => {
//     if (!selectedWorkplace) return;

//     if (
//       effectiveLockedWorkplaceId &&
//       selectedWorkplace !== effectiveLockedWorkplaceId
//     ) {
//       setSelectedWorkplace(effectiveLockedWorkplaceId);
//       return;
//     }

//     let alive = true;

//     // ✅ reset rapid ca să nu mai vezi “1 frame” date vechi
//     setEmployees([]);
//     setVisitors([]);
//     setEntries({});
//     setMonthWorkedMins({});

//     (async () => {
//       try {
//         setLoadingE(true);
//         setError("");
//         setSuccess("");

//         const { from, to } = getMonthRange(date);

//         const [empsRes, monthRes] = await Promise.all([
//           fetch(`${API}/api/users/by-workplace/${selectedWorkplace}`, {
//             credentials: "include",
//           }),
//           fetch(
//             `${API}/api/pontaj/by-workplace/${selectedWorkplace}?from=${from}&to=${to}`,
//             {
//               credentials: "include",
//             }
//           ),
//         ]);

//         const [emps, monthPontaj] = await Promise.all([
//           empsRes.json(),
//           monthRes.json(),
//         ]);

//         if (!empsRes.ok)
//           throw new Error(emps?.error || "Eroare la încărcarea angajaților");
//         if (!monthRes.ok)
//           throw new Error(
//             monthPontaj?.error || "Eroare la încărcarea pontajului"
//           );

//         const employeesList = Array.isArray(emps) ? emps : [];
//         const pontajList = Array.isArray(monthPontaj) ? monthPontaj : [];

//         if (!alive) return;

//         // minute lucrate în lună per employeeId
//         const monthMins = {};
//         pontajList.forEach((p) => {
//           const empId = p.employeeId?._id || p.employeeId;
//           const mins =
//             typeof p.minutesWorked === "number"
//               ? p.minutesWorked
//               : p.startTime && p.endTime
//               ? calcWorkMinutes(p.startTime, p.endTime)
//               : 0;

//           monthMins[empId] = (monthMins[empId] || 0) + (mins || 0);
//         });

//         // ✅ dayMap (pontaj pt ziua selectată)
//         const dayMap = {};
//         pontajList.forEach((p) => {
//           const empId = p.employeeId?._id || p.employeeId;
//           const d = String(p.date || "").slice(0, 10);
//           if (d !== date) return;

//           const status =
//             p.leaveType === "medical"
//               ? "medical"
//               : p.leaveType === "liber"
//               ? "liber"
//               : p.leaveType
//               ? "concediu"
//               : "prezent";

//           dayMap[empId] = {
//             pontajId: p._id || null,
//             startTime: normalizeTime(p.startTime, DEFAULTS.startTime),
//             endTime: normalizeTime(p.endTime, DEFAULTS.endTime),
//             status,
//             completed: true,
//           };
//         });

//         // ✅ 1) setăm employees
//         setEmployees(employeesList);
//         setMonthWorkedHours(monthHours);

//         // ✅ 2) reconstruim vizitatorii din pontajele salvate (employeeIds care NU sunt în employeesList)
//         const employeeSet = new Set(employeesList.map((e) => e._id));
//         const visitorIdsFromDay = Object.keys(dayMap).filter(
//           (empId) => !employeeSet.has(empId)
//         );

//         // încercăm să găsim detaliile vizitatorilor în globalEmployees
//         // (dacă globalEmployees nu e încă încărcat, va fi completat la următorul refresh / când intră)
//         const visitorObjs = visitorIdsFromDay
//           .map((id) => globalEmployees.find((u) => u._id === id))
//           .filter(Boolean);

//         setVisitors(
//           visitorObjs.map((v) => ({
//             ...v,
//           }))
//         );

//         // ✅ 3) init entries pentru employees + vizitatori (din DB)
//         setEntries((prev) => {
//           const next = {};

//           // employees
//           employeesList.forEach((emp) => {
//             const fromApi = dayMap[emp._id] || null;
//             if (fromApi) {
//               next[emp._id] = {
//                 ...DEFAULTS,
//                 ...fromApi,
//                 dirty: false,
//                 isVisitor: false,
//               };
//             } else {
//               next[emp._id] = {
//                 ...DEFAULTS,
//                 startTime: normalizeTime(
//                   prev?.[emp._id]?.startTime,
//                   DEFAULTS.startTime
//                 ),
//                 endTime: normalizeTime(
//                   prev?.[emp._id]?.endTime,
//                   DEFAULTS.endTime
//                 ),
//                 status: prev?.[emp._id]?.status ?? "necompletat",
//                 completed: false,
//                 pontajId: null,
//                 dirty: false,
//                 isVisitor: false,
//               };
//             }
//           });

//           // visitors (din pontaj)
//           visitorObjs.forEach((v) => {
//             const fromApi = dayMap[v._id] || null;
//             next[v._id] = {
//               ...DEFAULTS,
//               ...(fromApi || {}),
//               dirty: false,
//               isVisitor: true,
//             };
//           });

//           return next;
//         });
//       } catch (e) {
//         console.error(e);
//         if (alive) {
//           setEmployees([]);
//           setVisitors([]);
//           setMonthWorkedMins({});
//           setEntries({});
//           setError(e?.message || "Nu s-au putut încărca datele.");
//         }
//       } finally {
//         if (alive) setLoadingE(false);
//       }
//     })();

//     return () => {
//       alive = false;
//     };
//   }, [selectedWorkplace, date, effectiveLockedWorkplaceId, globalEmployees]);

//   /** ============== SAVE ============== */
//   const handleSave = async () => {
//     if (!canSave || !date) return;

//     if (
//       effectiveLockedWorkplaceId &&
//       selectedWorkplace !== effectiveLockedWorkplaceId
//     ) {
//       setError("Nu ai voie să salvezi pontajul pe altă farmacie.");
//       return;
//     }

//     setSaving(true);
//     setError("");
//     setSuccess("");

//     try {
//       const toSave = allPeople
//         .map((p) => ({ p, e: safeEntry(p._id) }))
//         .filter(({ e }) => e.dirty && e.status !== "necompletat");

//       const results = await Promise.allSettled(
//         toSave.map(({ p, e }) => {
//           const isPrezent = e.status === "prezent";
//           const minsWorked = isPrezent
//             ? calcWorkMinutes(e.startTime, e.endTime)
//             : 0;

//           return fetch(`${API}/api/pontaj`, {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             credentials: "include",
//             body: JSON.stringify({
//               employeeId: p._id,
//               workplaceId: selectedWorkplace, // ✅ pontajul aparține farmaciei curente chiar dacă omul e din altă farmacie
//               date,
//               startTime: isPrezent ? e.startTime : DEFAULTS.startTime,
//               endTime: isPrezent ? e.endTime : DEFAULTS.endTime,
//               minutesWorked: minsWorked,
//               hoursWorked: minsWorked / 60,
//               leaveType: statusToLeaveType(e.status),
//               force: false,
//             }),
//           });
//         })
//       );

//       const failed = results.filter(
//         (r) =>
//           r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok)
//       );

//       if (failed.length) {
//         setError(`S-au salvat parțial. ${failed.length} erori.`);
//       } else {
//         setSuccess("Pontaj salvat cu succes!");
//       }

//       // ✅ marcare completat
//       setEntries((prev) => {
//         const next = { ...prev };
//         toSave.forEach(({ p }) => {
//           const cur = next[p._id] || {};
//           next[p._id] = { ...cur, completed: true, dirty: false };
//         });
//         return next;
//       });

//       // ✅ update minute lunare (estimativ UI)
//       setMonthWorkedMins((prev) => {
//         const next = { ...prev };
//         toSave.forEach(({ p, e }) => {
//           const add =
//             e.status === "prezent"
//               ? calcWorkMinutes(e.startTime, e.endTime)
//               : 0;
//           next[p._id] = (next[p._id] || 0) + add;
//         });
//         return next;
//       });

//       // ✅ IMPORTANT: după save, NU ștergem vizitatorii.
//       // Ei vor apărea și după refresh pentru că sunt reconstruiți din pontaj.
//     } catch (e) {
//       console.error(e);
//       setError("Eroare la salvare.");
//     } finally {
//       setSaving(false);
//     }
//   };

//   /** ============== ROWS ============== */
//   const rows = useMemo(() => {
//     return allPeople.map((emp) => {
//       const e = safeEntry(emp._id);

//       const isPrezent = e.status === "prezent";
//       const timesDisabled = !isPrezent;

//       const minsWorkedToday = isPrezent
//         ? calcWorkMinutes(e.startTime, e.endTime)
//         : 0;

//       const targetHours = Number(emp.monthlyTargetHours ?? 0);
//       const targetMins = Math.max(0, targetHours * 60);

//       const monthMinsFromDb = monthWorkedMins[emp._id] || 0;

//       const projectedMonthMins =
//         monthMinsFromDb + (e.completed ? 0 : minsWorkedToday);
//       const remainingMins = Math.max(0, targetMins - projectedMonthMins);

//       return (
//         <tr key={emp._id} className="hover:bg-slate-50">
//           <td className="px-4 py-3 min-w-[260px]">
//             <div className="flex items-center justify-between gap-3">
//               <div className="min-w-0">
//                 <div className="text-sm font-semibold text-slate-900 truncate">
//                   {emp.name || "-"}
//                   {e.isVisitor && (
//                     <span className="ml-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
//                       Vizitator
//                     </span>
//                   )}
//                 </div>
//                 {emp.email && (
//                   <div className="text-xs text-slate-500 truncate">
//                     {emp.email}
//                   </div>
//                 )}
//               </div>

//               {e.isVisitor && (
//                 <button
//                   onClick={() => removeVisitor(emp._id)}
//                   className="shrink-0 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs hover:bg-slate-100"
//                   title="Scoate vizitatorul doar din UI (nu șterge pontajul deja salvat)."
//                 >
//                   Scoate
//                 </button>
//               )}
//             </div>
//           </td>

//           <td className="px-6 py-3 whitespace-nowrap">
//             <span
//               className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-semibold border ${
//                 e.completed
//                   ? "bg-emerald-50 text-emerald-700 border-emerald-200"
//                   : "bg-slate-50 text-slate-600 border-slate-200"
//               }`}
//             >
//               {e.completed ? "Completat" : "Necompletat"}
//             </span>
//           </td>

//           <td className="px-6 py-3 whitespace-nowrap">
//             <select
//               value={e.status}
//               onChange={(ev) =>
//                 updateEntry(emp._id, { status: ev.target.value })
//               }
//               className="w-40 border border-slate-200 bg-white rounded-lg px-3 py-2 text-sm"
//             >
//               {STATUSES.map((s) => (
//                 <option key={s.value} value={s.value}>
//                   {s.label}
//                 </option>
//               ))}
//             </select>
//           </td>

//           <td className="px-6 py-3 whitespace-nowrap">
//             <TimePicker
//               value={e.startTime}
//               onChange={(t) => updateEntry(emp._id, { startTime: t })}
//               disabled={timesDisabled}
//             />
//           </td>

//           <td className="px-6 py-3 whitespace-nowrap">
//             <TimePicker
//               value={e.endTime}
//               onChange={(t) => updateEntry(emp._id, { endTime: t })}
//               disabled={timesDisabled}
//             />
//           </td>

//           <td className="px-6 py-3 whitespace-nowrap">
//             <span
//               className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-semibold border ${
//                 isPrezent
//                   ? "bg-emerald-50 text-emerald-700 border-emerald-200"
//                   : "bg-slate-50 text-slate-600 border-slate-200"
//               }`}
//             >
//               {formatHM(minsWorkedToday)}
//             </span>
//           </td>

//           <td className="px-6 py-3 whitespace-nowrap">
//             <span
//               className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-semibold border bg-slate-50 text-slate-700 border-slate-200"
//               title={
//                 targetHours
//                   ? `Target: ${targetHours}h / Luna`
//                   : "Setează monthlyTargetHours"
//               }
//             >
//               {targetHours ? formatHM(remainingMins) : "—"}
//             </span>
//           </td>
//         </tr>
//       );
//     });
//   }, [allPeople, safeEntry, updateEntry, monthWorkedMins, removeVisitor]);

//   const selectedWorkplaceName = useMemo(() => {
//     return workplaces.find((w) => w._id === selectedWorkplace)?.name || "—";
//   }, [workplaces, selectedWorkplace]);

//   const showWorkplaceDropdown = !effectiveLockedWorkplaceId; // superadmin only

//   return (
//     <div className="w-full">
//       <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
//         <div className="px-6 py-5 border-b border-slate-200 bg-slate-50">
//           <div className="flex items-center justify-between">
//             <h1 className="text-lg font-semibold text-slate-900">Pontaj</h1>
//             {isBusy && (
//               <span className="text-xs text-slate-500 flex items-center gap-2">
//                 <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-b-transparent" />
//                 Se încarcă…
//               </span>
//             )}
//           </div>

//           <div className="mt-3 flex flex-col lg:flex-row lg:items-end gap-3">
//             <div className="flex-1 min-w-0">
//               {showWorkplaceDropdown ? (
//                 <>
//                   <label className="block text-xs text-slate-600 mb-1">
//                     Farmacie
//                   </label>
//                   <select
//                     value={selectedWorkplace}
//                     onChange={(e) => setSelectedWorkplace(e.target.value)}
//                     className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-sm"
//                   >
//                     <option value="">
//                       {loadingW ? "Se încarcă..." : "Selectează o farmacie"}
//                     </option>
//                     {workplaces.map((w) => (
//                       <option key={w._id} value={w._id}>
//                         {w.name}
//                       </option>
//                     ))}
//                   </select>
//                 </>
//               ) : (
//                 <div className="text-sm text-slate-700">
//                   <span className="text-xs text-slate-500 block mb-1">
//                     Farmacie
//                   </span>
//                   <div className="px-3 py-2 border border-slate-200 rounded-lg bg-white">
//                     {selectedWorkplaceName}
//                   </div>
//                 </div>
//               )}
//             </div>

//             <div>
//               <label className="block text-xs text-slate-600 mb-1">Data</label>
//               <div className="flex items-center gap-2">
//                 <input
//                   type="date"
//                   value={date}
//                   onChange={(e) => setDate(e.target.value)}
//                   className="w-[170px] border border-slate-200 bg-white rounded-lg px-3 py-2 text-sm"
//                 />
//                 <button
//                   type="button"
//                   onClick={() => setDate(new Date().toISOString().slice(0, 10))}
//                   className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
//                 >
//                   Azi
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>

//         {error && (
//           <div className="px-6 py-3 border-b border-red-200 bg-red-50">
//             <p className="text-sm font-medium text-red-800">{error}</p>
//           </div>
//         )}
//         {success && (
//           <div className="px-6 py-3 border-b border-emerald-200 bg-emerald-50">
//             <p className="text-sm font-medium text-emerald-800">{success}</p>
//           </div>
//         )}

//         <div className="p-6">
//           {employees.length === 0 && visitors.length === 0 ? (
//             <div className="py-10 text-center">
//               <div className="text-lg font-semibold text-slate-900">
//                 Nu există angajați
//               </div>
//               <div className="text-sm text-slate-500 mt-1">
//                 Selectează o farmacie cu utilizatori.
//               </div>
//             </div>
//           ) : (
//             <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
//               <div className="overflow-x-auto">
//                 <table className="w-full min-w-[980px]">
//                   <thead className="bg-slate-50">
//                     <tr>
//                       <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
//                         Angajat
//                       </th>
//                       <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
//                         Pontaj
//                       </th>
//                       <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
//                         Status
//                       </th>
//                       <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
//                         Intrare
//                       </th>
//                       <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
//                         Ieșire
//                       </th>
//                       <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
//                         Ore
//                       </th>
//                       <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
//                         Rămase luna
//                       </th>
//                     </tr>
//                   </thead>
//                   <tbody className="divide-y divide-slate-100">{rows}</tbody>
//                 </table>
//               </div>
//             </div>
//           )}
//         </div>

//         <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
//           <div className="relative inline-flex items-start">
//             {/* ✅ IMPORTANT: AddVisitor caută în globalEmployees */}
//             <AddVisitor
//               items={globalEmployees}
//               excludeIds={excludeIds}
//               onPick={addVisitor}
//               disabled={!selectedWorkplace || loadingGlobal}
//               label={loadingGlobal ? "Se încarcă..." : "+ Adaugă vizitator"}
//             />
//           </div>

//           <button
//             onClick={handleSave}
//             disabled={!canSave}
//             className={`px-5 py-2 rounded-md text-sm font-medium ${
//               canSave
//                 ? "bg-emerald-600 text-white hover:bg-emerald-700"
//                 : "bg-slate-200 text-slate-500 cursor-not-allowed"
//             }`}
//           >
//             {saving ? "Salvez…" : "Salvează"}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default PontajDashboard;

/** =================== CONFIG =================== */

const DEFAULTS = {
  startTime: "08:00",
  endTime: "16:00",
  status: "necompletat",
};

const STATUSES = [
  { value: "necompletat", label: "Necompletat" },
  { value: "prezent", label: "Prezent" },
  { value: "concediu", label: "Concediu" },
  { value: "liber", label: "Liber" },
  { value: "medical", label: "Medical" },
  { value: "garda", label: "Garda" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => pad2(i));
const MINUTES = Array.from({ length: 60 }, (_, i) => pad2(i));

const statusToLeaveType = (status: string): string | null =>
  ({ concediu: "odihna", medical: "medical", liber: "liber" }[status] ?? null);

// ✅ Helper: verifică dacă statusul permite introducerea orelor
const allowsHoursInput = (status: string): boolean => {
  return status === "prezent" || status === "garda";
};

const getMonthRange = (yyyyMmDd: string): { from: string; to: string } => {
  const [y, m] = yyyyMmDd.split("-").map(Number);
  const from = `${y}-${pad2(m)}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${pad2(m)}-${pad2(lastDay)}`;
  return { from, to };
};

/** =================== UI SMALLS =================== */
interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const TimePicker = React.memo<TimePickerProps>(({ value, onChange, disabled }) => {
  const [h, m] = normalizeTime(value).split(":");
  const cls = `w-[62px] border rounded-lg px-2 py-2 text-sm transition-colors ${
    disabled
      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
      : "border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
  }`;

  return (
    <div className="flex items-center gap-1">
      <select
        disabled={disabled}
        value={h}
        onChange={(e) => onChange(`${e.target.value}:${m}`)}
        className={cls}
      >
        {HOURS.map((hour) => (
          <option key={hour} value={hour}>
            {hour}
          </option>
        ))}
      </select>

      <select
        disabled={disabled}
        value={m}
        onChange={(e) => onChange(`${h}:${e.target.value}`)}
        className={cls}
      >
        {MINUTES.map((min) => (
          <option key={min} value={min}>
            {min}
          </option>
        ))}
      </select>
    </div>
  );
});

TimePicker.displayName = 'TimePicker';

/** =================== MAIN =================== */
interface PontajDashboardProps {
  lockedWorkplaceId?: string;
}

interface EntryData {
  startTime?: string;
  endTime?: string;
  status: string;
  completed: boolean;
  pontajId: string | null;
  dirty: boolean;
  isVisitor: boolean;
  isGarda?: boolean; // ✅ Flag pentru ore de gardă
}

interface LeaveWarningData {
  employee: Employee;
  entry: EntryData;
  leave: Leave;
  saveData: TimesheetFormData;
  allWarnings?: LeaveWarningData[];
}


interface VisitorAlreadyPontedData {
  employee: Employee;
  visitorEntry?: {
    workplaceName: string;
    date: string;
  };
}

interface DeletePontajData {
  employee: Employee;
  date: string;
}

const PontajDashboard: React.FC<PontajDashboardProps> = ({ lockedWorkplaceId = "" }) => {
  /** ============== CURRENT USER (DIN LOCALSTORAGE) ============== */
  const currentUser = useMemo(() => {
    return getUserFromStorage();
  }, []);

  const isAdmin = currentUser?.role === "admin";
  const userWorkplaceId = typeof currentUser?.workplaceId === 'object' && currentUser.workplaceId?._id
    ? String(currentUser.workplaceId._id)
    : typeof currentUser?.workplaceId === 'string'
    ? currentUser.workplaceId
    : "";

  // dacă e admin, forțăm workplace-ul din user
  const effectiveLockedWorkplaceId: string = isAdmin
    ? userWorkplaceId
    : lockedWorkplaceId;

  // ✅ vizitatori: separăm cei "manuali" vs cei rehidratați din DB
  const [visitorsManual, setVisitorsManual] = useState<Employee[]>([]);
  const [visitorsFromDb, setVisitorsFromDb] = useState<Employee[]>([]);

  // ✅ lista pt picker (toți angajații din toate farmaciile)
  const [allEmployeesForPicker, setAllEmployeesForPicker] = useState<Employee[]>([]);

  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [selectedWorkplace, setSelectedWorkplace] = useState<string>(
    effectiveLockedWorkplaceId || ""
  );

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [entries, setEntries] = useState<Record<string, EntryData>>({});
  const [pontajList, setPontajList] = useState<TimesheetViewerEntry[]>([]); // ✅ Stocăm pontajList pentru a accesa informațiile despre vizitatori
  const [monthWorkedHours, setMonthWorkedHours] = useState<Record<string, number>>({});

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [loadingW, setLoadingW] = useState(false);
  const [loadingE, setLoadingE] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [refreshKey, setRefreshKey] = useState<number>(0); // ✅ pentru a forța reîncărcarea după salvare
  const isRefreshingAfterSave = useRef<boolean>(false); // ✅ Flag pentru a ști dacă reîncărcarea este după salvare
  const [showLeaveWarningModal, setShowLeaveWarningModal] = useState<boolean>(false);
  const [leaveWarningData, setLeaveWarningData] = useState<LeaveWarningData | null>(null);
  const [showVisitorAlreadyPontedModal, setShowVisitorAlreadyPontedModal] = useState<boolean>(false);
  const [visitorAlreadyPontedData, setVisitorAlreadyPontedData] = useState<VisitorAlreadyPontedData | null>(null);
  const [showDeletePontajModal, setShowDeletePontajModal] = useState<boolean>(false);
  const [deletePontajData, setDeletePontajData] = useState<DeletePontajData | null>(null);

  const isBusy = loadingW || loadingE || saving;

  /** ============== HARD LOCK pt ADMIN ============== */
  useEffect(() => {
    if (effectiveLockedWorkplaceId) {
      setSelectedWorkplace(effectiveLockedWorkplaceId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveLockedWorkplaceId]);

  /** ============== PEOPLE IN TABLE ============== */
  const allPeople = useMemo(() => {
    // ✅ Vizitatorii la început (visitorsManual, visitorsFromDb), apoi employees
    const map = new Map();
    // Ordinea: vizitatori manual (noi adăugați) → vizitatori din DB → angajați farmacie
    [...visitorsManual, ...visitorsFromDb, ...employees].forEach((p) => {
      if (p?._id) map.set(p._id, p);
    });
    // Returnează: vizitatori manual, apoi vizitatori din DB, apoi employees
    const visitorsManualIds = new Set(visitorsManual.map(v => v._id));
    const visitorsFromDbIds = new Set(visitorsFromDb.map(v => v._id));
    
    return Array.from(map.values()).sort((a, b) => {
      const aIsManualVisitor = visitorsManualIds.has(a._id);
      const bIsManualVisitor = visitorsManualIds.has(b._id);
      const aIsDbVisitor = visitorsFromDbIds.has(a._id);
      const bIsDbVisitor = visitorsFromDbIds.has(b._id);
      
      // Vizitatori manual la început
      if (aIsManualVisitor && !bIsManualVisitor) return -1;
      if (!aIsManualVisitor && bIsManualVisitor) return 1;
      
      // Apoi vizitatori din DB
      if (aIsDbVisitor && !bIsDbVisitor) return -1;
      if (!aIsDbVisitor && bIsDbVisitor) return 1;
      
      // Apoi employees (ordinea originală)
      return 0;
    });
  }, [employees, visitorsFromDb, visitorsManual]);

  const excludeIds = useMemo(() => allPeople.map((p) => p._id), [allPeople]);

  const canSave = useMemo(() => {
    if (!selectedWorkplace || allPeople.length === 0 || isBusy) return false;
    return allPeople.some((p) => {
      const e = entries[p._id];
      return e?.dirty && e?.status && e.status !== "necompletat";
    });
  }, [selectedWorkplace, allPeople, isBusy, entries]);

  const safeEntry = useCallback(
    (id: string): EntryData => {
      const e = entries[id] || {};
      return {
        startTime: normalizeTime(e.startTime, DEFAULTS.startTime),
        endTime: normalizeTime(e.endTime, DEFAULTS.endTime),
        status: e.status ?? DEFAULTS.status,
        completed: !!e.completed,
        pontajId: e.pontajId ?? null,
        dirty: !!e.dirty,
        isVisitor: !!e.isVisitor,
        isGarda: !!e.isGarda, // ✅ Include isGarda
      };
    },
    [entries]
  );

  const updateEntry = useCallback((id: string, patch: Partial<EntryData>) => {
    setEntries((prev) => {
      const current = prev[id] || {};
      return {
        ...prev,
        [id]: {
          ...DEFAULTS,
          ...current,
          ...patch,
          dirty: true,
        } as EntryData,
      };
    });
  }, []);

  /** ============== VISITORS (MANUAL) HELPERS ============== */
  const addVisitorManual = useCallback(
    (emp: Employee) => {
      setVisitorsManual((prev) => {
        if (prev.some((v) => v._id === emp._id)) return prev;
        if (employees.some((e) => e._id === emp._id)) return prev; // deja e angajat al farmaciei
        if (visitorsFromDb.some((v) => v._id === emp._id)) return prev; // deja e vizitator din DB
        return [...prev, emp];
      });

      setEntries((prev) => {
        if (prev[emp._id]) return prev;
        return {
          ...prev,
          [emp._id]: {
            ...DEFAULTS,
            dirty: false,
            completed: false,
            isVisitor: true,
            pontajId: null,
          } as EntryData,
        };
      });
    },
    [employees, visitorsFromDb]
  );

  const removeVisitor = useCallback((empId: string): void => {
    // Șterge din visitorsManual (vizitatori adăugați manual, ne-salvați)
    setVisitorsManual((prev) => prev.filter((v) => v._id !== empId));
    
    // Pentru visitorsFromDb (vizitatori salvați în pontaj):
    // Nu îi ștergem complet, doar îi ascundem temporar din UI
    // Vor reapărea la refresh sau când se reîncarcă datele
    // Dacă vrei să îi ștergi permanent, trebuie să ștergi pontajul din backend
    
    setEntries((prev) => {
      const next = { ...prev };
      delete next[empId];
      return next;
    });
  }, []);

  // ✅ Funcție pentru a ascunde temporar un vizitator salvat (din visitorsFromDb)
  const hideVisitorFromDb = useCallback((empId: string): void => {
    setVisitorsFromDb((prev) => prev.filter((v) => v._id !== empId));
    setEntries((prev) => {
      const next = { ...prev };
      delete next[empId];
      return next;
    });
  }, []);

  // ✅ când schimbi farmacia sau data:
  // - ștergem doar vizitatorii manuali (pentru că nu sunt salvați încă)
  // - visitorsFromDb vor fi recalculați din pontaj la reload
  useEffect(() => {
    setVisitorsManual([]);
  }, [selectedWorkplace, date]);

  /** ============== LOAD WORKPLACES ============== */
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoadingW(true);
        const arr = await workplaceService.getAll();
        if (!alive) return;

        setWorkplaces(arr);

        if (!effectiveLockedWorkplaceId && !selectedWorkplace && arr.length) {
          setSelectedWorkplace(String(arr[0]._id));
        }
      } catch (e) {
        console.error(e);
        if (alive) setError("Nu s-au putut încărca farmaciile.");
      } finally {
        if (alive) setLoadingW(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveLockedWorkplaceId]);

  /** ============== LOAD ALL EMPLOYEES FOR PICKER ============== */
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const arr = await employeeService.getAll();
        if (!alive) return;

        setAllEmployeesForPicker(arr);
      } catch (e) {
        console.error(e);
        if (alive) setAllEmployeesForPicker([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  /** ============== LOAD EMPLOYEES + PONTAJ (ZI + LUNĂ) + REHIDRATARE VIZITATORI ============== */
  useEffect(() => {
    if (!selectedWorkplace) return;

    if (
      effectiveLockedWorkplaceId &&
      selectedWorkplace !== effectiveLockedWorkplaceId
    ) {
      setSelectedWorkplace(effectiveLockedWorkplaceId);
      return;
    }

    let alive = true;

    (async () => {
      try {
        setLoadingE(true);
        setError("");
        // Nu resetăm mesajul de succes dacă reîncărcarea este după salvare
        if (!isRefreshingAfterSave.current) {
          setSuccess("");
        }
        // Nu resetăm flag-ul aici - va fi resetat după ce timeout-ul expiră

        const { from, to } = getMonthRange(date);

        // ✅ Încarcă și concediile pentru a seta automat statusul
        const [employeesList, pontajList, leavesList] = await Promise.all([
          employeeService.getByWorkplace(selectedWorkplace),
          timesheetService.getEntriesByWorkplace(selectedWorkplace, from, to),
          leaveService.getByWorkplace(selectedWorkplace).catch(() => [] as Leave[]), // Dacă eșuează, folosește array gol
        ]);
        
        // ✅ Stocăm pontajList pentru a accesa informațiile despre vizitatori
        setPontajList(pontajList);

        // ✅ Helper: Verifică dacă un angajat are concediu aprobat în ziua selectată
        const getLeaveForEmployee = (employeeId: string, targetDate: string | Date): Leave | undefined => {
          const targetDateStr = targetDate instanceof Date 
            ? targetDate.toISOString().slice(0, 10)
            : targetDate;
          
          return leavesList.find((leave) => {
            // Verifică dacă concediul este aprobat
            if (leave.status !== "Aprobată") return false;
            
            // Verifică dacă angajatul se potrivește
            const leaveEmpId = typeof leave.employeeId === 'object' && leave.employeeId?._id
              ? String(leave.employeeId._id)
              : String(leave.employeeId || '');
            if (leaveEmpId !== String(employeeId)) return false;
            
            // Verifică dacă data se află în intervalul concediului
            const startDate = new Date(leave.startDate);
            const endDate = new Date(leave.endDate);
            const checkDate = new Date(targetDateStr);
            
            // Setează ora la 00:00:00 pentru comparație corectă
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            checkDate.setHours(0, 0, 0, 0);
            
            return checkDate >= startDate && checkDate <= endDate;
          });
        };

        // ✅ Helper: Mapează tipul de concediu la statusul din pontaj
        const leaveTypeToStatus = (leaveType: string): string => {
          switch (leaveType) {
            case "medical":
              return "medical";
            case "fara_plata":
            case "eveniment":
              return "liber";
            case "odihna":
            default:
              return "concediu";
          }
        };

        // ✅ DEBUG: log pentru debugging
        console.log("📥 RECEIVED DATA:", {
          employeesCount: employeesList.length,
          pontajListCount: pontajList.length,
          selectedDate: date,
          pontajList: pontajList.map((p) => ({
            employeeId: typeof p.employeeId === 'object' && p.employeeId?._id 
              ? String(p.employeeId._id) 
              : String(p.employeeId || ''),
            employeeName: p.employeeName,
            date: p.date,
            dateType: typeof p.date,
            workplaceId: typeof p.workplaceId === 'object' && p.workplaceId?._id 
              ? String(p.workplaceId._id) 
              : String(p.workplaceId || ''),
            workplaceName: p.workplaceName,
            type: p.type,
          })),
        });

        // ✅ DEBUG: log pentru debugging
        console.log("🔍 LOAD DATA:", {
          employeesCount: employeesList.length,
          pontajCount: pontajList.length,
          selectedWorkplace,
          date,
        });

        if (!alive) return;

        // ✅ ore lucrate în lună per employeeId
        // ✅ PREVENIM DUPLICATELE: Grupăm după employeeId + date + workplaceId + type
        // pentru a evita adunarea orelor pentru același pontaj
        const monthHours: Record<string, number> = {};
        const seenEntries = new Set<string>();
        
        pontajList.forEach((p) => {
          const empId = typeof p.employeeId === 'object' && p.employeeId?._id 
            ? p.employeeId._id 
            : typeof p.employeeId === 'string' 
            ? p.employeeId 
            : null;
          if (!empId) return;
          
          const empIdKey = String(empId);
          const dateKey = p.date || '';
          const wpIdKey = String(p.workplaceId || '');
          const typeKey = p.type || 'home';
          
          // ✅ Cheie unică pentru a evita duplicatele
          const uniqueKey = `${empIdKey}_${dateKey}_${wpIdKey}_${typeKey}`;
          
          // ✅ Dacă am văzut deja acest entry, îl ignorăm
          if (seenEntries.has(uniqueKey)) {
            console.warn("⚠️ DUPLICATE ENTRY IGNORED:", {
              employeeId: empIdKey,
              date: dateKey,
              workplaceId: wpIdKey,
              type: typeKey,
            });
            return;
          }
          
          seenEntries.add(uniqueKey);
          
          // ✅ Folosim doar ore (nu minute)
          const hours =
            typeof p.hoursWorked === "number"
              ? p.hoursWorked
              : p.startTime && p.endTime
              ? calcWorkHours(p.startTime, p.endTime)
              : 0;
          monthHours[empIdKey] = (monthHours[empIdKey] || 0) + (hours || 0);
        });

        // ✅ pontaj existent în DB pentru data selectată
        const dayMap: Record<string, EntryData> = {};
        const dayEmpIds = new Set<string>();

        console.log("🔍 PROCESSING PONTAJ:", {
          pontajListLength: pontajList.length,
          targetDate: date,
          pontajList: pontajList.map((p) => ({
            employeeId: typeof p.employeeId === 'object' && p.employeeId?._id 
              ? p.employeeId._id 
              : typeof p.employeeId === 'string' 
              ? p.employeeId 
              : null,
            employeeName: p.employeeName,
            date: p.date,
            workplaceId: typeof p.workplaceId === 'object' && p.workplaceId?._id 
              ? p.workplaceId._id 
              : typeof p.workplaceId === 'string' 
              ? p.workplaceId 
              : null,
            workplaceName: p.workplaceName,
          })),
        });

        pontajList.forEach((p) => {
          const empId = typeof p.employeeId === 'object' && p.employeeId?._id 
            ? p.employeeId._id 
            : typeof p.employeeId === 'string' 
            ? p.employeeId 
            : null;
          if (!empId) {
            console.warn("⚠️ PONTAJ FĂRĂ EMPLOYEE ID:", p);
            return; // skip dacă nu există employeeId
          }
          
          // ✅ normalizăm data corect (este string "YYYY-MM-DD")
          let d = "";
          if (p.date) {
            try {
              // Dacă e deja string "YYYY-MM-DD", folosim direct
              if (/^\d{4}-\d{2}-\d{2}$/.test(p.date)) {
                d = p.date;
              } else {
                // Altfel, convertim la Date și apoi la string
                const dateObj = new Date(p.date);
                d = dateObj.toISOString().slice(0, 10);
              }
            } catch (err) {
              console.warn("⚠️ EROARE LA NORMALIZAREA DATEI:", p.date, err);
              d = String(p.date).slice(0, 10);
            }
          }
          
          // Comparăm datele normalizate
          if (d !== date) {
            // ✅ DEBUG: log pentru debugging (doar pentru vizitatori)
            if (p.type === "visitor" || !employeesList.some(e => String(e._id) === String(empId))) {
              console.log("🔍 PONTAJ FILTRAT (data diferită):", {
                empId: String(empId),
                empName: p.employeeName,
                pontajDate: d,
                targetDate: date,
                type: p.type,
              });
            }
            return;
          }

          const empIdStr = String(empId);
          dayEmpIds.add(empIdStr);

          // ✅ DEBUG: log pentru debugging (doar pentru vizitatori care trec de filtru)
          if (p.type === "visitor" || !employeesList.some(e => String(e._id) === String(empId))) {
            console.log("✅ PONTAJ ACCEPTAT (data se potrivește):", {
              empId: empIdStr,
              empName: p.employeeName,
              pontajDate: d,
              targetDate: date,
              type: p.type,
              workplaceId: typeof p.workplaceId === 'object' && p.workplaceId?._id 
                ? String(p.workplaceId._id) 
                : String(p.workplaceId || ''),
              workplaceName: p.workplaceName,
            });
          }

          // ✅ Determină statusul: verifică mai întâi statusul direct, apoi leaveType
          let status = "prezent";
          if (p.status === "garda") {
            status = "garda";
          } else if (p.status === "medical") {
            status = "medical";
          } else if (p.status === "concediu" || p.status === "liber") {
            status = p.status;
          } else if (p.leaveType === "medical") {
            status = "medical";
          } else if (p.leaveType === "liber") {
            status = "liber";
          } else if (p.leaveType) {
            status = "concediu";
          } else if (p.status) {
            status = p.status;
          }

          dayMap[empIdStr] = {
            pontajId: p._id || null,
            startTime: normalizeTime(p.startTime || DEFAULTS.startTime, DEFAULTS.startTime),
            endTime: normalizeTime(p.endTime || DEFAULTS.endTime, DEFAULTS.endTime),
            status,
            completed: true,
            dirty: false,
            isVisitor: p.type === 'visitor',
            isGarda: p.status === "garda", // ✅ Setează flag-ul pentru gardă din statusul din DB
          } as EntryData;
        });

        // ✅ REHIDRATARE VIZITATORI:
        // Identificăm vizitatorii în două moduri:
        // 1. Entry-uri cu type: "visitor" (din DB)
        // 2. EmployeeIds care NU sunt în employeesList (pentru compatibilitate)
        const baseIds = new Set(employeesList.map((u) => String(u._id)));
        
        // ✅ Găsește toate entry-urile cu type: "visitor" pentru ziua curentă
        const visitorEntryIds = new Set<string>();
        pontajList.forEach((p) => {
          const empId = typeof p.employeeId === 'object' && p.employeeId?._id 
            ? p.employeeId._id 
            : typeof p.employeeId === 'string' 
            ? p.employeeId 
            : null;
          if (!empId) return;
          
          // Normalizează data pentru comparație
          let d = "";
          if (p.date) {
            try {
              if (typeof p.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.date)) {
                d = p.date;
              } else {
                const dateObj = new Date(p.date);
                d = dateObj.toISOString().slice(0, 10);
              }
            } catch (err) {
              d = String(p.date).slice(0, 10);
            }
          }
          
          // Dacă entry-ul este pentru ziua curentă și are type: "visitor"
          if (d === date && p.type === "visitor") {
            visitorEntryIds.add(String(empId));
          }
        });
        
        // ✅ Combină: vizitatori identificați prin type: "visitor" + cei care nu sunt în employeesList
        const extraIds = Array.from(
          new Set([
            ...Array.from(visitorEntryIds),
            ...Array.from(dayEmpIds).filter((id) => !baseIds.has(id))
          ])
        );

        // ✅ DEBUG: log pentru debugging
        console.log("🔍 REHIDRATARE VIZITATORI:", {
          dayEmpIds: Array.from(dayEmpIds),
          baseIds: Array.from(baseIds),
          visitorEntryIds: Array.from(visitorEntryIds),
          extraIds,
          date,
          pontajListLength: pontajList.length,
          employeesListLength: employeesList.length,
          // ✅ Verifică dacă există pontaje pentru vizitatori
          visitorPontaj: pontajList.filter((p) => {
            const empId = typeof p.employeeId === 'object' && p.employeeId?._id 
              ? p.employeeId._id 
              : typeof p.employeeId === 'string' 
              ? p.employeeId 
              : null;
            if (!empId) return false;
            
            // Normalizează data
            let d = "";
            if (p.date) {
              try {
                if (typeof p.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.date)) {
                  d = p.date;
                } else {
                  const dateObj = new Date(p.date);
                  d = dateObj.toISOString().slice(0, 10);
                }
              } catch (err) {
                d = String(p.date).slice(0, 10);
              }
            }
            
            return d === date && (p.type === "visitor" || !baseIds.has(String(empId)));
          }).map((p) => {
            const empId = typeof p.employeeId === 'object' && p.employeeId?._id 
              ? p.employeeId._id 
              : typeof p.employeeId === 'string' 
              ? p.employeeId 
              : null;
            return {
              empId: String(empId || ''),
              empName: p.employeeName,
              date: p.date,
              type: p.type,
            };
          }),
        });

        let extraUsers: Employee[] = [];
        if (extraIds.length > 0) {
          extraUsers = await employeeService.getByIds(extraIds.filter((id): id is string => typeof id === 'string'));
          console.log("✅ VIZITATORI ÎNCĂRCAȚI:", extraUsers);
        }

        if (!alive) return;

        setEmployees(employeesList);
        setVisitorsFromDb(extraUsers); // ✅ asta îi face să rămână după refresh
        setMonthWorkedHours(monthHours);

        // init entries pentru employees + visitorsFromDb
        setEntries(() => {
          const next: Record<string, EntryData> = {};
          const combined = [...employeesList, ...extraUsers];

          combined.forEach((emp) => {
            const empIdKey = String(emp._id);
            const fromApi = dayMap[empIdKey] || null;
            
            // ✅ Determină dacă este vizitator:
            // 1. Verifică dacă entry-ul din DB are type: "visitor"
            // 2. Sau dacă nu este în lista de angajați ai farmaciei curente
            const isVisitorFromDb = pontajList.some((p) => {
              const pEmpId = typeof p.employeeId === 'object' && p.employeeId?._id 
                ? p.employeeId._id 
                : typeof p.employeeId === 'string' 
                ? p.employeeId 
                : null;
              if (!pEmpId || String(pEmpId) !== empIdKey) return false;
              
              // Normalizează data
              let d = "";
              if (p.date) {
                try {
                  if (typeof p.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.date)) {
                    d = p.date;
                  } else {
                    const dateObj = new Date(p.date);
                    d = dateObj.toISOString().slice(0, 10);
                  }
                } catch (err) {
                  d = String(p.date).slice(0, 10);
                }
              }
              
              return d === date && p.type === "visitor";
            });
            const isVisitorFromList = !baseIds.has(String(emp._id));
            const isVisitor = isVisitorFromDb || isVisitorFromList;

            // ✅ Verifică dacă angajatul are concediu aprobat în ziua selectată
            const leaveForToday = getLeaveForEmployee(emp._id, date);
            const autoStatusFromLeave = leaveForToday 
              ? leaveTypeToStatus(leaveForToday.type) 
              : null;

            if (fromApi) {
              // ✅ Există date din DB pentru această zi
              // Dacă nu există status setat în pontaj și există concediu, folosim statusul din concediu
              // Dacă pontajul are deja status "prezent" dar există concediu, actualizăm la statusul din concediu
              const finalStatus = (allowsHoursInput(fromApi.status) || !fromApi.status) && autoStatusFromLeave
                ? autoStatusFromLeave
                : fromApi.status;
              
              next[emp._id] = {
                ...DEFAULTS,
                ...fromApi,
                status: finalStatus,
                dirty: false,
                isVisitor: isVisitor, // ✅ Folosim logica îmbunătățită
              } as EntryData;
            } else {
              // ✅ Nu există date din DB pentru această zi
              // Dacă există concediu aprobat, setăm automat statusul
              const defaultStatus = autoStatusFromLeave || DEFAULTS.status;
              
              next[emp._id] = {
                ...DEFAULTS,
                startTime: DEFAULTS.startTime,
                endTime: DEFAULTS.endTime,
                status: defaultStatus,
                completed: false,
                pontajId: null,
                dirty: false,
                isVisitor: isVisitor, // ✅ Folosim logica îmbunătățită
              } as EntryData;
            }
          });

          // ✅ Nu mai păstrăm entry-urile vechi pentru vizitatorii manuali când se schimbă data
          // Vizitatorii manuali se resetează când se schimbă data (vezi useEffect pentru date/selectedWorkplace)

          return next;
        });
        } catch (e: any) {
        console.error(e);
        if (alive) {
          setEmployees([]);
          setVisitorsFromDb([]);
          setMonthWorkedMins({});
          setError(e?.message || "Nu s-au putut încărca datele.");
        }
      } finally {
        if (alive) setLoadingE(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [selectedWorkplace, date, effectiveLockedWorkplaceId, refreshKey]); // ✅ adăugăm refreshKey

  /** ============== CONFIRM LEAVE WARNING ============== */
  const handleConfirmLeaveWarning = async () => {
    if (!leaveWarningData) return;

    setSaving(true);
    setShowLeaveWarningModal(false);
    setError("");
    setSuccess("");

    try {
      // Salvează cu force: true pentru toți angajații cu concediu
      const allWarnings = leaveWarningData.allWarnings || [leaveWarningData];
      const results = await Promise.allSettled(
        allWarnings.map(async (warning) => {
          const saveData: TimesheetFormData = {
            ...warning.saveData,
            force: true, // ✅ Forțăm salvarea
          };
          return await timesheetService.save(saveData);
        })
      );

      const failed = results.filter(
        (r) => r.status === "rejected"
      );

      if (failed.length) {
        setError(`S-au salvat parțial. ${failed.length} erori.`);
      } else {
        setSuccess("Pontaj salvat cu succes. Notă: Angajatul are concediu aprobat în această perioadă.");
      }

      // Actualizează entries și monthWorkedHours
      const successful = allWarnings.filter((_, idx) => {
        const result = results[idx];
        return result.status === "fulfilled";
      });

      setEntries((prev) => {
        const next = { ...prev };
        successful.forEach((warning) => {
          const cur = next[warning.employee._id] || {};
          next[warning.employee._id] = { 
            ...cur, 
            completed: true, 
            dirty: false,
            isGarda: warning.entry.isGarda || false, // ✅ Păstrăm isGarda
          };
        });
        return next;
      });

      setMonthWorkedMins((prev) => {
        const next = { ...prev };
        successful.forEach((warning) => {
          const add =
            allowsHoursInput(warning.entry.status) && warning.entry.startTime && warning.entry.endTime
              ? calcWorkHours(warning.entry.startTime, warning.entry.endTime)
              : 0;
          next[warning.employee._id] = (next[warning.employee._id] || 0) + add;
        });
        return next;
      });

      // Forțează reîncărcarea datelor
      isRefreshingAfterSave.current = true; // Marchează că reîncărcarea este după salvare
      setRefreshKey((prev) => prev + 1);
      setLeaveWarningData(null);
    } catch (e) {
      console.error(e);
      setError("Eroare la salvare.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelLeaveWarning = () => {
    setShowLeaveWarningModal(false);
    setLeaveWarningData(null);
    setSaving(false);
  };


  /** ============== SAVE ============== */
  const handleSave = async () => {
    if (!canSave || !date) return;

    if (
      effectiveLockedWorkplaceId &&
      selectedWorkplace !== effectiveLockedWorkplaceId
    ) {
      setError("Nu ai voie să salvezi pontajul pe altă farmacie.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const toSave = allPeople
        .map((p) => ({ p, e: safeEntry(p._id) }))
        .filter(({ e }) => e.dirty && e.status !== "necompletat");
      
      console.log("📋 TO SAVE:", {
        total: toSave.length,
        entries: toSave.map(({ p, e }) => ({
          name: p.name,
          status: e.status,
          isGarda: e.isGarda,
          dirty: e.dirty,
          startTime: e.startTime,
          endTime: e.endTime,
        })),
      });

      // Verifică dacă există concedii aprobate sau pontaje existente înainte de salvare
      const leaveWarnings: LeaveWarningData[] = [];
      const alreadySaved: string[] = []; // Angajații care au fost deja salvați cu succes sau au pontaj existent
      for (const { p, e } of toSave) {
        const isPrezent = allowsHoursInput(e.status);
        const hoursWorked = isPrezent && e.startTime && e.endTime
          ? calcWorkHours(e.startTime, e.endTime)
          : 0;

        // ✅ Verifică dacă se încearcă editarea unui pontaj existent
        const isEditingExistingPontaj = e.completed && e.pontajId;

        // ✅ Determină statusul: dacă checkbox-ul pentru gardă este bifat, statusul devine "garda"
        // Dacă utilizatorul a bifat "ore de gardă" și statusul este "prezent", atunci statusul final devine "garda"
        const finalStatus = (e.status === "prezent" && e.isGarda) ? "garda" : e.status;

        // Încearcă să salveze fără force
        const saveData: TimesheetFormData = {
          employeeId: p._id,
          workplaceId: selectedWorkplace,
          date,
          startTime: isPrezent ? (e.startTime || DEFAULTS.startTime) : DEFAULTS.startTime,
          endTime: isPrezent ? (e.endTime || DEFAULTS.endTime) : DEFAULTS.endTime,
          hoursWorked: hoursWorked,
          minutesWorked: 0,
          leaveType: statusToLeaveType(finalStatus),
          status: finalStatus === "garda" ? "garda" : undefined, // ✅ Trimite status doar pentru gardă
          force: false,
        };

        try {
          console.log("💾 SALVARE PONTAJ:", {
            employeeId: p._id,
            employeeName: p.name,
            date,
            startTime: saveData.startTime,
            endTime: saveData.endTime,
            hoursWorked: saveData.hoursWorked,
            status: saveData.status,
            isGarda: e.isGarda,
            finalStatus,
          });
          await timesheetService.save(saveData);
          console.log("✅ PONTAJ SALVAT CU SUCCES:", p.name);
          // Dacă nu e eroare, înseamnă că a fost salvat cu succes
          alreadySaved.push(p._id);
          continue;
        } catch (error: any) {
          // Dacă primește 409 cu codul "LEAVE_APPROVED" sau "OVERLAPPING_HOURS", adaugă la lista de avertismente
          if (error instanceof FetchError && error.status === 409) {
            const errorData = error.data as any;
            
            if (errorData.code === "LEAVE_APPROVED" && errorData.canForce) {
        // ✅ Determină statusul: dacă checkbox-ul pentru gardă este bifat, statusul devine "garda"
        // Dacă utilizatorul a bifat "ore de gardă" și statusul este "prezent", atunci statusul final devine "garda"
        const finalStatus = (e.status === "prezent" && e.isGarda) ? "garda" : e.status;
            
            leaveWarnings.push({
              employee: p,
              entry: e,
              leave: errorData.leave,
              saveData: {
                employeeId: p._id,
                workplaceId: selectedWorkplace,
                date,
                startTime: isPrezent ? (e.startTime || DEFAULTS.startTime) : DEFAULTS.startTime,
                endTime: isPrezent ? (e.endTime || DEFAULTS.endTime) : DEFAULTS.endTime,
                hoursWorked: hoursWorked,
                minutesWorked: 0,
                leaveType: statusToLeaveType(finalStatus),
                status: finalStatus === "garda" ? "garda" : undefined, // ✅ Trimite status doar pentru gardă
              },
            });
              continue; // Nu continuăm cu salvarea pentru acest angajat
            }

            if (errorData.code === "OVERLAPPING_HOURS" && errorData.canForce) {
        // ✅ Determină statusul: dacă checkbox-ul pentru gardă este bifat, statusul devine "garda"
        // Dacă utilizatorul a bifat "ore de gardă" și statusul este "prezent", atunci statusul final devine "garda"
        const finalStatus = (e.status === "prezent" && e.isGarda) ? "garda" : e.status;
            
            // Salvează direct cu force: true (fără modal)
            try {
              const forceSaveData: TimesheetFormData = {
                employeeId: p._id,
                workplaceId: selectedWorkplace,
                date,
                startTime: isPrezent ? (e.startTime || DEFAULTS.startTime) : DEFAULTS.startTime,
                endTime: isPrezent ? (e.endTime || DEFAULTS.endTime) : DEFAULTS.endTime,
                hoursWorked: hoursWorked,
                minutesWorked: 0,
                leaveType: statusToLeaveType(finalStatus),
                status: finalStatus === "garda" ? "garda" : undefined,
                force: true, // ✅ Forțăm salvarea
              };
              
              await timesheetService.save(forceSaveData);
              alreadySaved.push(p._id);
              continue; // Continuă cu următorul angajat
            } catch (forceError) {
              console.error("Eroare la salvarea forțată:", forceError);
              setError(`Eroare la salvarea pontajului pentru ${p.name}`);
              continue;
            }
            }

            if (errorData.code === "VISITOR_ALREADY_PONTED") {
              // Vizitatorul a fost deja pontat la altă farmacie
              setVisitorAlreadyPontedData({
                employee: p,
                visitorEntry: errorData.visitorEntry,
              });
              setShowVisitorAlreadyPontedModal(true);
              setSaving(false);
              return; // Oprește salvarea - nu se poate forța
            }

            if (errorData.code === "PONTAJ_EXISTS") {
              // Pontajul există deja pentru această zi - probabil se încearcă editarea
              // Continuăm cu următorul angajat, deoarece pontajul există deja
              console.warn(`Pontaj există deja pentru ${p.name} în data ${date}`);
              alreadySaved.push(p._id); // Marchează ca deja salvat pentru a nu încerca din nou
              continue; // Nu continuăm cu salvarea pentru acest angajat
            }

            // Dacă este un 409 dar nu are un cod cunoscut, loghează și continuă cu următorul
            console.error("409 Conflict fără cod cunoscut:", errorData);
            setError(`Conflict la salvare pentru ${p.name}: ${errorData.error || "Eroare necunoscută"}`);
            continue; // Continuă cu următorul angajat în loc să oprească tot procesul
          } else {
            // Dacă nu e eroare 409, loghează și continuă cu următorul (nu oprește tot procesul)
            console.error("Eroare la salvare pontaj:", error);
            setError(`Eroare la salvare pentru ${p.name}: ${error.message || "Eroare necunoscută"}`);
            continue;
          }
        }
      }

      // Dacă există avertismente de concediu, afișăm modalul
      if (leaveWarnings.length > 0) {
        // Pentru simplitate, afișăm modalul pentru primul angajat cu concediu
        // (poți extinde pentru multiple angajați dacă e nevoie)
        const firstWarning = leaveWarnings[0];
        setLeaveWarningData({
          employee: firstWarning.employee,
          entry: firstWarning.entry,
          leave: firstWarning.leave,
          saveData: firstWarning.saveData,
          allWarnings: leaveWarnings, // Păstrăm toate pentru procesare ulterioară
        });
        setShowLeaveWarningModal(true);
        setSaving(false);
        return; // Oprește salvarea până când utilizatorul confirmă
      }

      // Dacă nu există avertismente, continuă cu salvarea normală pentru restul
      // Exclude și pe cei care au fost deja salvați cu succes sau au pontaj existent
      const toSaveWithoutWarnings = toSave.filter(
        ({ p }) => 
          !leaveWarnings.some((w) => w.employee._id === p._id) &&
          !alreadySaved.includes(p._id)
      );

      if (toSaveWithoutWarnings.length > 0) {
        const results = await Promise.allSettled(
          toSaveWithoutWarnings.map(async ({ p, e }) => {
            const isPrezent = allowsHoursInput(e.status);
            const hoursWorked = isPrezent && e.startTime && e.endTime
              ? calcWorkHours(e.startTime, e.endTime)
              : 0;

        // ✅ Determină statusul: dacă checkbox-ul pentru gardă este bifat, statusul devine "garda"
        // Dacă utilizatorul a bifat "ore de gardă" și statusul este "prezent", atunci statusul final devine "garda"
        const finalStatus = (e.status === "prezent" && e.isGarda) ? "garda" : e.status;

            const saveData: TimesheetFormData = {
              employeeId: p._id,
              workplaceId: selectedWorkplace,
              date,
              startTime: isPrezent ? (e.startTime || DEFAULTS.startTime) : DEFAULTS.startTime,
              endTime: isPrezent ? (e.endTime || DEFAULTS.endTime) : DEFAULTS.endTime,
              hoursWorked: hoursWorked,
              minutesWorked: 0,
              leaveType: statusToLeaveType(finalStatus),
              status: finalStatus === "garda" ? "garda" : undefined, // ✅ Trimite status doar pentru gardă
              force: false,
            };

            try {
              console.log("💾 SALVARE PONTAJ (toSaveWithoutWarnings):", {
                employeeId: p._id,
                employeeName: p.name,
                date,
                startTime: saveData.startTime,
                endTime: saveData.endTime,
                hoursWorked: saveData.hoursWorked,
                status: saveData.status,
                isGarda: e.isGarda,
                finalStatus,
              });
              await timesheetService.save(saveData);
              console.log("✅ PONTAJ SALVAT CU SUCCES (toSaveWithoutWarnings):", p.name);
              return { success: true, wasOverwritten: false };
            } catch (error: any) {
              console.error("❌ EROARE LA SALVARE (toSaveWithoutWarnings):", {
                employeeName: p.name,
                error: error.message,
                status: error.status,
                data: error.data,
              });
              return { success: false, error };
            }
          })
        );

        const failed = results.filter(
          (r) =>
            r.status === "rejected" || (r.status === "fulfilled" && !r.value?.success)
        );

        // Verifică dacă s-au suprascris pontaje existente
        const overwritten = results.filter(
          (r) =>
            r.status === "fulfilled" && 
            r.value?.success && 
            r.value.wasOverwritten === true
        );

        if (failed.length)
          setError(`S-au salvat parțial. ${failed.length} erori.`);
        else if (overwritten.length > 0) {
          setError("⚠️ Pontaj suprascris! Orele anterioare au fost înlocuite cu noile ore salvate.");
          // Șterge mesajul după 5 secunde și resetează flag-ul
          setTimeout(() => {
            setError("");
            isRefreshingAfterSave.current = false;
          }, 5000);
        } else {
          setSuccess("Pontaj salvat cu succes!");
          // Șterge mesajul după 3 secunde și resetează flag-ul
          setTimeout(() => {
            setSuccess("");
            isRefreshingAfterSave.current = false;
          }, 3000);
        }

        // Actualizează entries și monthWorkedHours doar pentru cei salvați cu succes
        const successful = toSaveWithoutWarnings.filter((_, idx) => {
          const result = results[idx];
          return result.status === "fulfilled" && 
                 result.value?.success === true;
        });

        // ✅ Actualizează entries INSTANT cu valorile salvate pentru a actualiza tabelul imediat
        setEntries((prev) => {
          const next = { ...prev };
          successful.forEach(({ p, e }) => {
            const cur = next[p._id] || {};
            next[p._id] = { 
              ...cur,
              // ✅ Actualizează cu valorile salvate
              startTime: e.startTime || cur.startTime,
              endTime: e.endTime || cur.endTime,
              status: e.status || cur.status,
              completed: true, 
              dirty: false,
              isGarda: e.isGarda || false, // ✅ Păstrăm isGarda
            };
          });
          return next;
        });

        // ✅ Forțează reîncărcarea INSTANT a datelor pentru a actualiza orele lunare și tabelul
        isRefreshingAfterSave.current = true; // Marchează că reîncărcarea este după salvare
        setRefreshKey((prev) => prev + 1); // Acest refresh va reîncărca datele instant
      } else if (alreadySaved.length > 0) {
        // Dacă toți angajații au fost deja salvați în primul loop, afișăm mesaj de succes
        setSuccess("Pontaj salvat cu succes!");
        // Șterge mesajul după 3 secunde și resetează flag-ul
        setTimeout(() => {
          setSuccess("");
          isRefreshingAfterSave.current = false;
        }, 3000);
        
        // Actualizează entries și monthWorkedHours pentru angajații salvați în primul loop
        const savedInFirstLoop = toSave.filter(({ p }) => alreadySaved.includes(p._id));
        
        // ✅ Actualizează entries INSTANT cu valorile salvate pentru a actualiza tabelul imediat
        setEntries((prev) => {
          const next = { ...prev };
          savedInFirstLoop.forEach(({ p, e }) => {
            const cur = next[p._id] || {};
            next[p._id] = { 
              ...cur,
              // ✅ Actualizează cu valorile salvate
              startTime: e.startTime || cur.startTime,
              endTime: e.endTime || cur.endTime,
              status: e.status || cur.status,
              completed: true, 
              dirty: false,
              isGarda: e.isGarda || false, // ✅ Păstrăm isGarda
            };
          });
          return next;
        });

        // ✅ Forțează reîncărcarea INSTANT a datelor pentru a actualiza orele lunare și tabelul
        isRefreshingAfterSave.current = true; // Marchează că reîncărcarea este după salvare
        setRefreshKey((prev) => prev + 1); // Acest refresh va reîncărca datele instant
      }

      // ✅ după save, forțăm reîncărcarea pontajului ca să apară vizitatorii și după refresh logic
      // Nu mai facem setRefreshKey aici pentru că am făcut-o deja mai sus
    } catch (e) {
      console.error(e);
      setError("Eroare la salvare.");
    } finally {
      setSaving(false);
    }
  };

  // ✅ Funcție pentru ștergerea pontajului
  const handleDeletePontaj = async () => {
    if (!deletePontajData) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const { employee, date } = deletePontajData;

      await timesheetService.delete(employee._id, date);

      setSuccess(`Pontaj șters cu succes pentru ${employee.name}`);
      // Șterge mesajul după 3 secunde
      setTimeout(() => setSuccess(""), 3000);
      
      // Actualizează entries pentru a elimina completed flag și a permite salvarea din nou
      setEntries((prev) => {
        const next = { ...prev };
        const cur = next[employee._id] || {};
        // Păstrăm datele existente (status, startTime, endTime) dar marcăm ca dirty pentru a permite salvarea
        next[employee._id] = { 
          ...cur, 
          completed: false, 
          dirty: true, // ✅ Setăm dirty: true pentru a activa butonul de salvare
          pontajId: null, // ✅ Ștergem pontajId pentru că pontajul a fost șters
        };
        return next;
      });

      // ✅ Actualizează monthWorkedHours pentru a elimina orele din calcul
      setMonthWorkedMins((prev) => {
        const next = { ...prev };
        // Nu resetăm complet, doar marcăm că trebuie recalculat
        // (se va recalcula automat când se reîncarcă datele)
        return next;
      });

      // ✅ NU facem refresh imediat pentru a păstra entry-ul cu dirty: true
      // Refresh-ul se va face automat când utilizatorul modifică ceva sau când se schimbă data
      // setRefreshKey((prev) => prev + 1);

      // Închide modalul
      setShowDeletePontajModal(false);
      setDeletePontajData(null);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Eroare la ștergerea pontajului");
    } finally {
      setSaving(false);
    }
  };

  /** ============== ROWS ============== */
  // ✅ Map cu informații despre unde a fost pontat fiecare vizitator
  // IMPORTANT: Stocăm doar vizitatorii care au fost pontați la ALTE farmacii (nu la farmacia curentă)
  const visitorInfoMap = useMemo(() => {
    const map = new Map<string, { workplaceName: string; date: string; workplaceId: string | { _id: string } }>();
    if (!selectedWorkplace) return map;
    
    pontajList.forEach((p) => {
      const empId = typeof p.employeeId === 'object' && p.employeeId?._id 
        ? String(p.employeeId._id) 
        : typeof p.employeeId === 'string' 
        ? p.employeeId 
        : null;
      if (!empId || p.type !== "visitor") return;
      
      // ✅ IMPORTANT: Verificăm că pontajul de vizitator este la o altă farmacie decât farmacia curentă
      // Dacă pontajul este la farmacia curentă, înseamnă că este un vizitator care lucrează aici, nu un angajat al farmaciei curente care lucrează altundeva
      if (String(p.workplaceId) === String(selectedWorkplace)) {
        return; // Skip - acesta este un vizitator care lucrează în farmacia curentă, nu un angajat al farmaciei curente care lucrează altundeva
      }
      
      // Normalizează data (este string "YYYY-MM-DD")
      let d = "";
      if (p.date) {
        try {
          if (/^\d{4}-\d{2}-\d{2}$/.test(p.date)) {
            d = p.date;
          } else {
            const dateObj = new Date(p.date);
            d = dateObj.toISOString().slice(0, 10);
          }
        } catch (err) {
          d = String(p.date).slice(0, 10);
        }
      }
      
      // Dacă este pentru ziua curentă, stocăm informațiile
      if (d === date) {
        map.set(empId, {
          workplaceName: p.workplaceName || "Farmacie necunoscută",
          date: d,
          workplaceId: p.workplaceId,
        });
      }
    });
    return map;
  }, [pontajList, date, selectedWorkplace]);

  const rows = useMemo(() => {
    return allPeople.map((emp) => {
      const e = safeEntry(emp._id);

      const isPrezent = allowsHoursInput(e.status);
      const timesDisabled = !isPrezent;

      const hoursWorkedToday = isPrezent && e.startTime && e.endTime
        ? calcWorkHours(e.startTime, e.endTime)
        : 0;

      const targetHours = Number(emp.monthlyTargetHours ?? 0);

      const monthHoursFromDb = monthWorkedHours[emp._id] || 0;

      const projectedMonthHours =
        monthHoursFromDb + (e.completed ? 0 : hoursWorkedToday);
      const remainingHours = Math.max(0, targetHours - projectedMonthHours);

      // ✅ Informații despre vizitator pentru tooltip
      const visitorInfo = visitorInfoMap.get(String(emp._id));
      const visitorTooltip = visitorInfo 
        ? `Acest utilizator a fost pontat la farmacia ${visitorInfo.workplaceName} în data de ${new Date(visitorInfo.date).toLocaleDateString('ro-RO')}`
        : "Vizitator";

      // ✅ Verifică dacă angajatul este din farmacia curentă și a fost pontat ca vizitator la altă farmacie
      // Dacă da, dezactivează toate câmpurile
      const isEmployeeFromCurrentWorkplace = employees.some((e) => String(e._id) === String(emp._id));
      const isPontedAsVisitorElsewhere = visitorInfo && isEmployeeFromCurrentWorkplace;
      
      // ✅ Status-ul trebuie să fie activ (except când e vizitator pontat altundeva) pentru a putea selecta "prezent"
      // Câmpurile de timp sunt dezactivate dacă e vizitator pontat altundeva SAU dacă statusul nu este "prezent"
      const statusDisabled = isPontedAsVisitorElsewhere;
      const timeFieldsDisabled = isPontedAsVisitorElsewhere || timesDisabled;

      return (
        <tr key={emp._id} className={`hover:bg-slate-50 ${isPontedAsVisitorElsewhere ? 'opacity-60' : ''}`}>
          <td className="px-6 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">
                  {emp.name || "-"}
                  {e.isVisitor && (
                    <span 
                      className="ml-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md cursor-help"
                      title={visitorTooltip}
                    >
                      Vizitator
                    </span>
                  )}
                  {isPontedAsVisitorElsewhere && (
                    <span 
                      className="ml-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md"
                      title="Acest angajat a fost deja pontat ca vizitator la altă farmacie. Câmpurile nu pot fi modificate."
                    >
                      Pontat ca vizitator
                    </span>
                  )}
                </div>
                {emp.email && (
                  <div className="text-xs text-slate-500 truncate">
                    {emp.email}
                  </div>
                )}
              </div>

              {e.isVisitor && !isPontedAsVisitorElsewhere && (
                <button
                  onClick={() => {
                    // Dacă e vizitator salvat (din DB), îl ascundem temporar
                    // Dacă e vizitator manual, îl ștergem complet
                    if (visitorsFromDb.some((v) => v._id === emp._id)) {
                      hideVisitorFromDb(emp._id);
                    } else {
                      removeVisitor(emp._id);
                    }
                  }}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs hover:bg-slate-100"
                  title={
                    visitorsFromDb.some((v) => v._id === emp._id)
                      ? "Ascunde vizitatorul din listă (va reapărea la refresh sau când se reîncarcă datele pentru această zi)"
                      : "Scoate vizitatorul din listă (nu este salvat în pontaj)"
                  }
                >
                  {visitorsFromDb.some((v) => v._id === emp._id) ? "Ascunde" : "Scoate"}
                </button>
              )}
            </div>
          </td>

          <td className="px-6 py-3 whitespace-nowrap">
            <span
              className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-semibold border ${
                e.completed
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-slate-50 text-slate-600 border-slate-200"
              }`}
            >
              {e.completed ? "Completat" : "Necompletat"}
            </span>
          </td>

          <td className="px-6 py-3 whitespace-nowrap">
            <select
              value={e.status || DEFAULTS.status}
              onChange={(ev) =>
                updateEntry(emp._id, { status: ev.target.value })
              }
              disabled={statusDisabled}
              className={`w-40 border border-slate-200 rounded-lg px-3 py-2 text-sm transition-colors ${
                statusDisabled 
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                  : 'bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500'
              }`}
              title={isPontedAsVisitorElsewhere ? "Acest angajat a fost deja pontat ca vizitator la altă farmacie. Câmpurile nu pot fi modificate." : undefined}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </td>

          <td className="px-6 py-3 whitespace-nowrap">
            <TimePicker
              value={e.startTime || DEFAULTS.startTime}
              onChange={(t) => updateEntry(emp._id, { startTime: t })}
              disabled={timeFieldsDisabled}
            />
          </td>

          <td className="px-6 py-3 whitespace-nowrap">
            <TimePicker
              value={e.endTime || DEFAULTS.endTime}
              onChange={(t) => updateEntry(emp._id, { endTime: t })}
              disabled={timeFieldsDisabled}
            />
          </td>

          <td className="px-6 py-3 whitespace-nowrap">
            {isPrezent && (
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={e.isGarda || false}
                  onChange={(ev) => updateEntry(emp._id, { isGarda: ev.target.checked })}
                  disabled={timeFieldsDisabled}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className={`text-xs font-medium ${timeFieldsDisabled ? 'text-slate-400' : 'text-slate-700 group-hover:text-slate-900'}`}>
                  Gardă
                </span>
              </label>
            )}
          </td>

          <td className="px-6 py-3 whitespace-nowrap">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-semibold border ${
                  e.isGarda && isPrezent
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : isPrezent
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-50 text-slate-600 border-slate-200"
                }`}
                title={e.isGarda && isPrezent ? `Ore lucrate de gardă: ${hoursWorkedToday}h - ${emp.name} - ${new Date(date).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" })}` : undefined}
              >
                {hoursWorkedToday > 0 ? `${hoursWorkedToday}h` : "-"}
                {e.isGarda && isPrezent && (
                  <span className="ml-1 text-xs">🛡️</span>
                )}
              </span>
              {e.completed && !isPontedAsVisitorElsewhere && (
                <button
                  onClick={() => {
                    setDeletePontajData({
                      employee: emp,
                      date: date,
                    });
                    setShowDeletePontajModal(true);
                  }}
                  className="px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 border border-red-200 rounded transition-colors"
                  title="Șterge pontajul pentru această zi"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </td>

          <td className="px-6 py-3 whitespace-nowrap">
            <span
              className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-semibold border bg-slate-50 text-slate-700 border-slate-200"
              title={
                targetHours
                  ? `Target: ${targetHours}h / Luna`
                  : "Setează monthlyTargetHours"
              }
            >
              {targetHours ? `${remainingHours}h` : "—"}
            </span>
          </td>
        </tr>
      );
    });
  }, [allPeople, safeEntry, updateEntry, monthWorkedHours, removeVisitor, employees, visitorInfoMap, visitorsFromDb, hideVisitorFromDb]);

  const selectedWorkplaceName = useMemo(() => {
    return workplaces.find((w) => w._id === selectedWorkplace)?.name || "—";
  }, [workplaces, selectedWorkplace]);

  const showWorkplaceDropdown = !effectiveLockedWorkplaceId; // superadmin only

  return (
    <div className="w-full">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 pt-6 pb-5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-semibold text-slate-900">Pontaj</h1>
            {isBusy && (
              <span className="text-xs text-slate-500 flex items-center gap-2">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-b-transparent" />
                Se încarcă…
              </span>
            )}
          </div>

          <div className="mt-3 mb-4 flex flex-col lg:flex-row lg:items-end gap-3">
            <div className="flex-1 min-w-0">
              {showWorkplaceDropdown ? (
                <>
                  <label className="block text-xs text-slate-600 mb-1">
                    Farmacie
                  </label>
                  <select
                    value={selectedWorkplace}
                    onChange={(e) => setSelectedWorkplace(e.target.value)}
                    className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  >
                    <option value="">
                      {loadingW ? "Se încarcă..." : "Selectează o farmacie"}
                    </option>
                    {workplaces.map((w) => (
                      <option key={w._id} value={w._id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <div className="text-sm text-slate-700">
                  <span className="text-xs text-slate-500 block mb-1">
                    Farmacie
                  </span>
                  <div className="px-3 py-2 border border-slate-200 rounded-lg bg-white">
                    {selectedWorkplaceName}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">Data</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-[170px] border border-slate-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setDate(new Date().toISOString().slice(0, 10))}
                  className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
                >
                  Azi
                </button>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="px-6 py-3 border-b border-red-200 bg-red-50">
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        )}
        {success && (
          <div className="px-6 py-3 border-b border-emerald-200 bg-emerald-50">
            <p className="text-sm font-medium text-emerald-800">{success}</p>
          </div>
        )}

        <div className="p-6">
          {allPeople.length === 0 ? (
            <div className="py-10 text-center">
              <div className="text-lg font-semibold text-slate-900">
                Nu există angajați
              </div>
              <div className="text-sm text-slate-500 mt-1">
                Selectează o farmacie cu utilizatori.
              </div>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
                <table className="w-full table-auto">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 w-[25%]">
                        Angajat
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 w-[12%]">
                        Pontaj
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 w-[12%]">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 w-[13%]">
                        Intrare
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 w-[13%]">
                        Ieșire
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 w-[10%]">
                        Ore
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 w-[15%]">
                        Rămase luna
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">{rows}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="relative inline-flex items-start">
            <AddVisitor
              items={allEmployeesForPicker}
              excludeIds={excludeIds}
              onPick={addVisitorManual}
              disabled={!selectedWorkplace || isBusy}
              label="+ Adaugă vizitator"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className={`px-5 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${
              canSave && !saving
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-slate-200 text-slate-500 cursor-not-allowed"
            }`}
          >
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Salvez…
              </>
            ) : (
              "Salvează"
            )}
          </button>
        </div>
      </div>

      {/* MODAL AVERTISMENT CONCEDIU APROBAT */}
      {showLeaveWarningModal && leaveWarningData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              ⚠️ Avertisment: Concediu aprobat
            </h3>
            <div className="mb-4">
              <p className="text-sm text-slate-600 mb-3">
                Utilizatorul <span className="font-semibold text-slate-900">
                  {leaveWarningData.employee?.name || "Necunoscut"}
                </span> figurează ca având concediu aprobat în perioada selectată.
              </p>
              {leaveWarningData.leave && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                  <p className="text-xs font-semibold text-amber-800 mb-1">
                    Detalii concediu:
                  </p>
                  <p className="text-xs text-amber-700">
                    <span className="font-medium">Tip:</span>{" "}
                    {leaveWarningData.leave.type === "odihna"
                      ? "Concediu de odihnă"
                      : leaveWarningData.leave.type === "medical"
                      ? "Concediu medical"
                      : leaveWarningData.leave.type === "fara_plata"
                      ? "Concediu fără plată"
                      : leaveWarningData.leave.type === "eveniment"
                      ? "Concediu pentru eveniment"
                      : leaveWarningData.leave.type}
                  </p>
                  <p className="text-xs text-amber-700">
                    <span className="font-medium">Perioadă:</span>{" "}
                    {leaveWarningData.leave.startDate
                      ? new Date(leaveWarningData.leave.startDate)
                          .toLocaleDateString("ro-RO")
                      : "—"}{" "}
                    –{" "}
                    {leaveWarningData.leave.endDate
                      ? new Date(leaveWarningData.leave.endDate)
                          .toLocaleDateString("ro-RO")
                      : "—"}
                  </p>
                  {leaveWarningData.leave.days && (
                    <p className="text-xs text-amber-700">
                      <span className="font-medium">Zile:</span>{" "}
                      {leaveWarningData.leave.days}
                    </p>
                  )}
                </div>
              )}
              <p className="text-sm text-slate-600 mb-3">
                Angajatul are concediu aprobat în perioada selectată. Doriți să continuați cu salvarea pontajului?
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  <span className="font-semibold">Sugestie:</span> Pentru a ponta acest angajat, accesează <span className="font-medium">"Istoric cereri"</span> din meniu, șterge cererea de concediu pentru această perioadă, apoi încearcă din nou să salvezi pontajul.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={handleCancelLeaveWarning}
                className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-sm font-medium transition-colors"
              >
                Anulează
              </button>
              <button
                type="button"
                onClick={handleConfirmLeaveWarning}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors"
              >
                DA, continuă
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ȘTERGERE PONTAJ */}
      {showDeletePontajModal && deletePontajData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              ⚠️ Șterge pontaj
            </h3>
            <div className="mb-4">
              <p className="text-sm text-slate-700 mb-4">
                Ești sigur că vrei să ștergi pontajul pentru:
              </p>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 mb-4">
                <p className="font-bold text-slate-900 text-lg mb-1">
                  {deletePontajData.employee?.name || "Necunoscut"}
                </p>
                <div className="flex items-center gap-4 text-sm text-slate-600 mt-2">
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>
                      {new Date(deletePontajData.date).toLocaleDateString('ro-RO')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs text-red-800 font-semibold mb-2">
                  ⚠️ Atenție: Această acțiune va:
                </p>
                <ul className="text-xs text-red-700 space-y-1 ml-4 list-disc">
                  <li>Șterge definitiv pontajul pentru această zi</li>
                  <li>Nu poate fi anulată</li>
                </ul>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setShowDeletePontajModal(false);
                  setDeletePontajData(null);
                }}
                disabled={saving}
                className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-sm font-medium transition-colors disabled:opacity-50"
              >
                Anulează
              </button>
              <button
                type="button"
                onClick={handleDeletePontaj}
                disabled={saving}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Șterge...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Șterge definitiv
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AVERTISMENT VIZITATOR DEJA PONTAT */}
      {showVisitorAlreadyPontedModal && visitorAlreadyPontedData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              ⚠️ Avertisment: Vizitator deja pontat
            </h3>
            <div className="mb-4">
              <p className="text-sm text-slate-600 mb-3">
                Utilizatorul <span className="font-semibold text-slate-900">
                  {visitorAlreadyPontedData.employee?.name || "Necunoscut"}
                </span> a fost deja pontat ca vizitator la altă farmacie în această zi.
              </p>
              {visitorAlreadyPontedData.visitorEntry && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                  <p className="text-xs font-semibold text-amber-800 mb-1">
                    Detalii pontaj existent:
                  </p>
                  <p className="text-xs text-amber-700">
                    <span className="font-medium">Farmacie:</span>{" "}
                    {visitorAlreadyPontedData.visitorEntry.workplaceName || "Farmacie necunoscută"}
                  </p>
                  <p className="text-xs text-amber-700">
                    <span className="font-medium">Data:</span>{" "}
                    {visitorAlreadyPontedData.visitorEntry.date
                      ? new Date(visitorAlreadyPontedData.visitorEntry.date).toLocaleDateString("ro-RO")
                      : new Date(date).toLocaleDateString("ro-RO")}
                  </p>
                </div>
              )}
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs text-red-800 font-semibold mb-2">
                  ⚠️ Pontajul nu poate fi salvat!
                </p>
                <p className="text-xs text-red-700">
                  Acest angajat a fost deja pontat ca vizitator la farmacia <span className="font-medium">{visitorAlreadyPontedData.visitorEntry?.workplaceName || "altă farmacie"}</span> în această zi. Nu este posibil să se suprapună orele sau să se forțeze salvarea.
                </p>
                <p className="text-xs text-red-700 mt-2">
                  <span className="font-semibold">Soluție:</span> Contactează farmacia <span className="font-medium">{visitorAlreadyPontedData.visitorEntry?.workplaceName || "unde a fost pontat"}</span> pentru a șterge pontajul de vizitator, apoi încearcă din nou să salvezi pontajul.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setShowVisitorAlreadyPontedModal(false);
                  setVisitorAlreadyPontedData(null);
                  setSaving(false);
                }}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors"
              >
                Înțeleg
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PontajDashboard;
