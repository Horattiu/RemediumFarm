import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { TimesheetViewer } from "@/features/timesheet";
import { PlanificareLunaraDashboard } from "@/features/timesheet";
import { UserManagementPanel } from "@/shared";
import { Concediu } from "@/features/leaves";
import { UserGuide } from "@/shared/components/UserGuide";
import { workplaceService } from "@/shared/services/workplaceService";
import { getUserFromStorage } from "@/features/auth/utils/auth.utils";
import type { User } from "@/features/auth/types/auth.types";
import type { Workplace } from "@/shared/types/workplace.types";

type ActiveTab = "toate" | "in_asteptare" | "aprobate" | "respinse";

const AdminFarmacieDashboard: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // ✅ user din router state SAU fallback din localStorage (când dai refresh)
  const loggedUser = useMemo<User | null>(() => {
    const fromState = (location.state as { user?: User })?.user || null;
    if (fromState) return fromState;

    return getUserFromStorage();
  }, [location.state]);

  // ✅ workplaceId trebuie să fie STRING (exact cum îl pui în Login)
  const lockedWorkplaceId = useMemo<string>(() => {
    if (!loggedUser) return "";
    if (typeof loggedUser.workplaceId === 'string') {
      return loggedUser.workplaceId;
    }
    if (loggedUser.workplaceId && typeof loggedUser.workplaceId === 'object' && '_id' in loggedUser.workplaceId) {
      return loggedUser.workplaceId._id;
    }
    return "";
  }, [loggedUser]);

  // VIEW STATES
  const [activeTab, setActiveTab] = useState<ActiveTab>("toate");
  const [usersView, setUsersView] = useState(false);
  const [showPontaj, setShowPontaj] = useState(true); // ✅ Deschide direct pe pontaj
  const [showPlanificare, setShowPlanificare] = useState(false);

  // UI: show create form e în Concediu
  const [openNewLeave, setOpenNewLeave] = useState(false);
  
  // ✅ Refresh key pentru forțarea reîncărcării cererilor după ștergerea unui user
  const [leavesRefreshKey, setLeavesRefreshKey] = useState(0);

  // DATA: doar pentru afișare nume farmacie (sidebar) + eventual listă
  const [, setWorkplaces] = useState<Workplace[]>([]);
  const [workplaceName, setWorkplaceName] = useState("");

  // ✅ setăm selectedWorkplace fix pe farmacia userului logat
  const [selectedWorkplace, setSelectedWorkplace] = useState<string>(lockedWorkplaceId);

  // ✅ dacă nu avem user, îl scoatem la login
  useEffect(() => {
    if (!loggedUser) navigate("/", { replace: true });
  }, [loggedUser, navigate]);

  // ✅ de fiecare dată când se schimbă userul logat, blocăm farmacia pe workplaceId-ul lui
  useEffect(() => {
    setSelectedWorkplace(lockedWorkplaceId);
    setUsersView(false);
    setShowPontaj(true); // ✅ Deschide direct pe pontaj
    setShowPlanificare(false);
    setActiveTab("toate");
    setOpenNewLeave(false);
  }, [lockedWorkplaceId]);

  // ✅ load workplaces ca să putem afla numele farmaciei (și pt dropdown dacă vrei)
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const list = await workplaceService.getAll();
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
            <PlanificareLunaraDashboard 
              lockedWorkplaceId={selectedWorkplace}
              hideBackButton={true}
            />
          ) : showPontaj ? (
            <TimesheetViewer workplaceId={selectedWorkplace} workplaceName={workplaceName} />
          ) : usersView ? (
            <UserManagementPanel
              selectedWorkplace={selectedWorkplace}
              setSelectedWorkplace={setSelectedWorkplace}
              onUserDeleted={() => setLeavesRefreshKey(prev => prev + 1)}
            />
          ) : (
            <Concediu
              workplaceId={selectedWorkplace}
              workplaceName={workplaceName}
              activeTab={activeTab}
              onChangeTab={setActiveTab}
              openNewLeave={openNewLeave}
              onCloseNewLeave={() => setOpenNewLeave(false)}
              refreshKey={leavesRefreshKey}
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

