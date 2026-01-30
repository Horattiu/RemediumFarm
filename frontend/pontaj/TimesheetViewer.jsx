import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, isSameDay } from "date-fns";
import { ro } from "date-fns/locale";
import AddVisitor from "./AddVisitor";
import PontajWelcomeModal from "./PontajWelcomeModal";

const getApiUrl = () => {
  const url = import.meta.env.VITE_API_URL || "http://localhost:5000";
  return url.replace(/\/$/, "");
};
const API = getApiUrl();

// Helper functions pentru timp
const pad2 = (n) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, i) => pad2(i));
const MINUTES = Array.from({ length: 60 }, (_, i) => pad2(i));

const normalizeTime = (t, fallback = "08:00") => {
  const s = (t ? String(t) : fallback).slice(0, 5);
  const [h = "08", m = "00"] = s.split(":");
  const hh = pad2(Number.isFinite(+h) ? +h : 8);
  const mm = pad2(Number.isFinite(+m) ? +m : 0);
  return `${HOURS.includes(hh) ? hh : "08"}:${MINUTES.includes(mm) ? mm : "00"}`;
};

const toMinutes = (t) => {
  const [h, m] = normalizeTime(t).split(":");
  return Number(h) * 60 + Number(m);
};

const calcWorkMinutes = (start, end) => {
  const s = toMinutes(start);
  let e = toMinutes(end);
  if (e <= s) e += 1440;
  return Math.max(0, e - s);
};

