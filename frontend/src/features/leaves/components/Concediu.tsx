import React, { useEffect, useMemo, useState, useRef } from "react";
import { LeaveRequestPDF } from "@/features/pdf";
import { PDFFieldMapper } from "@/features/pdf";
import { leaveService } from "../services/leaveService";
import { employeeService } from "@/shared/services/employeeService";
import { toUtcMidnight, calcDaysInclusive } from "../utils/leave.utils";
import { FetchError } from "@/shared/types/api.types";
import type { Leave, LeaveRequest, TimesheetConflictData, LeaveOverlapData, LeaveFormState } from "../types/leave.types";
import type { Employee } from "@/shared/types/employee.types";

/**
 * Concediu Component
 * - Încarcă angajați + concedii STRICT pe workplaceId primit din AdminFarmacieDashboard
 * - Creează / editează / șterge cereri
 * - Filtre (toate/aprobate/respinse/in asteptare)
 * - Zilele se calculează automat: (end - start) + 1 (inclusiv)
 */

interface ConcediuProps {
  workplaceId: string;
  workplaceName?: string;
  activeTab?: "toate" | "in_asteptare" | "aprobate" | "respinse";
  onChangeTab?: (tab: "toate" | "in_asteptare" | "aprobate" | "respinse") => void;
  openNewLeave?: boolean;
  onCloseNewLeave?: () => void;
  refreshKey?: number;
}

