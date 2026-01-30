// import React, { useEffect, useState } from "react";
// import { useLocation, useNavigate } from "react-router-dom";
// import PontajDashboard from "../../pontaj/PontajDashboard";
// import UsersManagementPanel from "./UserManagementPanel";
// const API = "http://localhost:5000";

// const AdminFarmacieDashboard = () => {
//   const location = useLocation();
//   const navigate = useNavigate();

//   const loggedUser = location.state?.user || null;
//   const workplaceName = loggedUser?.workplaceId?.name || "";

//   // VIEW STATES
//   const [activeTab, setActiveTab] = useState("toate");
//   const [showForm, setShowForm] = useState(false);
//   const [usersView, setUsersView] = useState(false);
//   const [showPontaj, setShowPontaj] = useState(false);

//   // DATA
//   const [workplaces, setWorkplaces] = useState([]);
//   const [selectedWorkplace, setSelectedWorkplace] = useState("");
//   const [employees, setEmployees] = useState([]);
//   const [leaves, setLeaves] = useState([]);

//   // EDIT STATES
//   const [editingLeave, setEditingLeave] = useState(null);

//   // FORMS
//   const [formData, setFormData] = useState({
//     employeeId: "",
//     function: "",
//     startDate: "",
//     endDate: "",
//     days: "",
//     type: "",
//     reason: "",
//   });

//   /* ===================== LOAD FARMACII ===================== */
//   useEffect(() => {
//     const loadWorkplaces = async () => {
//       try {
//         const res = await fetch(`${API}/api/workplaces`);
//         const data = await res.json();
//         const list = Array.isArray(data) ? data : [];
//         setWorkplaces(list);
//         if (list.length) setSelectedWorkplace(list[0]._id);
//       } catch (err) {
//         console.error("Eroare farmacii:", err);
//       }
//     };
//     loadWorkplaces();
//   }, []);

//   /* ================= LOAD ANGAJAȚI + CERERI ================= */
//   useEffect(() => {
//     if (!selectedWorkplace) return;

//     const loadData = async () => {
//       try {
//         const empRes = await fetch(
//           `${API}/api/users/by-workplace/${selectedWorkplace}`
//         );
//         const empData = await empRes.json();
//         setEmployees(Array.isArray(empData) ? empData : []);

//         const leaveRes = await fetch(
//           `${API}/api/leaves/by-workplace/${selectedWorkplace}`
//         );
//         const leaveData = await leaveRes.json();
//         setLeaves(Array.isArray(leaveData) ? leaveData : []);
//       } catch (err) {
//         console.error("Eroare încărcare date:", err);
//       }
//     };

//     loadData();
//   }, [selectedWorkplace]);

//   /* ===================== CERERI ===================== */
//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     if (!selectedWorkplace) {
//       alert("Selectează farmacia!");
//       return;
//     }

//     const payload = {
//       employeeId: formData.employeeId,
//       workplaceId: selectedWorkplace,
//       function: formData.function,
//       startDate: formData.startDate,
//       endDate: formData.endDate,
//       days: Number(formData.days),
//       type: formData.type,
//       reason: formData.reason,
//     };

//     const isEdit = !!editingLeave;
//     const url = isEdit
//       ? `${API}/api/leaves/${editingLeave._id}`
//       : `${API}/api/leaves/create`;
//     const method = isEdit ? "PUT" : "POST";

//     try {
//       const res = await fetch(url, {
//         method,
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(payload),
//       });
//       if (!res.ok) throw new Error();

//       const updated = await fetch(
//         `${API}/api/leaves/by-workplace/${selectedWorkplace}`
//       );
//       const updatedLeaves = await updated.json();
//       setLeaves(Array.isArray(updatedLeaves) ? updatedLeaves : []);

//       setFormData({
//         employeeId: "",
//         function: "",
//         startDate: "",
//         endDate: "",
//         days: "",
//         type: "",
//         reason: "",
//       });
//       setEditingLeave(null);
//       setShowForm(false);
//       setActiveTab("in_asteptare");
//     } catch (err) {
//       console.error("Eroare server:", err);
//       alert("Eroare la salvarea cererii!");
//     }
//   };

