// WorkplaceCalendar.jsx
import React, { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import {
  parseISO,
  eachDayOfInterval,
  isWithinInterval,
  format,
} from "date-fns";
import ro from "date-fns/locale/ro";

// Folosește variabile de mediu pentru URL-ul backend-ului
const getApiUrl = () => {
  const url = import.meta.env.VITE_API_URL || "http://localhost:5000";
  return url.replace(/\/$/, ""); // Elimină slash-ul final
};
const API = getApiUrl();

const WorkplaceCalendar = ({ leaves }) => {
  const [workplaces, setWorkplaces] = useState([]);
  const [selectedWorkplaceDraft, setSelectedWorkplaceDraft] = useState("all");
  const [selectedWorkplace, setSelectedWorkplace] = useState("all");
  const [calendarKey, setCalendarKey] = useState(0);
  const [holidays, setHolidays] = useState([]); // ✅ Sărbători legale

  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedDayLeaves, setSelectedDayLeaves] = useState([]);
  const [showPopup, setShowPopup] = useState(false);

  // încarcă TOATE punctele de lucru
  useEffect(() => {
    const loadWorkplaces = async () => {
      const res = await fetch(`${API}/api/workplaces/all`);
      const data = await res.json();
      setWorkplaces(Array.isArray(data) ? data : []);
    };
    loadWorkplaces();
  }, []);

  // ✅ Încarcă sărbătorile legale
  useEffect(() => {
    const loadHolidays = async () => {
      try {
        const currentYear = new Date().getFullYear();
        const res = await fetch(`${API}/api/holidays?year=${currentYear}`);
        const data = await res.json();
        setHolidays(Array.isArray(data) ? data : []);
        setCalendarKey((k) => k + 1); // Forțează re-render calendar
      } catch (err) {
        console.error("Eroare la încărcarea sărbătorilor:", err);
        setHolidays([]);
      }
    };
    loadHolidays();
  }, []);

  // filtrare concedii după punct de lucru (confirmată cu „Caută")
  const filteredLeaves = useMemo(() => {
    if (selectedWorkplace === "all") return leaves;

    return leaves.filter((l) => {
      const wid =
        l.workplaceId && typeof l.workplaceId === "object"
          ? l.workplaceId._id
          : l.workplaceId;
      return wid === selectedWorkplace;
    });
  }, [leaves, selectedWorkplace]);

  // ✅ Map pentru sărbători legale (YYYY-MM-DD -> nume)
  const holidaysMap = useMemo(() => {
    const map = {};
    holidays.forEach((h) => {
      const dateObj = h.date instanceof Date ? h.date : new Date(h.date);
      const dateKey = format(dateObj, "yyyy-MM-dd");
      map[dateKey] = h.name;
    });
    return map;
  }, [holidays]);

  // events pentru FullCalendar
  const events = useMemo(() => {
    const all = [];

    filteredLeaves.forEach((l) => {
      const start = parseISO(l.startDate);
      const end = parseISO(l.endDate);
      const days = eachDayOfInterval({ start, end });

      days.forEach((d) => {
        all.push({
          id: `${l._id}-${d.toISOString().slice(0, 10)}`,
          title: l.name || l.employeeId?.name || "Anonim",
          start: d,
          allDay: true,
          extendedProps: { leave: l },
        });
      });
    });

    return all;
  }, [filteredLeaves]);

  // yyyy-MM-dd -> listă de concedii unice în ziua respectivă
  const leavesByDay = useMemo(() => {
    const map = {};

    filteredLeaves.forEach((l) => {
      const start = parseISO(l.startDate);
      const end = parseISO(l.endDate);
      const days = eachDayOfInterval({ start, end });

      days.forEach((d) => {
        const key = format(d, "yyyy-MM-dd");
        if (!map[key]) map[key] = [];

        const exists = map[key].some(
          (item) =>
            item.employeeId?._id === l.employeeId?._id &&
            item.startDate === l.startDate &&
            item.endDate === l.endDate
        );
        if (!exists) map[key].push(l);
      });
    });

    return map;
  }, [filteredLeaves]);

  const openPopupForDate = (date) => {
    setSelectedDate(date);
    const key = format(date, "yyyy-MM-dd");
    const matches = leavesByDay[key] || [];
    setSelectedDayLeaves(matches);
    setShowPopup(true);
  };

  const handleDaySelect = (info) => {
    openPopupForDate(info.start);
  };

  const handleEventClick = (clickInfo) => {
    openPopupForDate(clickInfo.event.start);
  };

  // celulă: număr zi + nume sărbătoare legală (cu albastru lângă data) + max 2 nume + „+N"
  const renderDayCell = (arg) => {
    const date = arg.date;
    const key = format(date, "yyyy-MM-dd");
    const dayLeaves = leavesByDay[key] || [];
    const holidayName = holidaysMap[key]; // ✅ Sărbătoare legală pentru această zi

    const dayNumberEl = arg.el.querySelector(".fc-daygrid-day-number");
    arg.el.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "flex flex-col h-full";

    if (dayNumberEl) {
      const dayHeader = document.createElement("div");
      dayHeader.className = "flex items-center justify-between px-1 pt-1 gap-1";
      
      // ✅ Sărbătoarea legală (stânga) - cu albastru
      if (holidayName) {
        const holidayBadge = document.createElement("div");
        holidayBadge.className =
          "text-[8px] leading-tight px-1 py-0.5 rounded bg-blue-500 text-white font-semibold truncate flex-1 min-w-0";
        holidayBadge.innerText = holidayName;
        holidayBadge.title = holidayName; // Tooltip pentru nume complet
        dayHeader.appendChild(holidayBadge);
      }
      
      // Numărul zilei (dreapta)
      const dayNumberWrapper = document.createElement("div");
      dayNumberWrapper.className = "flex-shrink-0 text-xs";
      dayNumberWrapper.appendChild(dayNumberEl);
      dayHeader.appendChild(dayNumberWrapper);
      
      wrapper.appendChild(dayHeader);
    }

    if (dayLeaves.length > 0) {
      const maxToShow = 2;
      const first = dayLeaves.slice(0, maxToShow);
      const remaining = dayLeaves.length - first.length;

      const list = document.createElement("div");
      list.className = "mt-1 flex flex-col gap-0.5";

      first.forEach((l) => {
        const div = document.createElement("div");
        div.className =
          "text-[10px] leading-tight px-1 py-0.5 rounded bg-emerald-600 text-white truncate cursor-pointer";
        div.innerText = l.name || l.employeeId?.name || "Anonim";
        list.appendChild(div);
      });

      if (remaining > 0) {
        const more = document.createElement("div");
        more.className =
          "text-[10px] leading-tight px-1 py-0.5 rounded bg-emerald-100 text-emerald-800 cursor-pointer";
        more.innerText = `+${remaining}`;
        list.appendChild(more);
      }

      wrapper.appendChild(list);
    }

    arg.el.appendChild(wrapper);
  };

  return (
    <div className="bg-white border border-slate-300 rounded-xl p-4 shadow-sm">
      {/* FILTRU PUNCT DE LUCRU */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <h2 className="text-lg font-semibold text-slate-800">
          Calendar concedii pe puncte de lucru
        </h2>

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Punct de lucru:</span>
          <select
            className="text-sm border border-slate-300 rounded-md px-2 py-1 bg-white"
            value={selectedWorkplaceDraft}
            onChange={(e) => setSelectedWorkplaceDraft(e.target.value)}
          >
            <option value="all">Toate</option>
            {workplaces.map((w) => (
              <option key={w._id} value={w._id}>
                {w.name}
              </option>
            ))}
          </select>
          <button
            className="ml-2 px-3 py-1 text-sm rounded-md bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 transition-all duration-200 shadow-sm hover:shadow-md"
            onClick={() => {
              setSelectedWorkplace(selectedWorkplaceDraft);
              setCalendarKey((k) => k + 1); // forțează remount FullCalendar
            }}
          >
            Caută
          </button>
        </div>
      </div>

      <FullCalendar
        key={calendarKey}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale="ro"
        events={events}
        selectable={true}
        select={handleDaySelect}
        eventClick={handleEventClick}
        dayMaxEventRows={false}
        dayCellDidMount={renderDayCell}
        height="auto"
        weekends={true}
        firstDay={1}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "",
        }}
        buttonText={{
          today: "Astăzi",
        }}
      />

      {/* POPUP DETALII PE ZI */}
      {showPopup && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {selectedDate &&
                      format(selectedDate, "dd MMMM yyyy", {
                        locale: ro,
                      })}
                  </h3>
                  <p className="text-sm text-emerald-50 mt-1">
                    {selectedDate &&
                      format(selectedDate, "EEEE", {
                        locale: ro,
                      })}
                  </p>
                </div>
                <button
                  className="text-white hover:text-emerald-100 transition-colors p-1 rounded-lg hover:bg-white/20"
                  onClick={() => setShowPopup(false)}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {selectedDayLeaves.length === 0 ? (
                <div className="text-center py-8">
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
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="text-sm text-slate-500">
                    Niciun concediu în această zi.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {selectedDayLeaves.map((e) => (
                    <div
                      key={e._id}
                      className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-all duration-200 hover:border-emerald-300"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-semibold text-sm">
                          {(e.name || e.employeeId?.name || "—").charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-slate-900 text-sm">
                            {e.name || e.employeeId?.name}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {e.function || "—"}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 ml-13">
                        <div className="flex items-center gap-2 text-xs text-slate-600">
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
                              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                            />
                          </svg>
                          <span>{e.workplaceId?.name || "—"}</span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-600">
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
                            {format(parseISO(e.startDate), "dd.MM.yyyy", {
                              locale: ro,
                            })}{" "}
                            –{" "}
                            {format(parseISO(e.endDate), "dd.MM.yyyy", {
                              locale: ro,
                            })}
                          </span>
                        </div>

                        {e.reason && (
                          <div className="mt-2 pt-2 border-t border-slate-200">
                            <p className="text-xs text-slate-600">
                              <span className="font-medium text-slate-700">Motiv:</span> {e.reason}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkplaceCalendar;
