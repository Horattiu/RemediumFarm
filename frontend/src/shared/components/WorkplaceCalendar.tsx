import React, { useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import {
  parseISO,
  eachDayOfInterval,
  format,
} from 'date-fns';
import { ro } from 'date-fns/locale/ro';
import { workplaceService } from '@/shared/services/workplaceService';
import type { Leave } from '@/features/leaves/types/leave.types';
import type { Workplace } from '@/shared/types/workplace.types';
import type { DayCellContentArg, EventClickArg, DateClickArg } from '@fullcalendar/core';

interface WorkplaceCalendarProps {
  leaves: Leave[];
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  allDay: boolean;
  extendedProps: { leave: Leave };
}

interface LeavesByDay {
  [key: string]: Leave[];
}

const legalHolidays: Record<string, string> = {
  '01-01': 'Anul Nou',
  '01-02': 'A doua zi de Anul Nou',
  '01-06': 'Boboteaza / Epifania',
  '01-07': 'Sfântul Ioan Botezătorul',
  '01-24': 'Ziua Unirii Principatelor Române',
  '04-10': 'Vinerea Mare (Paște ortodox)',
  '04-12': 'Paștele Ortodox',
  '04-13': 'A doua zi de Paște',
  '05-01': 'Ziua Muncii',
  '05-31': 'Rusaliile',
  '06-01': 'A doua zi de Rusalii & Ziua Copilului',
  '08-15': 'Adormirea Maicii Domnului',
  '11-30': 'Sfântul Andrei',
  '12-01': 'Ziua Națională a României',
  '12-25': 'Crăciunul (prima zi)',
  '12-26': 'A doua zi de Crăciun',
};

export const WorkplaceCalendar: React.FC<WorkplaceCalendarProps> = ({ leaves }) => {
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [selectedWorkplace, setSelectedWorkplace] = useState<string>('all');
  const [calendarKey, setCalendarKey] = useState(0);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDayLeaves, setSelectedDayLeaves] = useState<Leave[]>([]);
  const [showPopup, setShowPopup] = useState(false);

  // Încarcă TOATE punctele de lucru
  useEffect(() => {
    const loadWorkplaces = async () => {
      try {
        const data = await workplaceService.getAll();
        const list = Array.isArray(data) ? data : [];
        setWorkplaces(list);

        // Implicit pentru manager: pornește pe "Farmacia Remedium 1"
        if (list.length > 0) {
          const preferred = list.find((w) => {
            if (typeof w.name !== "string") return false;
            const normalizedName = w.name.trim().toLowerCase();
            return normalizedName === "farmacia remedium 1";
          });
          setSelectedWorkplace(String((preferred || list[0])._id));
        }
      } catch (error) {
        console.error('Eroare la încărcarea punctelor de lucru:', error);
        setWorkplaces([]);
      }
    };
    loadWorkplaces();
  }, []);

  // Filtrare concedii după punct de lucru (confirmată cu „Caută")
  // IMPORTANT: Filtrează doar concediile cu status "Aprobată"
  const filteredLeaves = useMemo(() => {
    // Filtrează doar concediile aprobate
    let approvedLeaves = leaves.filter((l) => l.status === 'Aprobată');
    
    // Apoi filtrează după punct de lucru
    if (selectedWorkplace === 'all') return approvedLeaves;

    return approvedLeaves.filter((l) => {
      const wid =
        l.workplaceId && typeof l.workplaceId === 'object'
          ? (l.workplaceId as any)._id
          : l.workplaceId;
      return wid === selectedWorkplace;
    });
  }, [leaves, selectedWorkplace]);

  const isExcludedLeaveDay = (date: Date): boolean => {
    const day = date.getDay(); // local day
    const isWeekend = day === 0 || day === 6;
    if (isWeekend) return true;
    const monthDay = format(date, 'MM-dd');
    return Boolean(legalHolidays[monthDay]);
  };

  // Events pentru FullCalendar
  const events = useMemo<CalendarEvent[]>(() => {
    const all: CalendarEvent[] = [];

    filteredLeaves.forEach((l) => {
      const start = parseISO(l.startDate);
      const end = parseISO(l.endDate);
      const days = eachDayOfInterval({ start, end });

      days.forEach((d) => {
        if (isExcludedLeaveDay(d)) return;
        all.push({
          id: `${l._id}-${d.toISOString().slice(0, 10)}`,
          title: l.name || (l.employeeId as any)?.name || 'Anonim',
          start: d,
          allDay: true,
          extendedProps: { leave: l },
        });
      });
    });

    return all;
  }, [filteredLeaves]);

  // yyyy-MM-dd -> listă de concedii unice în ziua respectivă
  const leavesByDay = useMemo<LeavesByDay>(() => {
    const map: LeavesByDay = {};

    filteredLeaves.forEach((l) => {
      const start = parseISO(l.startDate);
      const end = parseISO(l.endDate);
      const days = eachDayOfInterval({ start, end });

      days.forEach((d) => {
        if (isExcludedLeaveDay(d)) return;
        const key = format(d, 'yyyy-MM-dd');
        if (!map[key]) map[key] = [];

        const exists = map[key].some(
          (item) =>
            (item.employeeId as any)?._id === (l.employeeId as any)?._id &&
            item.startDate === l.startDate &&
            item.endDate === l.endDate
        );
        if (!exists) map[key].push(l);
      });
    });

    return map;
  }, [filteredLeaves]);

  const openPopupForDate = (date: Date) => {
    setSelectedDate(date);
    const key = format(date, 'yyyy-MM-dd');
    const matches = leavesByDay[key] || [];
    setSelectedDayLeaves(matches);
    setShowPopup(true);
  };

  const handleDateClick = (info: DateClickArg) => {
    openPopupForDate(info.date);
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    if (clickInfo.event.start) {
      openPopupForDate(clickInfo.event.start);
    }
  };

  // Celulă minimalistă (stil Windows): zi + indicatori, detalii doar în modal
  const renderDayCellContent = (arg: DayCellContentArg) => {
    const date = arg.date;
    const key = format(date, 'yyyy-MM-dd');
    const hasLeaves = (leavesByDay[key] || []).length > 0;
    const monthDay = format(date, 'MM-dd');
    const isHoliday = Boolean(legalHolidays[monthDay]);
    const holidayName = legalHolidays[monthDay] || '';

    return (
      <div className="windows-day-cell">
        <div className="windows-day-number">{arg.dayNumberText}</div>
        <div className="windows-day-indicators">
          {hasLeaves && (
            <span className="windows-dot windows-dot-leave" title="Există concedii în această zi" />
          )}
          {isHoliday && (
            <span className="windows-dot windows-dot-holiday" title={legalHolidays[monthDay]} />
          )}
        </div>
        {isHoliday && <div className="windows-holiday-name">{holidayName}</div>}
      </div>
    );
  };

  return (
    <div className="manager-calendar bg-white border border-slate-300 rounded-xl p-4 shadow-sm">
      <style>{`
        .manager-calendar {
          background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
          border-color: #cbd5e1 !important;
        }
        .manager-calendar .calendar-header-title {
          color: #0f172a;
        }
        .manager-calendar .calendar-header-label {
          color: #475569;
        }
        .manager-calendar .calendar-filter {
          background-color: #ffffff;
          color: #0f172a;
          border-color: #cbd5e1;
        }
        .manager-calendar .fc {
          color: #0f172a;
        }
        .manager-calendar .fc .fc-scrollgrid,
        .manager-calendar .fc-theme-standard td,
        .manager-calendar .fc-theme-standard th {
          border-color: #d1d5db;
        }
        .manager-calendar .fc .fc-toolbar-title {
          color: #0f172a;
          font-size: 1.2rem;
          font-weight: 700;
        }
        .manager-calendar .fc .fc-button {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          color: #334155;
          border-radius: 8px;
          padding: 0.3rem 0.6rem !important;
        }
        .manager-calendar .fc .fc-button:hover {
          background: #f1f5f9;
          color: #0f172a;
        }
        .manager-calendar .fc .fc-daygrid-day-frame {
          min-height: 98px;
          cursor: pointer;
        }
        .manager-calendar .fc .fc-col-header-cell {
          background-color: #f8fafc;
        }
        .manager-calendar .fc .fc-col-header-cell-cushion {
          color: #475569;
          font-weight: 600;
          text-decoration: none;
        }
        .manager-calendar .fc .fc-daygrid-day.fc-day-other {
          background-color: #f8fafc;
        }
        .manager-calendar .fc .fc-daygrid-day.fc-day-other .windows-day-number {
          color: #94a3b8;
        }
        .manager-calendar .fc .fc-daygrid-day.fc-day-today {
          background-color: #eef2ff !important;
        }
        .manager-calendar .fc .fc-daygrid-day.fc-day-today .windows-day-number {
          color: #c084fc;
          font-weight: 700;
        }
        .windows-day-cell {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 5px;
          padding: 6px 4px;
        }
        .windows-day-number {
          font-size: 0.95rem;
          line-height: 1;
          color: #334155;
          font-weight: 500;
        }
        .windows-day-indicators {
          min-height: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .windows-holiday-name {
          max-width: 100%;
          font-size: 10px;
          line-height: 1.1;
          color: #92400e;
          background-color: #fef3c7;
          border: 1px solid #fcd34d;
          border-radius: 9999px;
          padding: 1px 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .windows-dot {
          width: 7px;
          height: 7px;
          border-radius: 9999px;
          display: inline-block;
        }
        .windows-dot-leave {
          background-color: #22c55e;
          box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2);
        }
        .windows-dot-holiday {
          background-color: #f59e0b;
          box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
        }
        .leave-day-cell {
          box-shadow: none !important;
        }
        .holiday-day-cell {
          box-shadow: inset 0 0 0 1px rgba(245, 158, 11, 0.35);
        }
      `}</style>
      {/* FILTRU PUNCT DE LUCRU */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <h2 className="calendar-header-title text-lg font-semibold">
          Calendar concedii pe puncte de lucru
        </h2>

        <div className="flex items-center gap-2">
          <span className="calendar-header-label text-sm">Punct de lucru:</span>
          <select
            className="calendar-filter text-sm border rounded-md px-2 py-1"
            value={selectedWorkplace}
            onChange={(e) => {
              setSelectedWorkplace(e.target.value);
              setCalendarKey((k) => k + 1); // Forțează remount FullCalendar
            }}
          >
            <option value="all">Toate</option>
            {workplaces.map((w) => (
              <option key={w._id} value={w._id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <FullCalendar
        key={calendarKey}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale="ro"
        events={events}
        selectable={false}
        dateClick={handleDateClick}
        eventClick={handleEventClick}
        dayMaxEventRows={false}
        dayCellContent={renderDayCellContent}
        dayCellClassNames={(arg) => {
          const key = format(arg.date, 'yyyy-MM-dd');
          const hasLeaves = (leavesByDay[key] || []).length > 0;
          const monthDay = format(arg.date, 'MM-dd');
          const classes: string[] = [];
          if (hasLeaves) classes.push('leave-day-cell');
          if (legalHolidays[monthDay]) classes.push('holiday-day-cell');
          return classes;
        }}
        showNonCurrentDates={false}
        fixedWeekCount={true}
        height="auto"
        weekends={true}
        firstDay={1}
        headerToolbar={{
          left: 'prev,next',
          center: 'title',
          right: '',
        }}
      />

      {/* POPUP DETALII PE ZI */}
      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_-15px_rgba(15,23,42,0.45)]">
            <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {selectedDate &&
                      format(selectedDate, 'dd MMMM yyyy', {
                        locale: ro,
                      })}
                  </h3>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-sm text-slate-600">
                      {selectedDate &&
                        format(selectedDate, 'EEEE', {
                          locale: ro,
                        })}
                    </p>
                    {selectedDate && legalHolidays[format(selectedDate, 'MM-dd')] && (
                      <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                        {legalHolidays[format(selectedDate, 'MM-dd')]}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                  onClick={() => setShowPopup(false)}
                  aria-label="Închide"
                >
                  <svg
                    className="h-5 w-5"
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

            <div className="p-5">
              {selectedDayLeaves.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
                  <svg
                    className="mx-auto mb-3 h-10 w-10 text-slate-300"
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
                  <p className="text-sm text-slate-500">Niciun concediu în această zi.</p>
                </div>
              ) : (
                <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                  {selectedDayLeaves.map((e) => (
                    <div
                      key={e._id}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
                          {(e.name || (e.employeeId as any)?.name || '—').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate text-sm font-semibold text-slate-900">
                            {e.name || (e.employeeId as any)?.name}
                          </h4>
                          <p className="mt-0.5 text-xs text-slate-500">{e.function || '—'}</p>

                          <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                            <p>
                              <span className="font-medium text-slate-700">Farmacie:</span>{' '}
                              {(e.workplaceId as any)?.name || '—'}
                            </p>
                            <p>
                              <span className="font-medium text-slate-700">Perioadă:</span>{' '}
                              {format(parseISO(e.startDate), 'dd.MM.yyyy', {
                                locale: ro,
                              })}{' '}
                              –{' '}
                              {format(parseISO(e.endDate), 'dd.MM.yyyy', {
                                locale: ro,
                              })}
                            </p>
                            {e.reason && (
                              <p>
                                <span className="font-medium text-slate-700">Motiv:</span> {e.reason}
                              </p>
                            )}
                          </div>
                        </div>
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

