 import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { TimesheetViewer } from "@/features/timesheet";
import { PlanificareLunaraDashboard } from "@/features/timesheet";
import { UserManagementPanel } from "@/shared";
import { Concediu } from "@/features/leaves";
import { AnnouncementsBanner } from "@/shared/components/AnnouncementsBanner";
import { FilesReceived, useFiles } from "@/features/files";
import { workplaceService } from "@/shared/services/workplaceService";
import { leaveService } from "@/features/leaves/services/leaveService";
import { getUserFromStorage } from "@/features/auth/utils/auth.utils";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { FetchError } from "@/shared/types/api.types";
import type { User } from "@/features/auth/types/auth.types";
import type { Workplace } from "@/shared/types/workplace.types";

type ActiveTab = "toate" | "in_asteptare" | "aprobate" | "respinse";

const AdminFarmacieDashboard: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  // ✅ user din router state SAU fallback din localStorage (când dai refresh)
  const loggedUser = useMemo<User | null>(() => {
    const fromState = (location.state as { user?: User })?.user || null;
    if (fromState) return fromState;

    return getUserFromStorage();
  }, [location.state]);

  // ✅ Funcție pentru logout
  const handleLogout = async () => {
    try {
      await logout();
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Eroare la logout:", error);
      // Navighează oricum către login chiar dacă logout-ul eșuează
      navigate("/", { replace: true });
    }
  };

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
  const [showFilesReceived, setShowFilesReceived] = useState(false);

  // UI: show create form e în Concediu
  const [openNewLeave, setOpenNewLeave] = useState(false);
  
  // ✅ Refresh key pentru forțarea reîncărcării cererilor după ștergerea unui user
  const [leavesRefreshKey, setLeavesRefreshKey] = useState(0);
  const [pendingLeavesCount, setPendingLeavesCount] = useState(0);
  const [showFiltersPasswordModal, setShowFiltersPasswordModal] = useState(false);
  const [filtersPassword, setFiltersPassword] = useState("");
  const [filtersPasswordError, setFiltersPasswordError] = useState("");
  const [verifyingFiltersPassword, setVerifyingFiltersPassword] = useState(false);
  const [pendingProtectedTab, setPendingProtectedTab] = useState<ActiveTab | null>(null);

  // DATA: doar pentru afișare nume farmacie (sidebar) + eventual listă
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [workplaceName, setWorkplaceName] = useState("");

  // ✅ setăm selectedWorkplace fix pe farmacia userului logat
  const [selectedWorkplace, setSelectedWorkplace] = useState<string>(lockedWorkplaceId);

  // ✅ Hook pentru numărul de fișiere necitite (pentru badge)
  const { unreadCount: filesUnreadCount } = useFiles({
    workplaceId: lockedWorkplaceId,
    autoRefresh: true,
    refreshInterval: 30000,
  });

  // ✅ Badge-ul de cereri în așteptare trebuie să fie vizibil din start
  useEffect(() => {
    if (!lockedWorkplaceId) {
      setPendingLeavesCount(0);
      return;
    }

    let mounted = true;

    const getModificationNote = (leave: { modificationNote?: string; reason?: string }): string => {
      if (leave.modificationNote) return leave.modificationNote;
      if (leave.reason && leave.reason.includes("[MODIFICARE]")) {
        const parts = leave.reason.split("[MODIFICARE]");
        return String(parts[parts.length - 1] || "").trim();
      }
      return "";
    };

    const isModifiedLeave = (leave: { wasModified?: boolean; modificationNote?: string; reason?: string }): boolean =>
      Boolean(leave.wasModified || getModificationNote(leave));

    const loadPendingCount = async () => {
      try {
        const workplaceLeaves = await leaveService.getByWorkplace(lockedWorkplaceId);
        if (!mounted) return;

        const pendingCount = workplaceLeaves.filter((leave) => {
          const effectiveStatus = isModifiedLeave(leave) ? "În așteptare" : leave.status;
          return effectiveStatus === "În așteptare";
        }).length;

        setPendingLeavesCount(pendingCount);
      } catch (err) {
        console.error("Eroare la încărcarea numărului de cereri în așteptare:", err);
      }
    };

    loadPendingCount();
    const intervalId = window.setInterval(loadPendingCount, 30000);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, [lockedWorkplaceId]);

  const isDepositWorkplaceProtected = useMemo(() => {
    const currentWorkplace = workplaces.find((w) => String(w._id) === String(selectedWorkplace));
    if (!currentWorkplace) return false;
    return Boolean(currentWorkplace.leaveFiltersProtectionEnabled);
  }, [workplaces, selectedWorkplace]);

  const activateTabView = (tab: ActiveTab) => {
    setActiveTab(tab);
    setUsersView(false);
    setShowPontaj(false);
    setShowPlanificare(false);
    setOpenNewLeave(false);
    setShowFilesReceived(false);
  };

  const handleProtectedFilterTabClick = (tab: ActiveTab) => {
    if (!isDepositWorkplaceProtected) {
      activateTabView(tab);
      return;
    }

    setPendingProtectedTab(tab);
    setFiltersPassword("");
    setFiltersPasswordError("");
    setShowFiltersPasswordModal(true);
  };

  const closeFiltersPasswordModal = () => {
    if (verifyingFiltersPassword) return;
    setShowFiltersPasswordModal(false);
    setFiltersPassword("");
    setFiltersPasswordError("");
    setPendingProtectedTab(null);
  };

  const submitFiltersPassword = async () => {
    if (!pendingProtectedTab) return;
    if (!selectedWorkplace) {
      setFiltersPasswordError("Nu am identificat punctul de lucru.");
      return;
    }
    if (!filtersPassword.trim()) {
      setFiltersPasswordError("Introdu parola.");
      return;
    }

    try {
      setVerifyingFiltersPassword(true);
      setFiltersPasswordError("");

      await workplaceService.verifyLeaveFiltersPassword(selectedWorkplace, filtersPassword.trim());
      activateTabView(pendingProtectedTab);
      setShowFiltersPasswordModal(false);
      setFiltersPassword("");
      setPendingProtectedTab(null);
    } catch (err) {
      if (err instanceof FetchError && err.status === 401) {
        setFiltersPasswordError("Parolă invalidă.");
      } else {
        setFiltersPasswordError("Nu am putut verifica parola. Încearcă din nou.");
      }
    } finally {
      setVerifyingFiltersPassword(false);
    }
  };

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
    setShowFilesReceived(false);
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
      <div className="w-full max-w-[98vw] bg-white border border-slate-200 shadow-sm rounded-2xl flex h-[calc(100vh-2rem)] min-h-0 overflow-hidden">
        {/* SIDEBAR */}
        <aside className="left-menu-scroll w-64 shrink-0 border-r border-slate-200 bg-gradient-to-b from-slate-50 to-white px-4 py-6 flex flex-col gap-4 overflow-y-auto">
          {/* HEADER */}
          <div className="mb-4 shrink-0">
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
                setShowFilesReceived(false);
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
                setShowFilesReceived(false);
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
                setShowFilesReceived(false);
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
                setShowFilesReceived(false);
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Planificare
            </button>

            <button
              className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-3 relative ${
                showFilesReceived
                  ? "bg-emerald-100 text-emerald-700 shadow-sm border-l-4 border-emerald-600"
                  : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
              }`}
              onClick={() => {
                setShowFilesReceived(true);
                setShowPontaj(false);
                setUsersView(false);
                setShowPlanificare(false);
                setOpenNewLeave(false);
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Fișiere primite
              {filesUnreadCount > 0 && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {filesUnreadCount > 9 ? "9+" : filesUnreadCount}
                </span>
              )}
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
                  activeTab === "in_asteptare" && !usersView && !showPontaj && !showPlanificare && !showFilesReceived
                    ? "bg-amber-100 text-amber-700 shadow-sm border-l-4 border-amber-600"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                onClick={() => {
                  handleProtectedFilterTabClick("in_asteptare");
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                În așteptare
                {pendingLeavesCount > 0 && (
                  <span className="ml-auto px-2 py-0.5 bg-amber-600 text-white text-xs font-bold rounded-full">
                    {pendingLeavesCount}
                  </span>
                )}
              </button>

              <button
                className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-3 ${
                  activeTab === "aprobate" && !usersView && !showPontaj && !showPlanificare && !showFilesReceived
                    ? "bg-emerald-100 text-emerald-700 shadow-sm border-l-4 border-emerald-600"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                onClick={() => {
                  handleProtectedFilterTabClick("aprobate");
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Cereri aprobate
              </button>

              <button
                className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-3 ${
                  activeTab === "respinse" && !usersView && !showPontaj && !showPlanificare && !showFilesReceived
                    ? "bg-red-100 text-red-700 shadow-sm border-l-4 border-red-600"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                onClick={() => {
                  handleProtectedFilterTabClick("respinse");
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Cereri respinse
              </button>

              <button
                className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-3 ${
                  activeTab === "toate" && !usersView && !showPontaj && !showPlanificare && !showFilesReceived
                    ? "bg-emerald-100 text-emerald-700 shadow-sm border-l-4 border-emerald-600"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                onClick={() => {
                  handleProtectedFilterTabClick("toate");
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Istoric cereri
              </button>
            </nav>
          </div>

          {/* BUTON LOGOUT */}
          <div className="pt-4 border-t border-slate-200">
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-3 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Deconectare
            </button>
          </div>
        </aside>

        {/* MAIN */}
        <main className="flex-1 min-h-0 p-4 overflow-y-auto box-border">
          {/* ✅ Mesaje de la manager */}
          <AnnouncementsBanner />
          
          {showFilesReceived ? (
            <div className="mb-6">
              <FilesReceived />
            </div>
          ) : showPlanificare ? (
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
              onPendingCountChange={setPendingLeavesCount}
              openNewLeave={openNewLeave}
              onCloseNewLeave={() => setOpenNewLeave(false)}
              refreshKey={leavesRefreshKey}
            />
          )}
        </main>
      </div>
      
      {showFiltersPasswordModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: "100vw",
            height: "100vh",
            margin: 0,
            padding: "1rem",
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-4 text-white">
              <h3 className="text-lg font-bold">Acces protejat filtre cereri</h3>
              <p className="text-sm text-emerald-100">Introdu parola șefului de farmacie pentru a deschide filtrul.</p>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Parolă</label>
              <input
                type="password"
                value={filtersPassword}
                onChange={(e) => {
                  setFiltersPassword(e.target.value);
                  if (filtersPasswordError) setFiltersPasswordError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void submitFiltersPassword();
                  }
                }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                placeholder="Introdu parola"
                autoFocus
                disabled={verifyingFiltersPassword}
              />
              {filtersPasswordError && (
                <p className="text-sm text-red-600 mt-2">{filtersPasswordError}</p>
              )}

              <div className="flex gap-3 mt-5">
                <button
                  type="button"
                  onClick={closeFiltersPasswordModal}
                  disabled={verifyingFiltersPassword}
                  className="flex-1 px-4 py-2.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Anulează
                </button>
                <button
                  type="button"
                  onClick={() => void submitFiltersPassword()}
                  disabled={verifyingFiltersPassword}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg hover:from-emerald-700 hover:to-emerald-800 text-sm font-semibold transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {verifyingFiltersPassword ? "Se verifică..." : "Confirmă"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminFarmacieDashboard;