//   const deleteLeave = async (leave) => {
//     if (leave.status !== "În așteptare") {
//       alert("Poți șterge doar cererile în așteptare!");
//       return;
//     }
//     if (!window.confirm("Sigur ștergi această cerere?")) return;

//     try {
//       const res = await fetch(`${API}/api/leaves/${leave._id}`, {
//         method: "DELETE",
//       });
//       if (!res.ok) throw new Error();
//       setLeaves((prev) => prev.filter((l) => l._id !== leave._id));
//     } catch (err) {
//       console.error(err);
//       alert("Eroare la ștergere!");
//     }
//   };

//   const startEditLeave = (leave) => {
//     if (leave.status !== "În așteptare") {
//       alert("Poți edita doar cererile în așteptare!");
//       return;
//     }
//     setEditingLeave(leave);
//     setFormData({
//       employeeId: leave.employeeId?._id || "",
//       function: leave.function || "",
//       startDate: leave.startDate?.slice(0, 10) || "",
//       endDate: leave.endDate?.slice(0, 10) || "",
//       days: leave.days?.toString() || "",
//       type: leave.type || "",
//       reason: leave.reason || "",
//     });
//     setShowForm(true);
//     setUsersView(false);
//     setShowPontaj(false);
//   };

//   /* ===================== FILTERS ===================== */
//   const filteredLeaves = leaves.filter((r) => {
//     if (activeTab === "toate") return true;
//     if (activeTab === "aprobate") return r.status === "Aprobată";
//     if (activeTab === "respinse") return r.status === "Respinsă";
//     if (activeTab === "in_asteptare") return r.status === "În așteptare";
//     return true;
//   });

//   const getTabClasses = (tab) =>
//     `w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
//       activeTab === tab ? "bg-slate-200" : "text-slate-700 hover:bg-slate-100"
//     }`;

//   /* ===================== RENDER ===================== */
//   return (
//     <div className="min-h-screen bg-slate-50 flex justify-center p-6">
//       <div className="w-full max-w-7xl bg-white border border-slate-200 shadow-sm rounded-2xl flex h-[calc(100vh-3rem)] overflow-hidden">
//         {/* SIDEBAR */}
//         <aside className="w-60 shrink-0 border-r border-slate-200 bg-slate-50 px-4 py-6 flex flex-col gap-6">
//           <img
//             src="/logo.svg"
//             alt="Remedium Logo"
//             className="w-30 mx-auto mb-2 opacity-90"
//           />

//           <div className="text-center">
//             <h2 className="text-sm font-semibold text-slate-900 mb-1">
//               Admin Farmacie
//             </h2>
//             <p className="text-xs text-slate-500">
//               {workplaceName || "Farmacie nedefinită"}
//             </p>
//           </div>

//           <button
//             className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
//             onClick={() => {
//               setShowForm(true);
//               setUsersView(false);
//               setShowPontaj(false);
//               setEditingLeave(null);
//             }}
//           >
//             Cerere nouă concediu
//           </button>

//           <button
//             className="w-full px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
//             onClick={() => {
//               setUsersView(true);
//               setShowForm(false);
//               setShowPontaj(false);
//               setEditingLeave(null);
//             }}
//           >
//             Gestionează utilizatori
//           </button>

//           {/* BUTON PONTAJ */}
//           <button
//             className="w-full px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
//             onClick={() => {
//               setShowPontaj(true);
//               setUsersView(false);
//               setShowForm(false);
//               setEditingLeave(null);
//             }}
//           >
//             Pontaj
//           </button>

//           {/* BUTON PLANIFICARE */}
//           <button
//             className="w-full px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
//             onClick={() =>
//               navigate("/planificare", { state: { user: loggedUser } })
//             }
//           >
//             Planificare
//           </button>

