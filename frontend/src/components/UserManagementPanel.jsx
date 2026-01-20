import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";

// Folosește variabile de mediu pentru URL-ul backend-ului
const getApiUrl = () => {
  const url = import.meta.env.VITE_API_URL || "http://localhost:5000";
  return url.replace(/\/$/, ""); // Elimină slash-ul final
};
const API = getApiUrl();

/**
 * UsersManagementPanel
 * - Pentru superadmin: poate alege farmacia (selectedWorkplace din parent)
 * - Pentru admin: farmacia e LOCK pe workplaceId-ul din userul logat (localStorage)
 * - Evită “flash” cu angajații vechi + race conditions între fetch-uri
 */
const UsersManagementPanel = ({ selectedWorkplace, setSelectedWorkplace }) => {
  // ===================== AUTH (USER LOGAT) =====================
  const [authUser, setAuthUser] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      const parsed = raw ? JSON.parse(raw) : null;
      setAuthUser(parsed || null);
    } catch {
      setAuthUser(null);
    }
  }, []);

  // ✅ Verificare mai robustă pentru roluri
  // Permite acces pentru admin și superadmin (chiar dacă rolul vine cu majuscule diferite)
  const userRole = authUser?.role?.toLowerCase?.() || authUser?.role || "";
  const isAdmin = userRole === "admin";
  const isSuperadmin = userRole === "superadmin";
  
  // ✅ IMPORTANT: Dacă utilizatorul este logat și are un workplaceId, înseamnă că este admin
  // (doar adminii au workplaceId și pot accesa AdminFarmacieDashboard)
  // Această verificare suplimentară asigură accesul pentru admini
  const hasWorkplaceId = !!authUser?.workplaceId;
  const isLikelyAdmin = hasWorkplaceId && !isSuperadmin; // Dacă are workplaceId și nu e superadmin, e admin
  
  // ✅ Verificare finală: dacă are workplaceId, este admin (indiferent de cum este setat role-ul)
  const effectiveIsAdmin = isAdmin || isLikelyAdmin;

  // admin -> lock pe workplaceId
  const lockedWorkplaceId = useMemo(() => {
    if (!effectiveIsAdmin) return "";
    return authUser?.workplaceId || "";
  }, [effectiveIsAdmin, authUser]);

  // workplace efectiv folosit de componentă
  const effectiveWorkplaceId = useMemo(() => {
    return effectiveIsAdmin ? lockedWorkplaceId : selectedWorkplace || "";
  }, [effectiveIsAdmin, lockedWorkplaceId, selectedWorkplace]);

  // când te loghezi ca admin, sincronizează și selectedWorkplace în parent (ca să nu rămână remedium1)
  useEffect(() => {
    if (!effectiveIsAdmin) return;
    if (!lockedWorkplaceId) return;
    if (typeof setSelectedWorkplace === "function") {
      setSelectedWorkplace(lockedWorkplaceId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveIsAdmin, lockedWorkplaceId]);

  // ===================== DATA =====================
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // ===================== UI STATE =====================
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editingUserId, setEditingUserId] = useState(null); // ID-ul angajatului în editare inline
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  // Blochează scroll-ul paginii când modalul este deschis
  useEffect(() => {
    if (showDeleteModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showDeleteModal]);

  // ===================== FORM =====================
  const [userFormData, setUserFormData] = useState({
    name: "",
    email: "",
    function: "",
  });
  const [useCustomFunction, setUseCustomFunction] = useState(false);

  // ===================== FETCH CONTROL (ANTI RACE) =====================
  const employeesAbortRef = useRef(null);
  const lastEmployeesReqId = useRef(0);

  const hardResetMessages = useCallback(() => {
    setError("");
    setSuccess("");
  }, []);

  const resetForm = useCallback(() => {
    setEditingUser(null);
    setEditingUserId(null);
    setUseCustomFunction(false);
    setUserFormData({
      name: "",
      email: "",
      function: "",
    });
  }, []);

  const closeForm = useCallback(() => {
    setShowUserForm(false);
    resetForm();
  }, [resetForm]);

  // ===================== LOAD EMPLOYEES =====================
  const loadEmployees = useCallback(
    async (workplaceId) => {
      hardResetMessages();

      // important: curățăm instant lista când se schimbă workplace-ul
      // ca să nu mai vezi angajații vechi 1 secundă
      setEmployees([]);

      if (!workplaceId) return;

      // oprește request-ul anterior dacă există
      if (employeesAbortRef.current) {
        try {
          employeesAbortRef.current.abort();
        } catch {}
      }

      const controller = new AbortController();
      employeesAbortRef.current = controller;

      const reqId = ++lastEmployeesReqId.current;

      try {
        setLoadingEmployees(true);

        const res = await fetch(
          `${API}/api/users/by-workplace/${workplaceId}`,
          {
            method: "GET",
            credentials: "include",
            signal: controller.signal,
            headers: { Accept: "application/json" },
          }
        );

        // dacă între timp a pornit alt request, ignorăm răspunsul ăsta
        if (reqId !== lastEmployeesReqId.current) return;

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          setEmployees([]);
          setError(data?.error || "Nu s-au putut încărca utilizatorii.");
          return;
        }

        setEmployees(Array.isArray(data) ? data : []);
      } catch (err) {
        if (err?.name === "AbortError") return;
        console.error(err);
        setEmployees([]);
        setError("Eroare la încărcarea utilizatorilor.");
      } finally {
        if (reqId === lastEmployeesReqId.current) {
          setLoadingEmployees(false);
        }
      }
    },
    [hardResetMessages]
  );

  // rulează load când se schimbă workplace-ul efectiv (admin: locked, superadmin: selected)
  useEffect(() => {
    loadEmployees(effectiveWorkplaceId);
  }, [effectiveWorkplaceId, loadEmployees]);

  // ===================== CREATE / EDIT USER =====================
  const handleUserSubmit = async (e) => {
    e.preventDefault();
    hardResetMessages();

    if (!effectiveWorkplaceId) {
      setError("Selectează farmacia înainte să creezi utilizatorul!");
      return;
    }

    const payload = {
      name: userFormData.name,
      ...(userFormData.email.trim() ? { email: userFormData.email.trim() } : {}),
      // ✅ Employee nu are password (doar User pentru autentificare)
      function: userFormData.function,
      workplaceId: effectiveWorkplaceId, // ✅ Trimitem workplaceId ca string, backend îl convertește la ObjectId
      // ✅ Nu mai trimitem role - employees nu au role
      // ✅ monthlyTargetHours nu se mai trimite - backend folosește valoarea implicită de 160
    };

    try {
      const url = editingUser
        ? `${API}/api/users/${editingUser._id}`
        : `${API}/api/users`;
      const method = editingUser ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error || "Eroare salvare utilizator!");
        return;
      }

      await loadEmployees(effectiveWorkplaceId);

      setSuccess(editingUser ? "Utilizator actualizat." : "Utilizator creat.");
      if (editingUserId) {
        // Dacă era editare inline, doar resetăm
        resetForm();
      } else {
        // Dacă era formular nou, închidem formularul
        closeForm();
      }
    } catch (err) {
      console.error(err);
      setError("Eroare salvare utilizator!");
    }
  };

  const handleDeleteClick = (user) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    
    hardResetMessages();
    setShowDeleteModal(false);

    try {
      const res = await fetch(`${API}/api/users/${userToDelete._id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error || "Eroare ștergere!");
        return;
      }

      await loadEmployees(effectiveWorkplaceId);
      setSuccess("Utilizator șters.");
      setUserToDelete(null);
    } catch (err) {
      console.error(err);
      setError("Eroare ștergere!");
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setUserToDelete(null);
  };

  const editUser = (user) => {
    hardResetMessages();
    setEditingUser(user);
    setEditingUserId(user._id); // Setează ID-ul pentru editare inline
    const userFunction = user.function || "";
    // Verifică dacă funcția este una din opțiunile predefinite
    const predefinedFunctions = ["Farmacist", "Farmacist Șef", "Asistent"];
    const isPredefined = predefinedFunctions.includes(userFunction);
    setUseCustomFunction(!isPredefined && userFunction !== "");
    setUserFormData({
      name: user.name || "",
      email: user.email || "",
      function: userFunction,
    });
    // Nu mai deschidem formularul separat, doar setăm editingUserId
  };

  const cancelEdit = () => {
    resetForm();
  };

  // ===================== UI HELPERS =====================
  // ✅ Permite acces pentru admin, superadmin, sau utilizatori cu workplaceId (care sunt admini)
  // IMPORTANT: Nu verificăm pentru accountancy - doar admin și superadmin au acces
  const canManageUsers = effectiveIsAdmin || isSuperadmin;

  // ✅ DEBUG: Log pentru debugging (temporar)
  useEffect(() => {
    if (authUser) {
      console.log("🔍 UserManagementPanel - Auth Check:", {
        authUser,
        role: authUser?.role,
        userRole,
        isAdmin,
        effectiveIsAdmin,
        isSuperadmin,
        hasWorkplaceId,
        isLikelyAdmin,
        canManageUsers,
      });
    }
  }, [authUser, userRole, isAdmin, effectiveIsAdmin, isSuperadmin, hasWorkplaceId, isLikelyAdmin, canManageUsers]);

  if (!authUser) {
    return (
      <div className="border border-slate-200 bg-white rounded-xl p-6">
        <p className="text-slate-700">Nu ești autentificat.</p>
      </div>
    );
  }

  // ✅ Verificare mai robustă: permite acces pentru admin și superadmin
  // IMPORTANT: Dacă utilizatorul este logat și are workplaceId, înseamnă că este admin
  // și ar trebui să aibă acces la gestionarea utilizatorilor
  // NU verificăm pentru accountancy - doar admin și superadmin au acces
  if (!canManageUsers) {
    // ✅ DEBUG: Log pentru debugging
    console.warn("⚠️ UserManagementPanel - Acces refuzat:", {
      authUser,
      role: authUser?.role,
      userRole,
      isAdmin,
      effectiveIsAdmin,
      isSuperadmin,
      isLikelyAdmin,
      hasWorkplaceId,
      canManageUsers,
    });
    
    return (
      <div className="border border-slate-200 bg-white rounded-xl p-6">
        <p className="text-slate-700">
          Nu ai acces la gestionarea utilizatorilor. Doar administratorii de farmacie și superadminii pot accesa această secțiune.
        </p>
        <p className="text-xs text-slate-500 mt-2">
          Rolul tău: {authUser?.role || "necunoscut"}
          {hasWorkplaceId && <span className="text-emerald-600 ml-2">(Ai workplaceId: {String(authUser?.workplaceId)})</span>}
        </p>
        <p className="text-xs text-slate-500 mt-2">
          Dacă crezi că este o eroare, te rugăm să contactezi administratorul.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER / INFO */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Gestionare Utilizatori
            </h2>
            <div className="flex items-center gap-4 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="font-medium text-slate-700">{authUser?.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="capitalize">{authUser?.role}</span>
              </div>
            </div>
          </div>

          {/* superadmin poate alege farmacia, admin NU */}
          {isSuperadmin ? (
            <div className="min-w-[260px]">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Selectează farmacia
              </label>
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                value={selectedWorkplace || ""}
                onChange={(e) => setSelectedWorkplace?.(e.target.value)}
                placeholder="ID farmacie..."
              />
            </div>
          ) : (
            <div className="min-w-[260px]">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Farmacia ta
              </label>
              <div className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-700 font-medium">
                {effectiveWorkplaceId || "—"}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MESSAGES */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 flex items-center gap-3 animate-shake">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium text-red-800">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 rounded-lg p-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium text-emerald-800">{success}</p>
        </div>
      )}

      {/* FORM CREARE/EDIT USER */}
      {showUserForm && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={editingUser ? "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" : "M12 4v16m8-8H4"} />
                </svg>
              </div>
              {editingUser ? "Editează utilizator" : "Creează utilizator nou"}
            </h3>
            <button
              onClick={closeForm}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
            onSubmit={handleUserSubmit}
          >
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nume complet *
              </label>
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                placeholder="Introdu numele complet"
                value={userFormData.name}
                onChange={(e) =>
                  setUserFormData({ ...userFormData, name: e.target.value })
                }
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                placeholder="email@example.com"
                type="email"
                value={userFormData.email}
                onChange={(e) =>
                  setUserFormData({ ...userFormData, email: e.target.value })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Funcție *
              </label>
              {!useCustomFunction ? (
                <div className="space-y-2">
                  <select
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                    value={userFormData.function}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "custom") {
                        setUseCustomFunction(true);
                        setUserFormData({ ...userFormData, function: "" });
                      } else {
                        setUserFormData({ ...userFormData, function: value });
                      }
                    }}
                    required={!useCustomFunction}
                  >
                    <option value="">Selectează funcția</option>
                    <option value="Farmacist">Farmacist</option>
                    <option value="Farmacist Șef">Farmacist Șef</option>
                    <option value="Asistent">Asistent</option>
                    <option value="custom">Altă funcție (custom)</option>
                  </select>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                      placeholder="Introdu funcția custom"
                      value={userFormData.function}
                      onChange={(e) =>
                        setUserFormData({ ...userFormData, function: e.target.value })
                      }
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setUseCustomFunction(false);
                        setUserFormData({ ...userFormData, function: "" });
                      }}
                      className="px-3 py-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Revino la opțiunile predefinite"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">
                    Introdu o funcție personalizată sau{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setUseCustomFunction(false);
                        setUserFormData({ ...userFormData, function: "" });
                      }}
                      className="text-emerald-600 hover:text-emerald-700 underline"
                    >
                      revino la opțiunile predefinite
                    </button>
                  </p>
                </div>
              )}
            </div>

            <div className="md:col-span-2 flex gap-3 pt-2 justify-start">
              <button
                type="submit"
                className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg font-medium hover:from-emerald-700 hover:to-green-700 transition-all duration-200 shadow-md hover:shadow-emerald-500/50 flex items-center justify-center gap-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {editingUser ? "Salvează modificări" : "Creează utilizator"}
              </button>
              <button
                type="button"
                className="px-5 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition-colors text-sm"
                onClick={closeForm}
              >
                Anulează
              </button>
            </div>
          </form>
        </div>
      )}

      {/* LISTĂ UTILIZATORI */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Utilizatori farmacie
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              {loadingEmployees ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Se încarcă...
                </span>
              ) : (
                <span className="text-slate-500">
                  {employees.length} {employees.length === 1 ? "utilizator" : "utilizatori"}
                </span>
              )}
            </p>
          </div>

          {!showUserForm && (
            <button
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white text-sm font-semibold rounded-lg hover:from-emerald-700 hover:to-green-700 transition-all duration-200 shadow-md hover:shadow-emerald-500/50 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              onClick={() => {
                hardResetMessages();
                setShowUserForm(true);
              }}
              disabled={!effectiveWorkplaceId}
              title={
                !effectiveWorkplaceId ? "Nu există workplace selectat." : ""
              }
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Adaugă utilizator
            </button>
          )}
        </div>

        {loadingEmployees ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mb-4"></div>
            <p className="text-slate-500 text-sm">Se încarcă utilizatorii...</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-12 px-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h4 className="text-lg font-semibold text-slate-900 mb-2">Nu există utilizatori</h4>
            <p className="text-sm text-slate-500 mb-4">
              Începe prin a adăuga primul utilizator pentru această farmacie.
            </p>
            {effectiveWorkplaceId && (
              <button
                onClick={() => {
                  hardResetMessages();
                  setShowUserForm(true);
                }}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white text-sm font-semibold rounded-lg hover:from-emerald-700 hover:to-green-700 transition-all duration-200 shadow-md hover:shadow-emerald-500/50 flex items-center gap-2 mx-auto"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Adaugă primul utilizator
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {employees.map((user) => (
              <div
                key={user._id}
                className="px-6 py-4 hover:bg-slate-50 transition-colors duration-200"
              >
                {editingUserId === user._id ? (
                  // FORMULAR EDITARE INLINE
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </div>
                        Editează utilizator
                      </h4>
                    </div>
                    <form
                      className="grid grid-cols-1 md:grid-cols-2 gap-4"
                      onSubmit={handleUserSubmit}
                    >
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Nume complet *
                        </label>
                        <input
                          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors bg-white"
                          placeholder="Introdu numele complet"
                          value={userFormData.name}
                          onChange={(e) =>
                            setUserFormData({ ...userFormData, name: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Email
                        </label>
                        <input
                          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors bg-white"
                          placeholder="email@example.com"
                          type="email"
                          value={userFormData.email}
                          onChange={(e) =>
                            setUserFormData({ ...userFormData, email: e.target.value })
                          }
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Funcție *
                        </label>
                        {!useCustomFunction ? (
                          <div className="space-y-2">
                            <select
                              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors bg-white"
                              value={userFormData.function}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === "custom") {
                                  setUseCustomFunction(true);
                                  setUserFormData({ ...userFormData, function: "" });
                                } else {
                                  setUserFormData({ ...userFormData, function: value });
                                }
                              }}
                              required={!useCustomFunction}
                            >
                              <option value="">Selectează funcția</option>
                              <option value="Farmacist">Farmacist</option>
                              <option value="Farmacist Șef">Farmacist Șef</option>
                              <option value="Asistent">Asistent</option>
                              <option value="custom">Altă funcție (custom)</option>
                            </select>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors bg-white"
                                placeholder="Introdu funcția custom"
                                value={userFormData.function}
                                onChange={(e) =>
                                  setUserFormData({ ...userFormData, function: e.target.value })
                                }
                                required
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setUseCustomFunction(false);
                                  setUserFormData({ ...userFormData, function: "" });
                                }}
                                className="px-3 py-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Revino la opțiunile predefinite"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                            <p className="text-xs text-slate-500">
                              Introdu o funcție personalizată sau{" "}
                              <button
                                type="button"
                                onClick={() => {
                                  setUseCustomFunction(false);
                                  setUserFormData({ ...userFormData, function: "" });
                                }}
                                className="text-emerald-600 hover:text-emerald-700 underline"
                              >
                                revino la opțiunile predefinite
                              </button>
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="md:col-span-2 flex gap-3 pt-2 justify-start">
                        <button
                          type="submit"
                          className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg font-medium hover:from-emerald-700 hover:to-green-700 transition-all duration-200 shadow-md hover:shadow-emerald-500/50 flex items-center justify-center gap-2 text-sm"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Salvează modificări
                        </button>
                        <button
                          type="button"
                          className="px-5 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition-colors text-sm"
                          onClick={cancelEdit}
                        >
                          Anulează
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  // AFIȘARE NORMALĂ
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-bold text-lg">
                        {user.name?.charAt(0).toUpperCase() || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-900 text-base truncate mb-1">
                          {user.name}
                        </h4>
                        {user.email && (
                          <p className="text-sm text-slate-500 truncate mb-1 flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            {user.email}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {user.function || "—"}
                          </span>
                          {typeof user.monthlyTargetHours === "number" && (
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {user.monthlyTargetHours}h/lună
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <button
                        className="px-4 py-2 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1.5"
                        onClick={() => editUser(user)}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Editează
                      </button>
                      <button
                        className="px-4 py-2 bg-red-50 text-red-700 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1.5"
                        onClick={() => handleDeleteClick(user)}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Șterge
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL CONFIRMARE ȘTERGERE */}
      {showDeleteModal && userToDelete && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" 
          style={{ 
            position: 'fixed',
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0,
            width: '100vw',
            height: '100vh',
            margin: 0,
            padding: '1rem'
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-red-500 to-red-600 p-4 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold">Confirmă ștergerea</h3>
                  <p className="text-sm text-red-100">Această acțiune este ireversibilă</p>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white font-bold text-lg">
                  {userToDelete.name?.charAt(0).toUpperCase() || "?"}
                </div>
                <div>
                  <p className="text-sm text-slate-600 mb-1">Ești sigur că vrei să ștergi utilizatorul:</p>
                  <p className="font-bold text-slate-900 text-lg">{userToDelete.name}</p>
                  {userToDelete.function && (
                    <p className="text-sm text-slate-500">{userToDelete.function}</p>
                  )}
                </div>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-amber-800 flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Toate datele asociate (pontaj, concedii) vor fi șterse permanent.</span>
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={cancelDelete}
                  className="flex-1 px-4 py-2.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-sm font-semibold transition-colors"
                >
                  Anulează
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 text-sm font-semibold transition-all duration-200 shadow-lg hover:shadow-red-500/50 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Șterge definitiv
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSS pentru animație shake */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.5s;
        }
      `}</style>
    </div>
  );
};

export default UsersManagementPanel;