const Concediu: React.FC<ConcediuProps> = ({
  workplaceId,
  workplaceName,
  activeTab = "toate",
  openNewLeave,
  onCloseNewLeave,
  refreshKey,
}) => {

  // DATA
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);

  // UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // EDIT
  const [editingLeave, setEditingLeave] = useState<Leave | null>(null);
  
  // DELETE MODAL
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [leaveToDelete, setLeaveToDelete] = useState<Leave | null>(null);
  
  // TIMESHEET CONFLICT MODAL
  const [showTimesheetConflictModal, setShowTimesheetConflictModal] = useState(false);
  const [timesheetConflictData, setTimesheetConflictData] = useState<TimesheetConflictData | null>(null);
  
  // LEAVE OVERLAP MODAL
  const [showLeaveOverlapModal, setShowLeaveOverlapModal] = useState(false);
  const [leaveOverlapData, setLeaveOverlapData] = useState<LeaveOverlapData | null>(null);
  
  // PDF
  const [showPDF, setShowPDF] = useState(false);
  const [pdfLeave, setPdfLeave] = useState<Leave | null>(null);
  const [showMapper, setShowMapper] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // FORM
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<LeaveFormState>({
    employeeId: "",
    function: "",
    startDate: "",
    endDate: "",
    type: "",
    reason: "",
    directSupervisorName: "",
  });
  const [useCustomFunction, setUseCustomFunction] = useState(false);

  // ✅ când apeși "Cerere nouă concediu" din sidebar
  useEffect(() => {
    if (openNewLeave) {
      setShowForm(true);
      setEditingLeave(null);
      setError("");
      setFormData({
        employeeId: "",
        function: "",
        startDate: "",
        endDate: "",
        type: "",
        reason: "",
        directSupervisorName: "",
      });
    } else {
      setShowForm(false);
    }
  }, [openNewLeave]);

  // ✅ Reset hard când se schimbă farmacia
  useEffect(() => {
    setEmployees([]);
    setLeaves([]);
    setEditingLeave(null);
    setError("");
  }, [workplaceId]);

  // ✅ Reîncarcă datele când componenta este montată sau când workplaceId se schimbă
  useEffect(() => {
    if (!workplaceId) return;
    loadEmployeesAndLeaves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workplaceId]);
  
  // ✅ Reîncarcă datele când componenta devine vizibilă din nou
  const prevActiveTabRef = useRef(activeTab);
  
  useEffect(() => {
    if (!workplaceId) return;
    
    if (prevActiveTabRef.current !== activeTab) {
      prevActiveTabRef.current = activeTab;
      if (!showForm) {
        loadEmployeesAndLeaves();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, workplaceId, showForm]);

  // ✅ Reîncarcă datele când se schimbă refreshKey
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0 && !showForm) {
      loadEmployeesAndLeaves();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const loadEmployeesAndLeaves = async () => {
    if (!workplaceId) return;

    setLoading(true);
    setError("");

    try {
      const [empData, leaveData] = await Promise.all([
        employeeService.getByWorkplace(workplaceId),
        leaveService.getByWorkplace(workplaceId),
      ]);

      console.log('═══════════════════════════════════════');
      console.log('📥 ÎNCĂRCARE LEAVE-URI DIN BACKEND');
      console.log('📥 Număr leave-uri:', leaveData.length);
      if (leaveData.length > 0) {
        console.log('📥 Primul leave (exemplu):', JSON.stringify(leaveData[0], null, 2));
        console.log('📥 Primul leave directSupervisorName:', leaveData[0]?.directSupervisorName);
      }
      console.log('═══════════════════════════════════════');

      setEmployees(empData);
      setLeaves(leaveData);
    } catch (err) {
      console.error("Eroare încărcare concedii:", err);
      setEmployees([]);
      setLeaves([]);
      setError("Nu s-au putut încărca datele pentru concedii.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Căutare după nume angajat
  const [searchEmployeeName, setSearchEmployeeName] = useState("");

  const filteredLeaves = useMemo(() => {
    let filtered = leaves;
    
    // Filtrare pe status în funcție de activeTab
    if (activeTab === "in_asteptare") {
      filtered = filtered.filter((r) => r.status === "În așteptare");
    } else if (activeTab === "aprobate") {
      filtered = filtered.filter((r) => r.status === "Aprobată");
    } else if (activeTab === "respinse") {
      filtered = filtered.filter((r) => r.status === "Respinsă");
    }
    
    // Filtrare după nume angajat
    if (searchEmployeeName.trim()) {
      const searchLower = searchEmployeeName.toLowerCase().trim();
      filtered = filtered.filter((r) => {
        const employeeName = (r.name || "").toLowerCase();
        return employeeName.includes(searchLower);
      });
    }
    
    // ✅ Sortare descrescătoare după data creării
    filtered = [...filtered].sort((a, b) => {
      const dateA = new Date(a.createdAt || a._id || 0);
      const dateB = new Date(b.createdAt || b._id || 0);
      return dateB.getTime() - dateA.getTime();
    });
    
    return filtered;
  }, [leaves, activeTab, searchEmployeeName]);

  // ✅ zile calculate automat (inclusiv)
  const computedDays = useMemo(() => {
    const d = calcDaysInclusive(formData.startDate, formData.endDate);
    return Number.isFinite(d) ? d : 0;
  }, [formData.startDate, formData.endDate]);

  // ✅ validare date
  const dateError = useMemo(() => {
    if (!formData.startDate || !formData.endDate) return "";
    const s = toUtcMidnight(formData.startDate);
    const e = toUtcMidnight(formData.endDate);
    if (!s || !e) return "Date invalide.";
    if (e.getTime() < s.getTime())
      return "Data de sfârșit nu poate fi înainte de data de start.";
    return "";
  }, [formData.startDate, formData.endDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workplaceId) return;

    if (dateError) {
      setError(dateError);
      return;
    }
    if (!computedDays || computedDays < 1) {
      setError("Selectează un interval valid (minim 1 zi).");
      return;
    }

    if (!formData.directSupervisorName || formData.directSupervisorName.trim() === '') {
      console.error('❌ EROARE: Câmpul "Nume și prenume șef direct" nu este completat!');
      setError('Te rog completează câmpul "Nume și prenume șef direct"');
      setLoading(false);
      return;
    }

    const payload: LeaveRequest = {
      employeeId: formData.employeeId,
      workplaceId,
      function: formData.function,
      startDate: formData.startDate,
      endDate: formData.endDate,
      type: formData.type as LeaveRequest['type'],
      reason: formData.reason,
      days: computedDays, // ✅ Număr de zile calculat (inclusiv start și end)
      directSupervisorName: formData.directSupervisorName.trim(),
    };
    
    const isEdit = !!editingLeave;
    
    console.log('═══════════════════════════════════════');
    console.log('📤 TRIMITERE CERERE CONCEDIU');
    console.log('📤 FormData complet:', formData);
    console.log('📤 directSupervisorName din formData:', formData.directSupervisorName);
    console.log('📤 Payload trimis la backend:', JSON.stringify(payload, null, 2));
    console.log('═══════════════════════════════════════');

    try {
      setLoading(true);
      setError("");

      if (isEdit) {
        // Update existing leave
        await leaveService.update(editingLeave._id, payload);
      } else {
        // Create new leave
        await leaveService.create(payload);
      }

      await loadEmployeesAndLeaves();

      setFormData({
        employeeId: "",
        function: "",
        startDate: "",
        endDate: "",
        type: "",
        reason: "",
        directSupervisorName: "",
      });
      setUseCustomFunction(false);
      setEditingLeave(null);
      setShowForm(false);
      onCloseNewLeave?.();
    } catch (err) {
      console.error('❌ EROARE LA SALVAREA CERERII:', err);
      
      // ✅ Verifică conflict cu pontaj
      if (err instanceof FetchError && err.status === 409) {
        const errorData = err.data as any;
        if (errorData?.code === "TIMESHEET_CONFLICT") {
          setTimesheetConflictData({
            leave: errorData.leave,
            conflictingTimesheets: errorData.conflictingTimesheets || [],
            isNewLeave: !isEdit,
          });
          setShowTimesheetConflictModal(true);
          setLoading(false);
          return;
        }
        
        // ✅ Verifică suprapunere cu alte concedii
        if (errorData?.code === "LEAVE_OVERLAP") {
          setLeaveOverlapData({
            conflicts: errorData.conflicts || [],
            message: errorData.message || "",
            isNewLeave: !isEdit,
          });
          setShowLeaveOverlapModal(true);
          setLoading(false);
          return;
        }
      }
      
      // ✅ Alte erori
      const errorMessage = err instanceof FetchError 
        ? (err.data?.error || err.message || "Eroare server")
        : (err instanceof Error ? err.message : "Eroare la salvarea cererii!");
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const startEditLeave = (leave: Leave) => {
    const employeeIdStr = typeof leave.employeeId === 'string' 
      ? leave.employeeId 
      : String((leave.employeeId as any)?._id || leave.employeeId || "");

    setEditingLeave(leave);
    setShowForm(false);
    setError("");
    
    const leaveFunction = leave.function || "";
    const predefinedFunctions = ["Farmacist", "Farmacist Șef", "Asistent"];
    const isPredefined = predefinedFunctions.includes(leaveFunction);
    
    setFormData({
      employeeId: employeeIdStr,
      function: leaveFunction,
      startDate: String(leave.startDate || "").slice(0, 10) || "",
      endDate: String(leave.endDate || "").slice(0, 10) || "",
      type: leave.type || "",
      reason: leave.reason || "",
      directSupervisorName: leave.directSupervisorName || "",
    });
    setUseCustomFunction(!isPredefined && leaveFunction !== "");
    onCloseNewLeave?.();
  };

  const handleDeleteClick = (leave: Leave) => {
    setLeaveToDelete(leave);
    setShowDeleteModal(true);
  };

  const confirmDeleteLeave = async () => {
    if (!leaveToDelete) return;
    
    setShowDeleteModal(false);
    setError("");

    try {
      setLoading(true);
      await leaveService.delete(leaveToDelete._id);
      await loadEmployeesAndLeaves();
      setLeaveToDelete(null);
    } catch (err) {
      console.error(err);
      setError(String((err as Error).message || "Eroare la ștergere!"));
    } finally {
      setLoading(false);
    }
  };

  const cancelDeleteLeave = () => {
    setShowDeleteModal(false);
    setLeaveToDelete(null);
  };

  // Blochează scroll-ul paginii când modalul este deschis
  useEffect(() => {
    if (showDeleteModal || showTimesheetConflictModal || showLeaveOverlapModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showDeleteModal, showTimesheetConflictModal, showLeaveOverlapModal]);

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

  return (
    <section className="space-y-6">
      {/* HEADER */}
      {!openNewLeave && (
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Concedii</h1>
            <p className="text-sm text-slate-500">
              {workplaceName ? `Farmacie: ${workplaceName}` : "Farmacie: —"}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                console.log('🔘 Buton Map PDF Fields apăsat');
                setShowPasswordModal(true);
                setPasswordInput("");
                setPasswordError("");
              }}
              className="px-3 py-1.5 bg-slate-300 text-slate-700 text-xs rounded-lg hover:bg-slate-400 transition-colors shadow-sm"
              title="Deschide tool-ul de mapping pentru câmpurile PDF"
            >
              🗺️ Map PDF Fields
            </button>

            <button
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-medium shadow-md hover:from-emerald-600 hover:to-emerald-700 transition-all duration-200 hover:shadow-lg"
              onClick={() => {
                setShowForm(true);
                setEditingLeave(null);
                setError("");
                setFormData({
                  employeeId: "",
                  function: "",
                  startDate: "",
                  endDate: "",
                  type: "",
                  reason: "",
                  directSupervisorName: "",
                });
                onCloseNewLeave?.();
              }}
            >
              + Cerere nouă
            </button>
          </div>
        </div>
      )}

      {/* ERROR / LOADING */}
      {error && (
        <div className="border border-red-200 bg-red-50 rounded-xl p-4">
          <p className="text-sm font-medium text-red-800">{error}</p>
        </div>
      )}

      {loading && (
        <div className="border border-slate-200 bg-slate-50 rounded-xl p-4">
          <p className="text-sm text-slate-600">Se încarcă…</p>
        </div>
      )}

      {/* ✅ Căutare după nume angajat */}
      {!showForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Caută după nume angajat..."
              value={searchEmployeeName}
              onChange={(e) => setSearchEmployeeName(e.target.value)}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            {searchEmployeeName && (
              <button
                onClick={() => setSearchEmployeeName("")}
                className="px-3 py-2 text-slate-500 hover:text-slate-700 transition-colors"
                title="Șterge căutarea"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* FORM */}
      {(showForm || openNewLeave) && (
        <div className="border border-slate-200 bg-slate-50 rounded-xl p-6">
          {openNewLeave && (
            <div className="mb-4 pb-4 border-b border-slate-200">
              <h1 className="text-xl font-semibold text-slate-900">Cerere nouă concediu</h1>
              <p className="text-sm text-slate-500">
                {workplaceName ? `Farmacie: ${workplaceName}` : "Farmacie: —"}
              </p>
            </div>
          )}
          <h3 className={`text-md font-semibold mb-4 ${openNewLeave ? 'hidden' : ''}`}>
            {editingLeave ? "Editează cerere concediu" : "Cerere nouă concediu"}
          </h3>

          <form
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
            onSubmit={handleSubmit}
          >
            {editingLeave ? (
              <div className="w-full border border-slate-200 bg-slate-50 px-3 py-2 rounded text-slate-900 flex items-center">
                {editingLeave.name || "—"}
                <input type="hidden" value={formData.employeeId} />
              </div>
            ) : (
              <select
                className="w-full border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                value={formData.employeeId}
                onChange={(e) =>
                  setFormData({ ...formData, employeeId: e.target.value })
                }
                required
              >
                <option value="">Selectează angajat</option>
                {employees.map((e) => (
                  <option key={e._id} value={e._id}>
                    {e.name}
                  </option>
                ))}
              </select>
            )}

            {!useCustomFunction ? (
              <select
                className="border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                value={formData.function}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "custom") {
                    setUseCustomFunction(true);
                    setFormData({ ...formData, function: "" });
                  } else {
                    setFormData({ ...formData, function: value });
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
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="flex-1 border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  placeholder="Introdu funcția custom"
                  value={formData.function}
                  onChange={(e) =>
                    setFormData({ ...formData, function: e.target.value })
                  }
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    setUseCustomFunction(false);
                    setFormData({ ...formData, function: "" });
                  }}
                  className="px-2 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                  title="Revino la opțiunile predefinite"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            <select
              className="border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
              value={formData.type}
              onChange={(e) =>
                setFormData({ ...formData, type: e.target.value })
              }
              required
            >
              <option value="">Tip concediu</option>
              <option value="odihna">Concediu de odihnă</option>
              <option value="medical">Concediu medical</option>
              <option value="eveniment">Eveniment special</option>
              <option value="fara_plata">Fără plată</option>
            </select>

            <div className="md:col-span-2 flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Data început
                </label>
                <input
                  type="date"
                  className="w-full max-w-[180px] border px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  value={formData.startDate}
                  onChange={(e) => {
                    setFormData({ ...formData, startDate: e.target.value });
                    setError("");
                  }}
                  required
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Data sfârșit
                </label>
                <input
                  type="date"
                  className="w-full max-w-[180px] border px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  value={formData.endDate}
                  onChange={(e) => {
                    setFormData({ ...formData, endDate: e.target.value });
                    setError("");
                  }}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Zile (auto)
              </label>
              <div className="w-full max-w-[180px] border px-3 py-2 rounded bg-white flex items-center justify-between text-sm">
                <span className="text-slate-600">Zile</span>
                <span className="font-semibold text-slate-900">
                  {dateError ? "—" : computedDays || "—"}
                </span>
              </div>
            </div>

            <textarea
              className="md:col-span-3 border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
              placeholder="Motiv"
              value={formData.reason}
              onChange={(e) =>
                setFormData({ ...formData, reason: e.target.value })
              }
              required
            />

            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nume și prenume șef direct
              </label>
              <input
                type="text"
                className="w-full border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                placeholder="Introdu numele și prenumele șefului direct"
                value={formData.directSupervisorName}
                onChange={(e) =>
                  setFormData({ ...formData, directSupervisorName: e.target.value })
                }
                required
              />
            </div>

            {dateError && (
              <div className="md:col-span-3">
                <p className="text-sm text-red-700">{dateError}</p>
              </div>
            )}

            <div className="md:col-span-3 flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                onClick={() => {
                  setShowForm(false);
                  setEditingLeave(null);
                  onCloseNewLeave?.();
                  setError("");
                }}
              >
                {openNewLeave ? "Închide" : "Anulează"}
              </button>

              <button
                type="submit"
                disabled={!!dateError || !computedDays || loading}
                className={`px-5 py-2 rounded text-white font-medium transition-all duration-200 ${
                  !!dateError || !computedDays || loading
                    ? "bg-slate-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-md hover:shadow-emerald-500/50"
                }`}
              >
                {editingLeave ? "Salvează modificările" : "Trimite cererea"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* LIST */}
      {!showForm && (
        <>
          {filteredLeaves.length === 0 ? (
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
            <div className="grid gap-4">
              {filteredLeaves.map((req) => {
                const isEditingThis = editingLeave && String(editingLeave._id) === String(req._id);

                return (
                  <div
                    key={req._id}
                    className={`bg-white border rounded-xl shadow-sm transition-all duration-200 ${
                      isEditingThis 
                        ? "border-blue-400 shadow-lg ring-2 ring-blue-200" 
                        : "border-slate-200 hover:shadow-md hover:border-slate-300"
                    }`}
                  >
                    {!isEditingThis ? (
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-semibold text-sm">
                                {(req.name || "—").charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="font-semibold text-slate-900 truncate">
                                  {req.name || "—"}
                                </h3>
                                <p className="text-xs text-slate-500">
                                  {req.function || "—"}
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
                                <span className="capitalize">{req.type || "—"}</span>
                              </div>

                              {req.reason && (
                                <p className="text-sm text-slate-600 mt-2 line-clamp-2">
                                  {req.reason}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-3">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                                req.status
                              )}`}
                            >
                              {req.status}
                            </span>

                            <div className="flex items-center gap-2">
                              <button
                                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-medium rounded-lg shadow-sm hover:from-emerald-600 hover:to-emerald-700 transition-all duration-200 hover:shadow-md flex items-center gap-1.5"
                                onClick={() => {
                                  const employeeIdStr = typeof req.employeeId === 'string' 
                                    ? req.employeeId 
                                    : String((req.employeeId as any)?._id || req.employeeId || '');
                                  
                                  const emp = employees.find(e => {
                                    const empIdStr = String(e._id || '');
                                    return empIdStr === employeeIdStr;
                                  });
                                  
                                  if (emp) {
                                    console.log('═══════════════════════════════════════');
                                    console.log('📄 GENERARE PDF - DATE LEAVE');
                                    console.log('📄 Leave complet:', JSON.stringify(req, null, 2));
                                    console.log('📄 Leave directSupervisorName:', req.directSupervisorName);
                                    setPdfLeave(req);
                                    setShowPDF(true);
                                  } else {
                                    console.error('❌ Angajatul nu a fost găsit', {
                                      employeeIdStr,
                                      availableIds: employees.map(e => String(e._id)),
                                    });
                                    alert('Angajatul nu a fost găsit pentru această cerere.');
                                  }
                                }}
                              >
                                <svg
                                  className="h-4 w-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                  />
                                </svg>
                                Descarcă
                              </button>
                              
                              <div className="flex items-center gap-2">
                                <button
                                  className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-blue-700 transition-all duration-200 hover:shadow-md flex items-center gap-1.5"
                                  onClick={() => startEditLeave(req)}
                                >
                                  <svg
                                    className="h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                    />
                                  </svg>
                                  Editează
                                </button>
                                <button
                                  className="px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-red-700 transition-all duration-200 hover:shadow-md flex items-center gap-1.5"
                                  onClick={() => handleDeleteClick(req)}
                                >
                                  <svg
                                    className="h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                  </svg>
                                  Șterge
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-5">
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                            <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Editează cerere concediu
                          </h3>
                          <button
                            onClick={() => {
                              setEditingLeave(null);
                              setError("");
                            }}
                            className="text-slate-500 hover:text-slate-700 transition-colors"
                            title="Anulează editarea"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>

                        {error && (
                          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            {error}
                          </div>
                        )}

                        <form
                          onSubmit={handleSubmit}
                          className="grid grid-cols-1 md:grid-cols-3 gap-4"
                        >
                          <div className="w-full border border-slate-200 bg-slate-50 px-3 py-2 rounded text-slate-900 flex items-center">
                            {req.name || "—"}
                            <input type="hidden" value={formData.employeeId} />
                          </div>

                          {!useCustomFunction ? (
                            <select
                              className="border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                              value={formData.function}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === "custom") {
                                  setUseCustomFunction(true);
                                  setFormData({ ...formData, function: "" });
                                } else {
                                  setFormData({ ...formData, function: value });
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
                          ) : (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                className="flex-1 border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                                placeholder="Introdu funcția custom"
                                value={formData.function}
                                onChange={(e) =>
                                  setFormData({ ...formData, function: e.target.value })
                                }
                                required
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setUseCustomFunction(false);
                                  setFormData({ ...formData, function: "" });
                                }}
                                className="px-2 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                                title="Revino la opțiunile predefinite"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          )}

                          <select
                            className="border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                            value={formData.type}
                            onChange={(e) =>
                              setFormData({ ...formData, type: e.target.value })
                            }
                            required
                          >
                            <option value="">Tip concediu</option>
                            <option value="odihna">Concediu de odihnă</option>
                            <option value="medical">Concediu medical</option>
                            <option value="eveniment">Eveniment special</option>
                            <option value="fara_plata">Fără plată</option>
                          </select>

                          <input
                            type="date"
                            className="border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                            value={formData.startDate}
                            onChange={(e) =>
                              setFormData({ ...formData, startDate: e.target.value })
                            }
                            required
                          />

                          <input
                            type="date"
                            className="border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                            value={formData.endDate}
                            onChange={(e) =>
                              setFormData({ ...formData, endDate: e.target.value })
                            }
                            required
                          />

                          <div className="border px-3 py-2 rounded bg-white flex items-center justify-between">
                            <span className="text-sm text-slate-600">Zile (auto)</span>
                            <span className="text-sm font-semibold text-slate-900">
                              {dateError ? "—" : computedDays || "—"}
                            </span>
                          </div>

                          <div className="md:col-span-3">
                            <textarea
                              className="w-full border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors resize-none"
                              rows={3}
                              placeholder="Motivul concediului"
                              value={formData.reason}
                              onChange={(e) =>
                                setFormData({ ...formData, reason: e.target.value })
                              }
                              required
                            />
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Nume și prenume șef direct
                            </label>
                            <input
                              type="text"
                              className="w-full border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                              placeholder="Introdu numele și prenumele șefului direct"
                              value={formData.directSupervisorName}
                              onChange={(e) =>
                                setFormData({ ...formData, directSupervisorName: e.target.value })
                              }
                              required
                            />
                          </div>

                          {dateError && (
                            <div className="md:col-span-3">
                              <p className="text-sm text-red-700">{dateError}</p>
                            </div>
                          )}

                          <div className="md:col-span-3 flex justify-end gap-3">
                            <button
                              type="button"
                              className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                              onClick={() => {
                                setEditingLeave(null);
                                setError("");
                              }}
                            >
                              Anulează
                            </button>

                            <button
                              type="submit"
                              disabled={!!dateError || !computedDays || loading}
                              className={`px-5 py-2 rounded text-white ${
                                !!dateError || !computedDays || loading
                                  ? "bg-slate-400 cursor-not-allowed"
                                  : "bg-blue-600 hover:bg-blue-700"
                              }`}
                            >
                              {loading ? "Salvează..." : "Salvează modificările"}
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Modal Parolă pentru PDF Field Mapper */}
      {showPasswordModal && (
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
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-4 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold">Acces Protejat</h3>
                  <p className="text-sm text-purple-100">Introdu parola pentru a accesa PDF Field Mapper</p>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Parolă
                </label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setPasswordError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const correctPassword = "123456";
                      if (passwordInput === correctPassword) {
                        setShowPasswordModal(false);
                        setShowMapper(true);
                        setPasswordInput("");
                        setPasswordError("");
                      } else {
                        setPasswordError("Parolă incorectă!");
                        setPasswordInput("");
                      }
                    }
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                  placeholder="Introdu parola"
                  autoFocus
                />
                {passwordError && (
                  <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {passwordError}
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordInput("");
                    setPasswordError("");
                  }}
                  className="flex-1 px-4 py-2.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-sm font-semibold transition-colors"
                >
                  Anulează
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const correctPassword = "123456";
                    if (passwordInput === correctPassword) {
                      setShowPasswordModal(false);
                      setShowMapper(true);
                      setPasswordInput("");
                      setPasswordError("");
                    } else {
                      setPasswordError("Parolă incorectă!");
                      setPasswordInput("");
                    }
                  }}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 text-sm font-semibold transition-all duration-200 shadow-lg hover:shadow-purple-500/50 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Confirmă
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF Field Mapper */}
      {showMapper && (
        <PDFFieldMapper
          onSave={(template) => {
            console.log('✅ Template salvat:', template);
            setShowMapper(false);
            alert('Template salvat cu succes! Acum poți genera PDF-uri.');
          }}
          onCancel={() => {
            console.log('❌ Anulare mapping');
            setShowMapper(false);
          }}
        />
      )}

      {/* PDF Modal */}
      {showPDF && pdfLeave && (() => {
        const employeeIdStr = typeof pdfLeave.employeeId === 'string' 
          ? pdfLeave.employeeId 
          : String((pdfLeave.employeeId as any)?._id || pdfLeave.employeeId || '');
        
        const foundEmployee = employees.find(e => {
          const empIdStr = String(e._id || '');
          return empIdStr === employeeIdStr;
        });
        
        if (!foundEmployee || !workplaceName) {
          return null;
        }
        
        return (
          <LeaveRequestPDF
            leave={pdfLeave}
            employee={foundEmployee}
            workplaceName={workplaceName}
            onClose={() => {
              setShowPDF(false);
              setPdfLeave(null);
            }}
          />
        );
      })()}

      {/* Modal ștergere cerere concediu */}
      {showDeleteModal && leaveToDelete && (
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
            <div className={`p-4 text-white ${leaveToDelete.status === "Aprobată" ? "bg-gradient-to-r from-red-500 to-red-600" : "bg-gradient-to-r from-amber-500 to-amber-600"}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold">
                    {leaveToDelete.status === "Aprobată" ? "⚠️ ATENȚIE!" : "Confirmă ștergerea"}
                  </h3>
                  <p className="text-sm text-white/90">
                    {leaveToDelete.status === "Aprobată" 
                      ? "Cererea este aprobată și apare în calendar" 
                      : "Această acțiune este ireversibilă"}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-slate-600 mb-2">
                  Ești sigur că vrei să ștergi cererea de concediu pentru:
                </p>
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <p className="font-bold text-slate-900 text-lg mb-1">{leaveToDelete.name}</p>
                  {leaveToDelete.function && (
                    <p className="text-sm text-slate-600 mb-2">{leaveToDelete.function}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-slate-600 mt-2">
                    <div className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>
                        {new Date(leaveToDelete.startDate).toLocaleDateString('ro-RO')} - {new Date(leaveToDelete.endDate).toLocaleDateString('ro-RO')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{leaveToDelete.days} {leaveToDelete.days === 1 ? 'zi' : 'zile'}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {leaveToDelete.status === "Aprobată" && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-red-800 font-semibold mb-2 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Această acțiune va:
                  </p>
                  <ul className="text-xs text-red-700 space-y-1 ml-7">
                    <li>• Șterge cererea definitiv din sistem</li>
                    <li>• Elimina cererea din calendarul de concedii</li>
                    <li>• Nu poate fi anulată</li>
                  </ul>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={cancelDeleteLeave}
                  className="flex-1 px-4 py-2.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-sm font-semibold transition-colors"
                >
                  Anulează
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteLeave}
                  className={`flex-1 px-4 py-2.5 text-white rounded-lg text-sm font-semibold transition-all duration-200 shadow-lg hover:shadow-red-500/50 flex items-center justify-center gap-2 ${
                    leaveToDelete.status === "Aprobată"
                      ? "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
                      : "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
                  }`}
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

      {/* Modal conflict cu pontaj */}
      {showTimesheetConflictModal && timesheetConflictData && (
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
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden">
            <div className="p-4 text-white bg-gradient-to-r from-red-500 to-red-600">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold">⚠️ Conflict cu pontaj</h3>
                  <p className="text-sm text-white/90">
                    {timesheetConflictData.isNewLeave 
                      ? "Nu poți crea cererea de concediu - există ore lucrate în perioada selectată"
                      : "Nu poți edita cererea de concediu - există ore lucrate în perioada selectată"}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <div className="mb-4">
                <p className="text-sm text-slate-700 mb-4">
                  {timesheetConflictData.isNewLeave 
                    ? "Nu poți crea cererea de concediu deoarece există pontaj (ore lucrate) în perioada selectată."
                    : "Nu poți edita cererea de concediu deoarece există pontaj (ore lucrate) în perioada selectată."}
                </p>
                
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-red-800 font-semibold mb-2 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Ce trebuie să faci:
                  </p>
                  <ol className="list-decimal list-inside text-sm text-red-700 space-y-2 ml-2">
                    <li>Mergi în secțiunea <strong>"Pontaj"</strong> și șterge pontajul pentru perioada respectivă</li>
                    {timesheetConflictData.isNewLeave ? (
                      <li>După ce ai șters pontajul, poți crea cererea de concediu din nou</li>
                    ) : (
                      <>
                        <li>Sau șterge cererea de concediu din <strong>"Istoric cereri"</strong> și refă-o cu datele corecte</li>
                        <li>După ce ai rezolvat problema, poți edita cererea de concediu din nou</li>
                      </>
                    )}
                  </ol>
                </div>

                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 mb-4">
                  <p className="text-sm font-semibold text-slate-900 mb-2">Perioada cererii de concediu:</p>
                  <div className="flex items-center gap-4 text-sm text-slate-600">
                    <div className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>
                        {new Date(timesheetConflictData.leave.startDate).toLocaleDateString('ro-RO')} - {new Date(timesheetConflictData.leave.endDate).toLocaleDateString('ro-RO')}
                      </span>
                    </div>
                  </div>
                </div>

                {timesheetConflictData.conflictingTimesheets && timesheetConflictData.conflictingTimesheets.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-amber-900 mb-3">Pontaj existent:</p>
                    <div className="space-y-3">
                      {timesheetConflictData.conflictingTimesheets.map((ts, idx) => (
                        <div key={idx} className="bg-white rounded-lg p-3 border border-amber-200">
                          <div className="flex items-center gap-2 mb-2">
                            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-sm font-semibold text-amber-900">
                              {new Date(ts.date).toLocaleDateString('ro-RO')}
                            </span>
                          </div>
                          {ts.entries && ts.entries.length > 0 && (
                            <div className="space-y-1 ml-6">
                              {ts.entries.map((entry, entryIdx) => (
                                <div key={entryIdx} className="text-xs text-amber-800">
                                  <span className="font-medium">{entry.workplaceName || "Farmacie"}:</span>{" "}
                                  {entry.startTime} - {entry.endTime} ({entry.hoursWorked}h)
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowTimesheetConflictModal(false);
                    setTimesheetConflictData(null);
                    setEditingLeave(null);
                    setError("");
                  }}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-semibold transition-colors"
                >
                  Înțeleg
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal suprapunere concedii */}
      {showLeaveOverlapModal && leaveOverlapData && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" 
          style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {leaveOverlapData.isNewLeave 
                      ? "Nu poți crea cererea de concediu - există concedii suprapuse"
                      : "Nu poți edita cererea de concediu - există concedii suprapuse"}
                  </h3>
                </div>
              </div>
              
              <div className="space-y-4">
                <p className="text-sm text-slate-700">
                  {leaveOverlapData.message || "Există deja concedii aprobate care se suprapun cu perioada selectată."}
                </p>

                {leaveOverlapData.conflicts && leaveOverlapData.conflicts.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-amber-900 mb-3">Concedii suprapuse:</p>
                    <div className="space-y-3">
                      {leaveOverlapData.conflicts.map((conflict, idx) => (
                        <div key={idx} className="bg-white rounded-lg p-3 border border-amber-200">
                          <div className="flex items-center gap-2 mb-2">
                            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-sm font-semibold text-amber-900">
                              {conflict.startDate} - {conflict.endDate}
                            </span>
                          </div>
                          <div className="text-xs text-amber-800 space-y-1">
                            <div>
                              <span className="font-medium">Tip:</span> {conflict.type === 'odihna' ? 'Concediu de odihnă' : 
                                                                        conflict.type === 'medical' ? 'Concediu medical' :
                                                                        conflict.type === 'fara_plata' ? 'Concediu fără plată' :
                                                                        conflict.type === 'eveniment' ? 'Eveniment special' : conflict.type}
                            </div>
                            <div>
                              <span className="font-medium">Zile:</span> {conflict.days} {conflict.days === 1 ? 'zi' : 'zile'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-blue-900 mb-2">Ce poți face:</p>
                  <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                    {leaveOverlapData.isNewLeave ? (
                      <>
                        <li>Modifică perioada cererii de concediu pentru a evita suprapunerea</li>
                        <li>Editează sau șterge concediile existente care se suprapun</li>
                        <li>După ce ai rezolvat suprapunerea, poți crea cererea de concediu din nou</li>
                      </>
                    ) : (
                      <>
                        <li>Modifică perioada cererii curente pentru a evita suprapunerea</li>
                        <li>Editează sau șterge concediile existente care se suprapun</li>
                        <li>După ce ai rezolvat suprapunerea, poți salva modificările</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
              
              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowLeaveOverlapModal(false);
                    setLeaveOverlapData(null);
                    setError("");
                  }}
                  className="flex-1 px-4 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-sm font-semibold transition-colors"
                >
                  Înțeleg
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Concediu;