//           <nav className="space-y-2 pt-2 border-t border-slate-200">
//             <button
//               className={getTabClasses("toate")}
//               onClick={() => {
//                 setActiveTab("toate");
//                 setUsersView(false);
//                 setShowPontaj(false);
//               }}
//             >
//               Istoric cereri
//             </button>
//             <button
//               className={getTabClasses("aprobate")}
//               onClick={() => {
//                 setActiveTab("aprobate");
//                 setUsersView(false);
//                 setShowPontaj(false);
//               }}
//             >
//               Cereri aprobate
//             </button>
//             <button
//               className={getTabClasses("respinse")}
//               onClick={() => {
//                 setActiveTab("respinse");
//                 setUsersView(false);
//                 setShowPontaj(false);
//               }}
//             >
//               Cereri respinse
//             </button>
//             <button
//               className={getTabClasses("in_asteptare")}
//               onClick={() => {
//                 setActiveTab("in_asteptare");
//                 setUsersView(false);
//                 setShowPontaj(false);
//               }}
//             >
//               Cereri în așteptare
//             </button>
//           </nav>
//         </aside>

//         {/* MAIN */}
//         <main className="flex-1 p-8 overflow-y-auto box-border">
//           {showPontaj ? (
//             <PontajDashboard />
//           ) : usersView ? (
//             <UsersManagementPanel
//               API={API}
//               selectedWorkplace={selectedWorkplace}
//               setSelectedWorkplace={setSelectedWorkplace}
//               workplaces={workplaces}
//             />
//           ) : (
//             <section>
//               {showForm && (
//                 <div className="border border-slate-200 bg-slate-50 rounded-xl p-6 mb-8">
//                   <h3 className="text-md font-semibold mb-4">
//                     {editingLeave
//                       ? "Editează cerere concediu"
//                       : "Cerere nouă concediu"}
//                   </h3>

//                   <form
//                     className="grid grid-cols-1 md:grid-cols-3 gap-4"
//                     onSubmit={handleSubmit}
//                   >
//                     <select
//                       className="w-full border px-3 py-2 rounded"
//                       value={selectedWorkplace}
//                       onChange={(e) => setSelectedWorkplace(e.target.value)}
//                       required
//                     >
//                       <option value="">Selectează farmacia</option>
//                       {workplaces.map((w) => (
//                         <option key={w._id} value={w._id}>
//                           {w.name}
//                         </option>
//                       ))}
//                     </select>

//                     <select
//                       className="w-full border px-3 py-2 rounded"
//                       value={formData.employeeId}
//                       onChange={(e) =>
//                         setFormData({ ...formData, employeeId: e.target.value })
//                       }
//                       required
//                     >
//                       <option value="">Selectează angajat</option>
//                       {employees.map((e) => (
//                         <option key={e._id} value={e._id}>
//                           {e.name}
//                         </option>
//                       ))}
//                     </select>

//                     <select
//                       className="border px-3 py-2 rounded"
//                       value={formData.function}
//                       onChange={(e) =>
//                         setFormData({ ...formData, function: e.target.value })
//                       }
//                       required
//                     >
//                       <option value="">Selectează funcția</option>
//                       <option value="Farmacist">Farmacist</option>
//                       <option value="Farmacist Șef">Farmacist Șef</option>
//                       <option value="Asistent">Asistent</option>
//                     </select>

//                     <input
//                       type="date"
//                       className="border px-3 py-2 rounded"
//                       value={formData.startDate}
//                       onChange={(e) =>
//                         setFormData({ ...formData, startDate: e.target.value })
//                       }
//                       required
//                     />

//                     <input
//                       type="date"
//                       className="border px-3 py-2 rounded"
//                       value={formData.endDate}
//                       onChange={(e) =>
//                         setFormData({ ...formData, endDate: e.target.value })
//                       }
//                       required
//                     />

//                     <input
//                       type="number"
//                       className="border px-3 py-2 rounded"
//                       placeholder="Zile"
//                       value={formData.days}
//                       onChange={(e) =>
//                         setFormData({ ...formData, days: e.target.value })
//                       }
//                       required
//                     />

