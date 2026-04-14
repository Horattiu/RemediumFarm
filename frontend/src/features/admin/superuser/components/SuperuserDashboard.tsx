import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { workplaceService } from "@/shared/services/workplaceService";
import { userService } from "@/shared/services/userService";
import { getUserFromStorage } from "@/features/auth/utils/auth.utils";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { Workplace } from "@/shared/types/workplace.types";
import type { User } from "@/features/auth/types/auth.types";

const MASKED_PASSWORD = "********";
type SuperuserSection = "passwordFilters" | "adminPasswords" | "comingSoon";

const SuperuserDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [passwordInputs, setPasswordInputs] = useState<Record<string, string>>({});
  const [passwordVisibility, setPasswordVisibility] = useState<Record<string, boolean>>({});
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [adminPasswordInputs, setAdminPasswordInputs] = useState<Record<string, string>>({});
  const [adminPasswordVisibility, setAdminPasswordVisibility] = useState<Record<string, boolean>>({});
  const [adminPasswordSet, setAdminPasswordSet] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [savingAdminId, setSavingAdminId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SuperuserSection>("passwordFilters");

  useEffect(() => {
    const user = getUserFromStorage();
    if (!user || user.role !== "superuser") {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const loadWorkplaces = async () => {
    try {
      setLoading(true);
      const list = await workplaceService.getAllForAdmin();
      setWorkplaces(list);
      setPasswordInputs((prev) => {
        const next = { ...prev };
        list.forEach((wp) => {
          const id = String(wp._id);
          if (wp.leaveFiltersPasswordSet && !next[id]) {
            next[id] = MASKED_PASSWORD;
          }
        });
        return next;
      });
    } catch (err) {
      console.error("Eroare la încărcarea punctelor de lucru:", err);
      alert("Nu am putut încărca punctele de lucru.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkplaces();
  }, []);

  const loadAdminUsers = async () => {
    try {
      setLoadingAdmins(true);
      const users = await userService.getAll();
      const admins = users.filter((u) => u.role === "admin" || u.role === "superadmin");
      setAdminUsers(admins);
      setAdminPasswordSet(() =>
        admins.reduce<Record<string, boolean>>((acc, admin) => {
          acc[String(admin._id)] = Boolean(admin.adminPasswordSet);
          return acc;
        }, {})
      );
      setAdminPasswordInputs((prev) => {
        const next = { ...prev };
        admins.forEach((admin) => {
          const id = String(admin._id);
          if (admin.adminPasswordSet && !next[id]) {
            next[id] = MASKED_PASSWORD;
          }
        });
        return next;
      });
    } catch (err) {
      console.error("Eroare la încărcarea conturilor admin:", err);
      alert("Nu am putut încărca conturile de admin.");
    } finally {
      setLoadingAdmins(false);
    }
  };

  useEffect(() => {
    loadAdminUsers();
  }, []);

  const handleSetPassword = async (workplaceId: string) => {
    const password = String(passwordInputs[workplaceId] || "").trim();
    if (password === MASKED_PASSWORD) {
      alert("Parola este deja setată. Introdu o parolă nouă dacă vrei s-o schimbi.");
      return;
    }
    if (password.length < 6) {
      alert("Parola trebuie să aibă minim 6 caractere.");
      return;
    }

    try {
      setSavingId(workplaceId);
      const ok = await workplaceService.setLeaveFiltersPassword(workplaceId, password);
      if (!ok) throw new Error("Setare parolă eșuată.");
      setWorkplaces((prev) =>
        prev.map((wp) =>
          String(wp._id) === String(workplaceId)
            ? { ...wp, leaveFiltersPasswordSet: true, leaveFiltersProtectionEnabled: true }
            : wp
        )
      );
      setPasswordInputs((prev) => ({ ...prev, [workplaceId]: MASKED_PASSWORD }));
      setPasswordVisibility((prev) => ({ ...prev, [workplaceId]: false }));
    } catch (err) {
      console.error("Eroare setare parolă:", err);
      alert("Nu am putut salva parola.");
    } finally {
      setSavingId(null);
    }
  };

  const handleDeletePassword = async (workplaceId: string) => {
    try {
      setSavingId(workplaceId);
      const ok = await workplaceService.deleteLeaveFiltersPassword(workplaceId);
      if (!ok) throw new Error("Ștergere parolă eșuată.");
      setWorkplaces((prev) =>
        prev.map((wp) =>
          String(wp._id) === String(workplaceId)
            ? { ...wp, leaveFiltersPasswordSet: false, leaveFiltersProtectionEnabled: false }
            : wp
        )
      );
      setPasswordInputs((prev) => ({ ...prev, [workplaceId]: "" }));
      setPasswordVisibility((prev) => ({ ...prev, [workplaceId]: false }));
    } catch (err) {
      console.error("Eroare ștergere parolă:", err);
      alert("Nu am putut șterge parola.");
    } finally {
      setSavingId(null);
    }
  };

  const getAdminWorkplaceName = (admin: User) => {
    if (typeof admin.workplaceId === "object" && admin.workplaceId && "name" in admin.workplaceId) {
      return String(admin.workplaceId.name || "—");
    }
    if (typeof admin.workplaceId === "string") {
      const wp = workplaces.find((item) => String(item._id) === admin.workplaceId);
      return wp?.name || "—";
    }
    return "—";
  };

  const handleSetAdminPassword = async (adminId: string) => {
    const password = String(adminPasswordInputs[adminId] || "").trim();
    if (password === MASKED_PASSWORD) {
      alert("Parola este deja setată. Introdu o parolă nouă dacă vrei s-o schimbi.");
      return;
    }
    if (password.length < 6) {
      alert("Parola trebuie să aibă minim 6 caractere.");
      return;
    }

    try {
      setSavingAdminId(adminId);
      const ok = await userService.setAdminPassword(adminId, password);
      if (!ok) throw new Error("Schimbare parolă eșuată.");
      setAdminPasswordInputs((prev) => ({ ...prev, [adminId]: MASKED_PASSWORD }));
      setAdminPasswordVisibility((prev) => ({ ...prev, [adminId]: false }));
      setAdminPasswordSet((prev) => ({ ...prev, [adminId]: true }));
      alert("Parola a fost actualizată.");
    } catch (err) {
      console.error("Eroare schimbare parolă admin:", err);
      alert("Nu am putut schimba parola.");
    } finally {
      setSavingAdminId(null);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate("/", { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4 flex items-center justify-between">
          <h1 className="text-white font-bold text-xl">Panou Superuser</h1>
          <button
            type="button"
            onClick={handleLogout}
            className="px-3 py-2 rounded-lg bg-white/15 text-white hover:bg-white/25 text-sm font-medium"
          >
            Deconectare
          </button>
        </div>
        <div className="flex min-h-[70vh]">
          <aside className="w-64 border-r border-slate-200 bg-slate-50 p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 pb-2">
              Secțiuni tehnice
            </p>
            <button
              type="button"
              onClick={() => setActiveSection("passwordFilters")}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeSection === "passwordFilters"
                  ? "bg-emerald-100 text-emerald-700"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              Parole filtre cereri
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("adminPasswords")}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeSection === "adminPasswords"
                  ? "bg-emerald-100 text-emerald-700"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              Parole conturi admin
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("comingSoon")}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeSection === "comingSoon"
                  ? "bg-emerald-100 text-emerald-700"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              Funcționalități viitoare
            </button>
          </aside>

          <main className="flex-1 p-6">
            {activeSection === "passwordFilters" ? (
              <>
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Parole filtre cereri pe puncte de lucru</h2>
                {loading ? (
                  <p className="text-slate-500">Se încarcă...</p>
                ) : (
                  <div className="space-y-3">
                    {workplaces.map((wp) => {
                      const wpId = String(wp._id);
                      const isSaving = savingId === wpId;
                      const isStoredMask = (passwordInputs[wpId] || "") === MASKED_PASSWORD;
                      return (
                        <div key={wpId} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="font-semibold text-slate-900">{wp.name}</p>
                              <p className="text-xs text-slate-500">Cod: {wp.code || "—"}</p>
                            </div>
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${wp.leaveFiltersProtectionEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                              {wp.leaveFiltersProtectionEnabled ? "Protecție activă" : "Protecție inactivă"}
                            </span>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <input
                              type={isStoredMask ? "text" : (passwordVisibility[wpId] ? "text" : "password")}
                              value={passwordInputs[wpId] || ""}
                              onChange={(e) => setPasswordInputs((prev) => ({ ...prev, [wpId]: e.target.value }))}
                              placeholder="Setează/Schimbă parola (min 6)"
                              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                              disabled={isSaving}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (isStoredMask) {
                                  alert("Parola existentă este hash-uită și nu poate fi afișată.");
                                  return;
                                }
                                setPasswordVisibility((prev) => ({ ...prev, [wpId]: !prev[wpId] }));
                              }}
                              className={`px-3 py-2 rounded-lg border border-slate-300 ${isStoredMask ? "text-slate-400 bg-slate-50" : "text-slate-600 hover:bg-slate-100"}`}
                              disabled={isSaving}
                              title={isStoredMask ? "Parola existentă nu poate fi afișată" : "Arată/Ascunde parola"}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleSetPassword(wpId)}
                              disabled={isSaving}
                              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
                            >
                              Salvează parola
                            </button>
                            {(Boolean(wp.leaveFiltersPasswordSet) || Boolean(wp.leaveFiltersProtectionEnabled) || isStoredMask) && (
                              <button
                                type="button"
                                onClick={() => void handleDeletePassword(wpId)}
                                disabled={isSaving}
                                className="px-3 py-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-60"
                                title="Șterge parola"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                          {isStoredMask && (
                            <p className="mt-2 text-xs text-slate-500">
                              Parola este setată și stocată hash-uit în baza de date.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : activeSection === "adminPasswords" ? (
              <>
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Schimbă parola conturilor de admin</h2>
                {loadingAdmins ? (
                  <p className="text-slate-500">Se încarcă...</p>
                ) : adminUsers.length === 0 ? (
                  <div className="border border-slate-200 rounded-xl p-6 bg-slate-50 text-sm text-slate-600">
                    Nu există conturi de admin disponibile.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {adminUsers.map((admin) => {
                      const adminId = String(admin._id);
                      const isSaving = savingAdminId === adminId;
                      const isStoredMask = (adminPasswordInputs[adminId] || "") === MASKED_PASSWORD;
                      const hasAdminPassword = Boolean(admin.adminPasswordSet || adminPasswordSet[adminId] || isStoredMask);
                      return (
                        <div key={adminId} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="font-semibold text-slate-900">{admin.name}</p>
                              <p className="text-xs text-slate-500">
                                Rol: {admin.role} • Punct de lucru: {getAdminWorkplaceName(admin)}
                              </p>
                            </div>
                            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                              Cont activ
                            </span>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <input
                              type={isStoredMask ? "text" : (adminPasswordVisibility[adminId] ? "text" : "password")}
                              value={adminPasswordInputs[adminId] || ""}
                              onChange={(e) => setAdminPasswordInputs((prev) => ({ ...prev, [adminId]: e.target.value }))}
                              placeholder="Parolă nouă (min 6)"
                              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                              disabled={isSaving}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (isStoredMask) {
                                  alert("Parola existentă este hash-uită și nu poate fi afișată.");
                                  return;
                                }
                                setAdminPasswordVisibility((prev) => ({ ...prev, [adminId]: !prev[adminId] }));
                              }}
                              className={`px-3 py-2 rounded-lg border border-slate-300 ${
                                isStoredMask ? "text-slate-400 bg-slate-50" : "text-slate-600 hover:bg-slate-100"
                              }`}
                              disabled={isSaving}
                              title={isStoredMask ? "Parola existentă nu poate fi afișată" : "Arată/Ascunde parola"}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleSetAdminPassword(adminId)}
                              disabled={isSaving}
                              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
                            >
                              Salvează parola
                            </button>
                            {hasAdminPassword && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAdminPasswordInputs((prev) => ({ ...prev, [adminId]: "" }));
                                  setAdminPasswordVisibility((prev) => ({ ...prev, [adminId]: false }));
                                }}
                                disabled={isSaving}
                                className="px-3 py-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-60"
                                title="Șterge parola din câmp pentru a introduce alta"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                          {isStoredMask && (
                            <p className="mt-2 text-xs text-slate-500">
                              Parola este setată și stocată hash-uit în baza de date.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="border border-dashed border-slate-300 rounded-xl p-8 bg-slate-50">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Funcționalități viitoare</h3>
                <p className="text-sm text-slate-600">
                  Aici vom adăuga modulele globale noi (setări tehnice, feature flags, reguli centrale etc.).
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default SuperuserDashboard;