const TimePicker = ({ value, onChange, disabled }) => {
  const [h, m] = normalizeTime(value).split(":");
  const [showHours, setShowHours] = useState(false);
  const [showMinutes, setShowMinutes] = useState(false);
  const [hoursPosition, setHoursPosition] = useState("bottom");
  const [minutesPosition, setMinutesPosition] = useState("bottom");
  const [hourInput, setHourInput] = useState(h);
  const [minuteInput, setMinuteInput] = useState(m);
  const hoursRef = useRef(null);
  const minutesRef = useRef(null);
  const hoursDropdownRef = useRef(null);
  const minutesDropdownRef = useRef(null);
  const hourInputRef = useRef(null);
  const minuteInputRef = useRef(null);

  // Sincronizează input-urile când se schimbă valoarea externă
  useEffect(() => {
    const [newH, newM] = normalizeTime(value).split(":");
    setHourInput(newH);
    setMinuteInput(newM);
  }, [value]);

  // Calculează poziția dropdown-ului pentru a nu ieși din pagină
  useEffect(() => {
    if (showHours && hoursRef.current && hoursDropdownRef.current) {
      const rect = hoursRef.current.getBoundingClientRect();
      const dropdownHeight = 200; // max-h-[200px]
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
        setHoursPosition("top");
      } else {
        setHoursPosition("bottom");
      }
    }
  }, [showHours]);

  useEffect(() => {
    if (showMinutes && minutesRef.current && minutesDropdownRef.current) {
      const rect = minutesRef.current.getBoundingClientRect();
      const dropdownHeight = 200;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
        setMinutesPosition("top");
      } else {
        setMinutesPosition("bottom");
      }
    }
  }, [showMinutes]);

  // Închide dropdown-urile când se face click în afara lor
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (hoursRef.current && !hoursRef.current.contains(event.target)) {
        setShowHours(false);
      }
      if (minutesRef.current && !minutesRef.current.contains(event.target)) {
        setShowMinutes(false);
      }
    };

    if (showHours || showMinutes) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showHours, showMinutes]);

  const selectHour = (hour) => {
    const normalizedHour = pad2(Math.max(0, Math.min(23, parseInt(hour) || 0)));
    onChange(`${normalizedHour}:${m}`);
    setHourInput(normalizedHour);
    setShowHours(false);
  };

  const selectMinute = (minute) => {
    const normalizedMinute = pad2(Math.max(0, Math.min(59, parseInt(minute) || 0)));
    onChange(`${h}:${normalizedMinute}`);
    setMinuteInput(normalizedMinute);
    setShowMinutes(false);
  };

  const handleHourChange = (e) => {
    const input = e.target.value.replace(/\D/g, ""); // Doar cifre
    setHourInput(input);
    
    if (input.length === 2) {
      const hour = Math.max(0, Math.min(23, parseInt(input) || 0));
      const normalizedHour = pad2(hour);
      setHourInput(normalizedHour);
      onChange(`${normalizedHour}:${m}`);
    } else if (input.length === 0) {
      setHourInput("");
    }
  };

  const handleHourBlur = () => {
    const hour = Math.max(0, Math.min(23, parseInt(hourInput) || 0));
    const normalizedHour = pad2(hour);
    setHourInput(normalizedHour);
    onChange(`${normalizedHour}:${m}`);
  };

  const handleMinuteChange = (e) => {
    const input = e.target.value.replace(/\D/g, ""); // Doar cifre
    setMinuteInput(input);
    
    if (input.length === 2) {
      const minute = Math.max(0, Math.min(59, parseInt(input) || 0));
      const normalizedMinute = pad2(minute);
      setMinuteInput(normalizedMinute);
      onChange(`${h}:${normalizedMinute}`);
    } else if (input.length === 0) {
      setMinuteInput("");
    }
  };

  const handleMinuteBlur = () => {
    const minute = Math.max(0, Math.min(59, parseInt(minuteInput) || 0));
    const normalizedMinute = pad2(minute);
    setMinuteInput(normalizedMinute);
    onChange(`${h}:${normalizedMinute}`);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Hour Picker */}
      <div className="relative" ref={hoursRef}>
        <div className="relative">
          <input
            ref={hourInputRef}
            type="text"
            inputMode="numeric"
            maxLength={2}
            disabled={disabled}
            value={hourInput}
            onChange={handleHourChange}
            onBlur={handleHourBlur}
            onFocus={() => {
              hourInputRef.current?.select();
              setShowHours(false);
            }}
            className={`w-[70px] border rounded-lg px-3 py-2.5 text-sm font-medium text-center transition-all ${
              disabled
                ? "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200"
                : "border-slate-300 bg-white text-slate-900 hover:border-emerald-400 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            } ${showHours ? "border-emerald-500 bg-emerald-50" : ""}`}
            placeholder="08"
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (!disabled) {
                setShowHours(!showHours);
                setShowMinutes(false);
              }
            }}
            className={`absolute right-1 top-1/2 -translate-y-1/2 p-1 transition-all ${
              disabled
                ? "text-slate-300 cursor-not-allowed"
                : "text-emerald-500 hover:text-emerald-600 hover:scale-110 cursor-pointer"
            }`}
            aria-label="Deschide dropdown ore"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        {showHours && !disabled && (
          <div
            ref={hoursDropdownRef}
            className={`absolute z-[9999] w-[70px] bg-white border border-slate-200 rounded-lg shadow-xl max-h-[200px] overflow-y-auto overscroll-contain ${
              hoursPosition === "top" ? "bottom-full mb-1" : "top-full mt-1"
            }`}
            style={{
              maxHeight: "200px",
            }}
          >
            <div className="py-1">
              {HOURS.map((hour) => (
                <button
                  key={hour}
                  type="button"
                  onClick={() => selectHour(hour)}
                  className={`w-full px-3 py-2 text-sm text-left hover:bg-emerald-50 transition-colors ${
                    hour === h
                      ? "bg-emerald-100 text-emerald-700 font-semibold"
                      : "text-slate-700 hover:text-emerald-700"
                  }`}
                >
                  {hour}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <span className="text-slate-400 font-medium">:</span>

      {/* Minute Picker */}
      <div className="relative" ref={minutesRef}>
        <div className="relative">
          <input
            ref={minuteInputRef}
            type="text"
            inputMode="numeric"
            maxLength={2}
            disabled={disabled}
            value={minuteInput}
            onChange={handleMinuteChange}
            onBlur={handleMinuteBlur}
            onFocus={() => {
              minuteInputRef.current?.select();
              setShowMinutes(false);
            }}
            className={`w-[70px] border rounded-lg px-3 py-2.5 text-sm font-medium text-center transition-all ${
              disabled
                ? "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200"
                : "border-slate-300 bg-white text-slate-900 hover:border-emerald-400 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            } ${showMinutes ? "border-emerald-500 bg-emerald-50" : ""}`}
            placeholder="00"
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (!disabled) {
                setShowMinutes(!showMinutes);
                setShowHours(false);
              }
            }}
            className={`absolute right-1 top-1/2 -translate-y-1/2 p-1 transition-all ${
              disabled
                ? "text-slate-300 cursor-not-allowed"
                : "text-emerald-500 hover:text-emerald-600 hover:scale-110 cursor-pointer"
            }`}
            aria-label="Deschide dropdown minute"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        {showMinutes && !disabled && (
          <div
            ref={minutesDropdownRef}
            className={`absolute z-[9999] w-[70px] bg-white border border-slate-200 rounded-lg shadow-xl max-h-[200px] overflow-y-auto overscroll-contain ${
              minutesPosition === "top" ? "bottom-full mb-1" : "top-full mt-1"
            }`}
            style={{
              maxHeight: "200px",
            }}
          >
            <div className="py-1">
              {MINUTES.map((min) => (
                <button
                  key={min}
                  type="button"
                  onClick={() => selectMinute(min)}
                  className={`w-full px-3 py-2 text-sm text-left hover:bg-emerald-50 transition-colors ${
                    min === m
                      ? "bg-emerald-100 text-emerald-700 font-semibold"
                      : "text-slate-700 hover:text-emerald-700"
                  }`}
                >
                  {min}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const TimesheetViewer = ({ workplaceId, workplaceName }) => {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [timesheetEntries, setTimesheetEntries] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [allEmployeesForPicker, setAllEmployeesForPicker] = useState([]);
  const [visitorsManual, setVisitorsManual] = useState([]); // vizitatori adăugați doar în sesiune curentă
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Modal state pentru pontare
  const [showPontajModal, setShowPontajModal] = useState(false);
  const [pontajData, setPontajData] = useState(null); // { employee, date }
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:00");
  const [overlapData, setOverlapData] = useState(null); // pentru confirm rescriere pontaj
  const [hasExistingPontaj, setHasExistingPontaj] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Verifică dacă utilizatorul a văzut deja modalul de bun venit
  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem("pontaj-welcome-seen");
    if (!hasSeenWelcome) {
      setShowWelcomeModal(true);
    }
  }, []);

  const handleCloseWelcomeModal = () => {
    setShowWelcomeModal(false);
    localStorage.setItem("pontaj-welcome-seen", "true");
  };

  // Calculează zilele lunii selectate
  const monthDays = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const start = startOfMonth(new Date(year, month - 1, 1));
    const end = endOfMonth(start);
    return eachDayOfInterval({ start, end });
  }, [selectedMonth]);

  const today = useMemo(() => new Date(), []);

  // Încarcă datele pentru luna selectată
  useEffect(() => {
    if (!workplaceId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [year, month] = selectedMonth.split("-").map(Number);
        const start = startOfMonth(new Date(year, month - 1, 1));
        const end = endOfMonth(start);

        const from = format(start, "yyyy-MM-dd");
        const to = format(end, "yyyy-MM-dd");

        // Încarcă pontajul - API-ul returnează entries individuale
        const timesheetsRes = await fetch(
          `${API}/api/pontaj/by-workplace/${workplaceId}?from=${from}&to=${to}`,
          { credentials: "include" }
        );
        const entriesData = await timesheetsRes.json();
        
        // Elimină duplicatele bazate pe employeeId, date, workplaceId, type
        const uniqueEntries = [];
        const seen = new Set();
        (Array.isArray(entriesData) ? entriesData : []).forEach((entry) => {
          const key = `${String(entry.employeeId?._id || entry.employeeId)}_${entry.date}_${String(entry.workplaceId?._id || entry.workplaceId)}_${entry.type || 'home'}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueEntries.push(entry);
          }
        });
        
        setTimesheetEntries(uniqueEntries);

        // Încarcă angajații
        const employeesRes = await fetch(
          `${API}/api/users/by-workplace/${workplaceId}`,
          { credentials: "include" }
        );
        const employeesData = await employeesRes.json();
        setEmployees(Array.isArray(employeesData) ? employeesData : []);
      } catch (err) {
        console.error("Eroare la încărcarea datelor:", err);
        setTimesheetEntries([]);
        setEmployees([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [workplaceId, selectedMonth]);

  // LOAD ALL EMPLOYEES FOR PICKER (vizitatori)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API}/api/users/employees`, { credentials: "include" });
        const data = await res.json();
        if (!alive) return;
        setAllEmployeesForPicker(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        if (alive) setAllEmployeesForPicker([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Vizitatori din pontaj (persistenți) deduși direct din timesheetEntries
  // ✅ IMPORTANT: Verificăm că employeeId-urile există încă înainte de a-i afișa
  const visitorsFromPontaj = useMemo(() => {
    if (!timesheetEntries.length) return [];

    const employeeIdsHere = new Set(employees.map((e) => String(e._id)));
    const allValidEmployeeIds = new Set(
      allEmployeesForPicker
        .filter((e) => e && e.isActive !== false)
        .map((e) => String(e._id))
    );
    const map = new Map();

    timesheetEntries.forEach((entry) => {
      const empId = String(entry.employeeId?._id || entry.employeeId);
      if (employeeIdsHere.has(empId)) return; // deja angajat al farmaciei
      
      // ✅ Verificăm că employeeId-ul există încă și este activ
      if (!allValidEmployeeIds.has(empId)) {
        console.warn("⚠️ Vizitator invalid găsit în pontaj (nu mai există sau este inactiv):", {
          employeeId: empId,
          employeeName: entry.employeeName,
        });
        return; // Skip vizitatori invalizi
      }
      
      if (!map.has(empId)) {
        map.set(empId, {
          _id: empId,
          name: entry.employeeName || "Vizitator",
        });
      }
    });

    return Array.from(map.values());
  }, [timesheetEntries, employees, allEmployeesForPicker]);

  // ✅ Elimină automat din visitorsManual vizitatorii care nu mai au pontaj în luna selectată
  useEffect(() => {
    if (!visitorsManual.length) {
      // Dacă nu sunt vizitatori manuali, nu facem nimic
      return;
    }

    // Creează un set cu toate employeeId-urile care au entry-uri în luna selectată
    const employeeIdsWithEntries = new Set(
      timesheetEntries.map((entry) => String(entry.employeeId?._id || entry.employeeId))
    );

    // Elimină din visitorsManual vizitatorii care nu mai au entry-uri
    setVisitorsManual((prev) => {
      const filtered = prev.filter((visitor) => {
        const visitorId = String(visitor._id);
        // Păstrează vizitatorul dacă are entry-uri în luna selectată
        return employeeIdsWithEntries.has(visitorId);
      });

      // Dacă s-a schimbat ceva, returnează lista filtrată
      if (filtered.length !== prev.length) {
        return filtered;
      }

      return prev;
    });
  }, [timesheetEntries]); // Doar când timesheetEntries se schimbă

  // People in table = employees (farmacie) + visitors din pontaj + visitorsManual, minus cei ascunși
  const peopleInTable = useMemo(() => {
    const map = new Map();
    [...employees, ...visitorsFromPontaj, ...visitorsManual].forEach((p) => {
      if (!p?._id) return;
      map.set(p._id, p);
    });
    return Array.from(map.values());
  }, [employees, visitorsFromPontaj, visitorsManual]);

  const excludeIds = useMemo(() => peopleInTable.map((p) => p._id), [peopleInTable]);

  const visitorIds = useMemo(() => {
    const ids = new Set();
    visitorsFromPontaj.forEach((v) => v?._id && ids.add(v._id));
    visitorsManual.forEach((v) => v?._id && ids.add(v._id));
    return ids;
  }, [visitorsFromPontaj, visitorsManual]);

  const manualVisitorIds = useMemo(
    () => new Set(visitorsManual.map((v) => v._id)),
    [visitorsManual]
  );

  const addVisitorManual = useCallback(
    (emp) => {
      // ✅ Validare strictă: verificăm că employee există și este activ
      if (!emp || !emp._id) {
        console.error("⚠️ Încercare de adăugare vizitator invalid:", emp);
        alert("⚠️ Eroare: Nu se poate adăuga un vizitator invalid.");
        return;
      }
      
      // ✅ Verificăm că employee există în lista de employees disponibili și este activ
      const existsInAllEmployees = allEmployeesForPicker.some(
        (e) => e && String(e._id) === String(emp._id) && e.isActive !== false
      );
      
      if (!existsInAllEmployees) {
        console.error("⚠️ Încercare de adăugare vizitator inexistent sau inactiv:", emp);
        alert("⚠️ Eroare: Angajatul nu mai există sau nu este activ. Nu se poate adăuga ca vizitator.");
        return;
      }
      
      setVisitorsManual((prev) => {
        if (prev.some((v) => v._id === emp._id)) return prev;
        if (employees.some((e) => e._id === emp._id)) return prev;
        return [...prev, emp];
      });
    },
    [employees, allEmployeesForPicker]
  );

  // Funcție pentru reîncărcarea pontajului
  const reloadTimesheets = useCallback(
    async () => {
      const [year, month] = selectedMonth.split("-").map(Number);
      const start = startOfMonth(new Date(year, month - 1, 1));
      const end = endOfMonth(start);
      const from = format(start, "yyyy-MM-dd");
      const to = format(end, "yyyy-MM-dd");

      const timesheetsRes = await fetch(
        `${API}/api/pontaj/by-workplace/${workplaceId}?from=${from}&to=${to}`,
        { credentials: "include" }
      );
      const entriesData = await timesheetsRes.json();

      const uniqueEntries = [];
      const seen = new Set();
      (Array.isArray(entriesData) ? entriesData : []).forEach((entry) => {
        const key = `${String(entry.employeeId?._id || entry.employeeId)}_${entry.date}_${String(entry.workplaceId?._id || entry.workplaceId)}_${entry.type || "home"}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueEntries.push(entry);
        }
      });

      setTimesheetEntries(uniqueEntries);
      return uniqueEntries; // Returnează noile entries pentru verificare
    },
    [selectedMonth, workplaceId]
  );


  // Găsește toate entry-urile pentru un angajat într-o anumită zi
  const getDayEntries = (employeeId, date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return timesheetEntries.filter((entry) => {
      const entryEmployeeId = String(entry.employeeId?._id || entry.employeeId);
      const entryDate = entry.date;
      return entryEmployeeId === String(employeeId) && entryDate === dateStr;
    });
  };

  // Formatează orele pentru afișare
  const formatHours = (hours, minutes) => {
    if (hours === 0 && minutes === 0) return "-";
    const totalMinutes = hours * 60 + minutes;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  // Calculează orele pentru o zi - IMPORTANT:
  // backend-ul trimite atât hoursWorked (ex: 8) cât și minutesWorked (ex: 480) pentru același entry.
  // Dacă le aduni pe ambele, dublezi orele. Deci calculăm în primul rând DIN minute.
  const getDayHours = (entries, date) => {
    if (entries.length === 0) return { hours: 0, minutes: 0 };

    // Verifică dacă există concediu
    const leaveEntry = entries.find((e) => e.leaveType);
    if (leaveEntry) {
      return { isLeave: true, leaveType: leaveEntry.leaveType };
    }

    // Verifică dacă există entry-uri de tip visitor și colectează informații
    const visitorEntries = entries.filter((e) => e.type === "visitor");
    const hasVisitorEntry = visitorEntries.length > 0;
    
    // Colectează informații despre workplace-urile unde a fost vizitator
    const visitorInfo = visitorEntries.map((entry) => ({
      workplaceName: entry.workplaceName || "Farmacie necunoscută",
      date: date ? format(date, "dd.MM.yyyy") : entry.date || "Data necunoscută"
    }));

    // Agregăm DOAR minutele (fallback pe hoursWorked dacă minutesWorked lipsește)
    let totalMinutes = 0;
    entries.forEach((entry) => {
      const mins =
        entry.minutesWorked !== undefined && entry.minutesWorked !== null
          ? Number(entry.minutesWorked) || 0
          : Math.round((Number(entry.hoursWorked) || 0) * 60);
      totalMinutes += mins;
    });

    return { 
      hours: Math.floor(totalMinutes / 60), 
      minutes: totalMinutes % 60,
      isVisitor: hasVisitorEntry,
      visitorInfo: visitorInfo
    };
  };

  // Calculează totalul de ore pentru un angajat în lună
  const getEmployeeTotal = (employeeId) => {
    let totalMinutes = 0;

    timesheetEntries.forEach((entry) => {
      const entryEmployeeId = String(entry.employeeId?._id || entry.employeeId);
      if (entryEmployeeId === String(employeeId) && !entry.leaveType) {
        const mins =
          entry.minutesWorked !== undefined && entry.minutesWorked !== null
            ? Number(entry.minutesWorked) || 0
            : Math.round((Number(entry.hoursWorked) || 0) * 60);
        totalMinutes += mins;
      }
    });

    return { totalHours: Math.floor(totalMinutes / 60), totalMinutes: totalMinutes % 60 };
  };

  // Deschide modal pentru pontare (nou sau editare)
  const handleCellClick = useCallback(
    (employee, day, existingEntries = [], isVisitorRow = false) => {
      setPontajData({ employee, date: format(day, "yyyy-MM-dd") });

      if (existingEntries.length > 0) {
        // Dacă există deja pontaj, folosim cel mai devreme start și cel mai târziu end
        let earliestStart = null;
        let latestEnd = null;

        existingEntries.forEach((entry) => {
          const s = normalizeTime(entry.startTime || "08:00");
          const e = normalizeTime(entry.endTime || "16:00");

          if (!earliestStart || s < earliestStart) earliestStart = s;
          if (!latestEnd || e > latestEnd) latestEnd = e;
        });

        setStartTime(earliestStart || "08:00");
        setEndTime(latestEnd || "16:00");
        setHasExistingPontaj(true);
      } else {
        // Pontaj nou
        setStartTime("08:00");
        setEndTime("16:00");
        setHasExistingPontaj(false);
      }

      setShowPontajModal(true);
    },
    []
  );

  // Salvează pontajul (fără force) și, la suprapunere, pregătește confirmarea
  const handleSavePontaj = useCallback(async () => {
    if (!pontajData || !workplaceId) return;

    // ✅ Validare înainte de salvare: verificăm că employee există în lista de employees/vizitatori valizi
    const allValidEmployeeIds = new Set([
      ...employees.map((e) => String(e._id)),
      ...visitorsFromPontaj.map((v) => String(v._id)),
      ...visitorsManual.map((v) => String(v._id)),
    ]);
    
    const employeeIdStr = String(pontajData.employee._id);
    if (!allValidEmployeeIds.has(employeeIdStr)) {
      alert("⚠️ Eroare: Angajatul nu mai există sau nu este activ. Nu se poate salva pontajul.");
      setShowPontajModal(false);
      setPontajData(null);
      return;
    }

    setSaving(true);
    try {
      const finalStartTime = normalizeTime(startTime);
      const finalEndTime = normalizeTime(endTime);
      const minutesWorked = calcWorkMinutes(finalStartTime, finalEndTime);

      const payload = {
        employeeId: pontajData.employee._id,
        workplaceId: workplaceId,
        date: pontajData.date,
        startTime: finalStartTime,
        endTime: finalEndTime,
        minutesWorked: minutesWorked,
        hoursWorked: minutesWorked / 60,
        status: "prezent",
        force: false,
      };

      const response = await fetch(`${API}/api/pontaj`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404 && data?.error?.includes("nu a fost găsit")) {
          alert("⚠️ Eroare: Angajatul nu mai există sau nu este activ. Pontajul nu a fost salvat.");
          // Reîncarcă lista de employees pentru a elimina angajatul invalid
          await reloadTimesheets();
          setShowPontajModal(false);
          setPontajData(null);
          return;
        }
        if (response.status === 409 && data?.code === "OVERLAPPING_HOURS" && data?.canForce) {
          // Deschidem modal de confirmare pentru rescriere pontaj
          setOverlapData({
            payload,
            employeeName: pontajData.employee.name,
            date: pontajData.date,
            overlappingEntry: data.overlappingEntry,
            newEntry: data.newEntry,
          });
          setShowPontajModal(false);
          return;
        }
        alert(data?.error || "Eroare la salvare");
        return;
      }

      await reloadTimesheets();
      setShowPontajModal(false);
      setPontajData(null);
    } catch (err) {
      console.error("Eroare la salvare:", err);
      alert("Eroare la salvare");
    } finally {
      setSaving(false);
    }
  }, [pontajData, workplaceId, startTime, endTime, reloadTimesheets, employees, visitorsFromPontaj, visitorsManual]);

  // Confirmă rescrierea pontajului cu force:true
  const handleConfirmOverlap = useCallback(async () => {
    if (!overlapData || !workplaceId) return;

    setSaving(true);
    try {
      const response = await fetch(`${API}/api/pontaj`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...overlapData.payload, force: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data?.error || "Eroare la salvare");
        return;
      }

      await reloadTimesheets();
      setOverlapData(null);
      setPontajData(null);
    } catch (err) {
      console.error("Eroare la salvare (force):", err);
      alert("Eroare la salvare");
    } finally {
      setSaving(false);
    }
  }, [overlapData, workplaceId, reloadTimesheets]);

  const handleCancelOverlap = useCallback(() => {
    setOverlapData(null);
  }, []);

  // Șterge pontajul pentru ziua respectivă
  // Dacă este vizitator și nu mai are pontaj în luna selectată, îl eliminăm din tabel
  const handleDeletePontaj = useCallback(async () => {
    if (!pontajData || !hasExistingPontaj) return;

    const confirmed = window.confirm(
      `Ești sigur că vrei să ștergi pontajul pentru ${pontajData.employee.name} în data de ${pontajData.date}?`
    );
    if (!confirmed) return;

    const employeeId = pontajData.employee._id;
    const isVisitor = visitorIds.has(employeeId);

    setSaving(true);
    try {
      const res = await fetch(
        `${API}/api/pontaj?employeeId=${employeeId}&date=${pontajData.date}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      const data = await res.json();
      if (!res.ok) {
        alert(data?.error || "Eroare la ștergerea pontajului");
        return;
      }

      // Reîncarcă pontajul și obține noile entries
      const newEntries = await reloadTimesheets();

      // Dacă este vizitator, verifică dacă mai are pontaj în luna selectată
      if (isVisitor && Array.isArray(newEntries)) {
        // Verifică dacă mai există entry-uri pentru acest vizitator în luna selectată
        const hasAnyEntryInMonth = newEntries.some((entry) => {
          const entryEmployeeId = String(entry.employeeId?._id || entry.employeeId);
          return entryEmployeeId === String(employeeId);
        });

        // Dacă nu mai are niciun entry, elimină-l din visitorsManual
        if (!hasAnyEntryInMonth) {
          setVisitorsManual((prev) => prev.filter((v) => String(v._id) !== String(employeeId)));
        }
      }

      setShowPontajModal(false);
      setPontajData(null);
      setHasExistingPontaj(false);
    } catch (err) {
      console.error("Eroare la ștergerea pontajului:", err);
      alert("Eroare la ștergerea pontajului");
    } finally {
      setSaving(false);
    }
  }, [pontajData, hasExistingPontaj, reloadTimesheets, visitorIds]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-500">Se încarcă...</div>
      </div>
    );
  }

  const leaveTypeMap = {
    odihna: "C",
    medical: "CM",
    fara_plata: "CFP",
    eveniment: "CE",
  };

  return (
    <div className="h-full flex flex-col p-6">
      {/* Header cu selector de lună */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Vizualizare Pontaj</h2>
          <p className="text-sm text-slate-500 mt-1">
            {workplaceName} - {format(new Date(selectedMonth + "-01"), "MMMM yyyy", { locale: ro })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-700">Selectează luna:</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Tabel cu pontajul */}
      <div className="flex-1 overflow-auto">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 border-b border-slate-200 sticky left-0 bg-slate-50 z-20 min-w-[200px]">
                    Angajat
                  </th>
                  {monthDays.map((day) => {
                    const isWeekendCol = isWeekend(day);
                    const isTodayCol = isSameDay(day, today);
                    return (
                      <th
                        key={day.toISOString()}
                        className={`px-2 py-3 text-center text-xs font-semibold border-b border-slate-200 ${
                          isTodayCol
                            ? "bg-yellow-100 text-slate-900"
                            : isWeekendCol
                              ? "bg-slate-100 text-slate-800"
                              : "text-slate-700 bg-slate-50"
                        }`}
                        style={{ minWidth: "60px" }}
                      >
                        <div>{format(day, "d", { locale: ro })}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {format(day, "EEE", { locale: ro })}
                        </div>
                      </th>
                    );
                  })}
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 border-b border-slate-200 bg-emerald-50">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {peopleInTable.length === 0 ? (
                  <tr>
                    <td colSpan={monthDays.length + 2} className="px-4 py-8 text-center text-slate-500">
                      Nu există angajați
                    </td>
                  </tr>
                ) : (
                  peopleInTable.map((employee) => {
                    const { totalHours, totalMinutes } = getEmployeeTotal(employee._id);
                    const isVisitor = visitorIds.has(employee._id);
                    const isManualVisitor = manualVisitorIds.has(employee._id);
                    return (
                      <tr key={employee._id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm sticky left-0 bg-white z-10 border-r border-slate-100">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="font-medium text-slate-900">
                                {employee.name || "-"}
                              </div>
                              {isVisitor && (
                                <div className="text-[11px] text-amber-600 font-semibold mt-0.5">
                                  vizitator
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        {monthDays.map((day) => {
                          const entries = getDayEntries(employee._id, day);
                          const dayData = getDayHours(entries, day);
                          const isTodayCol = isSameDay(day, today);
                          const isWeekendCol = isWeekend(day);

                          if (entries.length === 0) {
                            return (
                              <td
                                key={day.toISOString()}
                                onClick={() => handleCellClick(employee, day, entries, isVisitor)}
                                className={`px-2 py-2 text-center text-xs border-r border-slate-100 cursor-pointer hover:bg-emerald-50 transition-colors ${
                                  isTodayCol
                                    ? "bg-yellow-100/60"
                                    : isWeekendCol
                                      ? "bg-slate-100/40"
                                      : ""
                                }`}
                                title="Click pentru a ponta"
                              >
                                -
                              </td>
                            );
                          }

                          // Afișează concediu
                          if (dayData.isLeave) {
                            return (
                              <td
                                key={day.toISOString()}
                                className={`px-2 py-2 text-center text-xs font-medium text-blue-700 border-r border-slate-100 ${
                                  isTodayCol
                                    ? "bg-yellow-100/60"
                                    : isWeekendCol
                                      ? "bg-slate-100/40"
                                      : ""
                                }`}
                                title={dayData.leaveType}
                              >
                                {leaveTypeMap[dayData.leaveType] || "C"}
                              </td>
                            );
                          }

                          // Afișează orele lucrate - clickable pentru editare
                          // Construiește tooltip-ul pentru vizitatori
                          const getTooltip = () => {
                            if (dayData.isVisitor && dayData.visitorInfo && dayData.visitorInfo.length > 0) {
                              const visitorDetails = dayData.visitorInfo.map(info => 
                                `Vizitator la ${info.workplaceName} pe ${info.date}`
                              ).join("; ");
                              return `Click pentru a edita pontajul\n${visitorDetails}`;
                            }
                            return "Click pentru a edita pontajul";
                          };

                          return (
                            <td
                              key={day.toISOString()}
                              onClick={() => handleCellClick(employee, day, entries, isVisitor)}
                              className={`px-2 py-2 text-center text-xs border-r border-slate-100 cursor-pointer hover:bg-emerald-50 transition-colors ${
                                isTodayCol
                                  ? "bg-yellow-100/60"
                                  : isWeekendCol
                                    ? "bg-slate-100/40"
                                    : ""
                              }`}
                              title={getTooltip()}
                            >
                              {dayData.isVisitor ? "* " : ""}{formatHours(dayData.hours, dayData.minutes)}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-center text-sm font-semibold text-emerald-700 bg-emerald-50/50">
                          {formatHours(totalHours, totalMinutes)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Vizitatori (sub tabel) */}
      <div className="mt-5 flex items-center justify-start font-semibold">
        <AddVisitor
          items={allEmployeesForPicker}
          excludeIds={excludeIds}
          onPick={addVisitorManual}
          disabled={false}
          label="Adauga vizitator completand campul ->"
        />
      </div>

      {/* Modal pentru pontare */}
      {showPontajModal && pontajData && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            minHeight: '100vh',
            minWidth: '100vw'
          }}
        >
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" style={{ maxWidth: '28rem' }}>
            <div className="mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                Pontaj - {pontajData.employee.name}
              </h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Data: {format(new Date(pontajData.date), "dd MMMM yyyy", { locale: ro })}
            </p>

            <div className="mb-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Ora intrare:
                </label>
                <TimePicker
                  value={startTime}
                  onChange={setStartTime}
                  disabled={false}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Ora ieșire:
                </label>
                <TimePicker
                  value={endTime}
                  onChange={setEndTime}
                  disabled={false}
                />
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setShowPontajModal(false);
                  setPontajData(null);
                }}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                disabled={saving}
              >
                Anulează
              </button>
              {hasExistingPontaj && (
                <button
                  onClick={handleDeletePontaj}
                  disabled={saving}
                  className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? "Șterge..." : "Șterge pontajul"}
                </button>
              )}
              <button
                onClick={handleSavePontaj}
                disabled={saving}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? "Salvează..." : "Salvează"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal pentru confirmare rescriere pontaj (suprapunere ore) */}
      {overlapData && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            minHeight: '100vh',
            minWidth: '100vw'
          }}
        >
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-slate-900 mb-3">
              Modifici pontajul existent?
            </h3>
            <p className="text-sm text-slate-700 mb-3">
              Pentru <span className="font-semibold">{overlapData.employeeName}</span> în data de{" "}
              <span className="font-semibold">
                {format(new Date(overlapData.date), "dd.MM.yyyy")}
              </span>{" "}
              există deja un pontaj salvat.
            </p>
            {overlapData.overlappingEntry && (
              <p className="text-xs text-slate-600 mb-1">
                Pontaj vechi:{" "}
                <span className="font-mono">
                  {overlapData.overlappingEntry.startTime} - {overlapData.overlappingEntry.endTime}
                </span>
              </p>
            )}
            {overlapData.newEntry && (
              <p className="text-xs text-slate-600 mb-4">
                Pontaj nou:{" "}
                <span className="font-mono">
                  {overlapData.newEntry.startTime} - {overlapData.newEntry.endTime}
                </span>
              </p>
            )}
            <p className="text-sm text-slate-700 mb-4">
              Dacă continui, pontajul vechi va fi <span className="font-semibold">rescris</span> cu
              noul interval de ore (nu se adună și nu se suprapune).
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCancelOverlap}
                disabled={saving}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Anulează
              </button>
              <button
                onClick={handleConfirmOverlap}
                disabled={saving}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Rescrie..." : "Rescrie pontajul"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fereastra de bun venit - informare despre noua interfață */}
      <PontajWelcomeModal isOpen={showWelcomeModal} onClose={handleCloseWelcomeModal} />
    </div>
  );
};

export default TimesheetViewer;