//                     <select
//                       className="border px-3 py-2 rounded"
//                       value={formData.type}
//                       onChange={(e) =>
//                         setFormData({ ...formData, type: e.target.value })
//                       }
//                       required
//                     >
//                       <option value="">Tip concediu</option>
//                       <option value="odihna">Concediu de odihnă</option>
//                       <option value="medical">Concediu medical</option>
//                       <option value="eveniment">Eveniment special</option>
//                       <option value="fara_plata">Fără plată</option>
//                     </select>

//                     <textarea
//                       className="md:col-span-3 border px-3 py-2 rounded"
//                       placeholder="Motiv"
//                       value={formData.reason}
//                       onChange={(e) =>
//                         setFormData({ ...formData, reason: e.target.value })
//                       }
//                       required
//                     />

//                     <div className="md:col-span-3 flex justify-end gap-3">
//                       <button
//                         type="button"
//                         className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
//                         onClick={() => {
//                           setShowForm(false);
//                           setEditingLeave(null);
//                           setFormData({
//                             employeeId: "",
//                             function: "",
//                             startDate: "",
//                             endDate: "",
//                             days: "",
//                             type: "",
//                             reason: "",
//                           });
//                         }}
//                       >
//                         Anulează
//                       </button>
//                       <button
//                         type="submit"
//                         className="px-5 py-2 bg-slate-900 text-white rounded"
//                       >
//                         {editingLeave
//                           ? "Salvează modificările"
//                           : "Trimite cererea"}
//                       </button>
//                     </div>
//                   </form>
//                 </div>
//               )}

//               {filteredLeaves.length === 0 ? (
//                 <p className="text-sm text-slate-500">Nu există cereri.</p>
//               ) : (
//                 <div className="border border-slate-200 rounded-xl divide-y bg-white">
//                   {filteredLeaves.map((req) => (
//                     <div
//                       key={req._id}
//                       className="flex justify-between px-4 py-3 items-center"
//                     >
//                       <div>
//                         <p>
//                           <b>{req.employeeId?.name}</b>
//                         </p>
//                         <p>
//                           {req.startDate} – {req.endDate}
//                         </p>
//                         <p>{req.reason}</p>
//                       </div>
//                       <div className="flex items-center gap-3">
//                         <span>{req.status}</span>
//                         {req.status === "În așteptare" && (
//                           <div className="flex gap-2">
//                             <button
//                               className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
//                               onClick={() => startEditLeave(req)}
//                             >
//                               Editează
//                             </button>
//                             <button
//                               className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
//                               onClick={() => deleteLeave(req)}
//                             >
//                               Șterge
//                             </button>
//                           </div>
//                         )}
//                       </div>
//                     </div>
//                   ))}
//                 </div>
//               )}
//             </section>
//           )}
//         </main>
//       </div>
//     </div>
//   );
// };

// export default AdminFarmacieDashboard;

import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import TimesheetViewer from "../../pontaj/TimesheetViewer";
import PlanificareLunaraDashboard from "../../pontaj/PlanificareLunaraDashboard";
import UsersManagementPanel from "./UserManagementPanel";
import Concediu from "./Concediu";
import UserGuide from "./UserGuide";

// Folosește variabile de mediu pentru URL-ul backend-ului
const getApiUrl = () => {
  const url = import.meta.env.VITE_API_URL || "http://localhost:5000";
  return url.replace(/\/$/, ""); // Elimină slash-ul final
};
const API = getApiUrl();

const AdminFarmacieDashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // ✅ user din router state SAU fallback din localStorage (când dai refresh)
  const loggedUser = useMemo(() => {
    const fromState = location.state?.user || null;
    if (fromState) return fromState;

    try {
      const ls = localStorage.getItem("user");
      return ls ? JSON.parse(ls) : null;
    } catch {
      return null;
    }
  }, [location.state]);

  // ✅ workplaceId trebuie să fie STRING (exact cum îl pui în Login)
  const lockedWorkplaceId = useMemo(() => {
    return loggedUser?.workplaceId?._id || loggedUser?.workplaceId || "";
  }, [loggedUser]);

  // VIEW STATES
  const [activeTab, setActiveTab] = useState("toate");
  const [usersView, setUsersView] = useState(false);
  const [showPontaj, setShowPontaj] = useState(false);
  const [showPlanificare, setShowPlanificare] = useState(false);

  // UI: show create form e în Concediu
  const [openNewLeave, setOpenNewLeave] = useState(false);
  
  // ✅ Refresh key pentru forțarea reîncărcării cererilor după ștergerea unui user
  const [leavesRefreshKey, setLeavesRefreshKey] = useState(0);

  // DATA: doar pentru afișare nume farmacie (sidebar) + eventual listă
  const [workplaces, setWorkplaces] = useState([]);
  const [workplaceName, setWorkplaceName] = useState("");

  // ✅ setăm selectedWorkplace fix pe farmacia userului logat
  const [selectedWorkplace, setSelectedWorkplace] = useState(lockedWorkplaceId);

  // ✅ dacă nu avem user, îl scoatem la login
  useEffect(() => {
    if (!loggedUser) navigate("/", { replace: true });
  }, [loggedUser, navigate]);

  // ✅ de fiecare dată când se schimbă userul logat, blocăm farmacia pe workplaceId-ul lui
  useEffect(() => {
    setSelectedWorkplace(lockedWorkplaceId);
    setUsersView(false);
    setShowPontaj(false);
    setShowPlanificare(false);
    setActiveTab("toate");
    setOpenNewLeave(false);
  }, [lockedWorkplaceId]);

  // ✅ load workplaces ca să putem afla numele farmaciei (și pt dropdown dacă vrei)
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await fetch(`${API}/api/workplaces`, {
          credentials: "include",
        });
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        if (!alive) return;

        setWorkplaces(list);

        const found = list.find((w) => w._id === lockedWorkplaceId);
        setWorkplaceName(found?.name || "");
      } catch (err) {
        console.error("Eroare farmacii:", err);
      }
    })();

    return () => {
      alive = false;
    };
  }, [lockedWorkplaceId]);

  const getTabClasses = (tab) =>
    `w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
      activeTab === tab ? "bg-slate-200" : "text-slate-700 hover:bg-slate-100"
    }`;

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
                Admin Farmacie
              </h2>
              <p className="text-xs text-emerald-600 font-medium">
                {workplaceName || "Farmacie nedefinită"}
              </p>
            </div>
          </div>

          {/* BUTON PRINCIPAL - CERERE NOUĂ */}
          <button
            className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white text-sm font-semibold hover:from-emerald-700 hover:to-green-700 transition-all duration-200 shadow-md hover:shadow-emerald-500/50 flex items-center justify-center gap-2 transform hover:-translate-y-0.5 active:translate-y-0"
            onClick={() => {
              setOpenNewLeave(true);
              setUsersView(false);
              setShowPontaj(false);
              setShowPlanificare(false);
              // Nu schimbăm activeTab - rămânem pe tab-ul curent sau pe "toate" dacă nu e setat
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Cerere nouă concediu
          </button>

          {/* MENIU PRINCIPAL */}
          <div className="space-y-1.5">
            <button
              className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-3 ${
                usersView
                  ? "bg-emerald-100 text-emerald-700 shadow-sm border-l-4 border-emerald-600"
                  : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
              }`}
              onClick={() => {
                setUsersView(true);
                setShowPontaj(false);
                setOpenNewLeave(false);
                setShowPlanificare(false);
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Gestionează utilizatori
            </button>

            <button
              className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-3 ${
                showPontaj
                  ? "bg-emerald-100 text-emerald-700 shadow-sm border-l-4 border-emerald-600"
                  : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
              }`}
              onClick={() => {
                setShowPontaj(true);
                setUsersView(false);
                setShowPlanificare(false);
                setOpenNewLeave(false);
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Pontaj
            </button>

            <button
              className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-3 ${
                showPlanificare
                  ? "bg-emerald-100 text-emerald-700 shadow-sm border-l-4 border-emerald-600"
                  : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
              }`}
              onClick={() => {
                setShowPlanificare(true);
                setShowPontaj(false);
                setUsersView(false);
                setOpenNewLeave(false);
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Planificare
            </button>
          </div>

          {/* SECȚIUNE FILTRE CERERI */}
          <div className="pt-4 border-t border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-2">
              Filtre Cereri
            </p>
            <nav className="space-y-1">
              <button
                className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-3 ${
                  activeTab === "in_asteptare" && !usersView && !showPontaj && !showPlanificare
                    ? "bg-amber-100 text-amber-700 shadow-sm border-l-4 border-amber-600"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                onClick={() => {
                  setActiveTab("in_asteptare");
                  setUsersView(false);
                  setShowPontaj(false);
                  setShowPlanificare(false);
                  setOpenNewLeave(false);
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                În așteptare
              </button>

              <button
                className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-3 ${
                  activeTab === "aprobate" && !usersView && !showPontaj && !showPlanificare
                    ? "bg-emerald-100 text-emerald-700 shadow-sm border-l-4 border-emerald-600"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                onClick={() => {
                  setActiveTab("aprobate");
                  setUsersView(false);
                  setShowPontaj(false);
                  setShowPlanificare(false);
                  setOpenNewLeave(false);
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Cereri aprobate
              </button>

              <button
                className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-3 ${
                  activeTab === "respinse" && !usersView && !showPontaj && !showPlanificare
                    ? "bg-red-100 text-red-700 shadow-sm border-l-4 border-red-600"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                onClick={() => {
                  setActiveTab("respinse");
                  setUsersView(false);
                  setShowPontaj(false);
                  setShowPlanificare(false);
                  setOpenNewLeave(false);
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Cereri respinse
              </button>

              <button
                className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-3 ${
                  activeTab === "toate" && !usersView && !showPontaj && !showPlanificare
                    ? "bg-emerald-100 text-emerald-700 shadow-sm border-l-4 border-emerald-600"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                onClick={() => {
                  setActiveTab("toate");
                  setUsersView(false);
                  setShowPontaj(false);
                  setShowPlanificare(false);
                  setOpenNewLeave(false);
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
          {showPlanificare ? (
            // ✅ Planificare integrată în dashboard
            <PlanificareLunaraDashboard 
              lockedWorkplaceId={selectedWorkplace}
              hideBackButton={true}
            />
          ) : showPontaj ? (
            // ✅ IMPORTANT: blocăm pontajul pe farmacia adminului
            <TimesheetViewer workplaceId={selectedWorkplace} workplaceName={workplaceName} />
          ) : usersView ? (
            // ✅ IMPORTANT: panelul de users primește farmacia blocată (NU din dropdown global)
            <UsersManagementPanel
              selectedWorkplace={selectedWorkplace}
              setSelectedWorkplace={setSelectedWorkplace}
              workplaces={workplaces}
              onUserDeleted={() => setLeavesRefreshKey(prev => prev + 1)}
              // recomandat: în UsersManagementPanel să NU lași adminul să schimbe selectedWorkplace
              // (poți ignora setSelectedWorkplace acolo)
            />
          ) : (
            <Concediu
              API={API}
              // ✅ farmacia adminului (locked)
              workplaceId={selectedWorkplace}
              workplaceName={workplaceName}
              activeTab={activeTab}
              onChangeTab={setActiveTab}
              openNewLeave={openNewLeave}
              onCloseNewLeave={() => setOpenNewLeave(false)}
              refreshKey={leavesRefreshKey}
              // dacă vrei să permiți superadmin-ului să schimbe farmacia, facem alt flow.
            />
          )}
        </main>
      </div>
      
      {/* User Guide - buton fix în colțul din dreapta jos */}
      <UserGuide />
    </div>
  );
};

export default AdminFarmacieDashboard;
