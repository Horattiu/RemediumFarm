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
import type { DayCellContentArg, EventClickArg, DateSelectArg } from '@fullcalendar/core';

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
        setWorkplaces(Array.isArray(data) ? data : []);
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

  // Events pentru FullCalendar
  const events = useMemo<CalendarEvent[]>(() => {
    const all: CalendarEvent[] = [];

    filteredLeaves.forEach((l) => {
      const start = parseISO(l.startDate);
      const end = parseISO(l.endDate);
      const days = eachDayOfInterval({ start, end });

      days.forEach((d) => {
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

  const handleDaySelect = (info: DateSelectArg) => {
    openPopupForDate(info.start);
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    if (clickInfo.event.start) {
      openPopupForDate(clickInfo.event.start);
    }
  };

  // Celulă: număr zi + nume sărbătoare (cu albastru) + max 2 nume + „+N"
  const renderDayCell = (arg: DayCellContentArg) => {
    const date = arg.date;
    const key = format(date, 'yyyy-MM-dd');
    const dayLeaves = leavesByDay[key] || [];
    
    // Verifică dacă este sărbătoare legală
    const monthDay = format(date, 'MM-dd');
    const holidayName = legalHolidays[monthDay] || null;

    const dayNumberEl = arg.el.querySelector('.fc-daygrid-day-number');
    arg.el.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'flex flex-col h-full';

    if (dayNumberEl) {
      const dayHeader = document.createElement('div');
      
      // Dacă există sărbătoare, afișăm badge-ul în header
      if (holidayName) {
        dayHeader.className = 'flex flex-col px-1 pt-1 gap-0.5';
        
        // Badge-ul cu sărbătoarea (sus)
        const holidayBadge = document.createElement('div');
        holidayBadge.className =
          'text-[9px] leading-tight px-1.5 py-0.5 rounded text-white font-bold truncate w-full';
        holidayBadge.style.backgroundColor = '#3b82f6'; // blue-500
        holidayBadge.style.color = '#ffffff';
        holidayBadge.innerText = holidayName;
        holidayBadge.title = holidayName;
        dayHeader.appendChild(holidayBadge);
        
        // Numărul zilei (jos, aliniat dreapta)
        const dayNumberWrapper = document.createElement('div');
        dayNumberWrapper.className = 'flex justify-end text-xs';
        dayNumberWrapper.appendChild(dayNumberEl);
        dayHeader.appendChild(dayNumberWrapper);
      } else {
        // Dacă nu există sărbătoare, layout normal
        dayHeader.className = 'flex justify-end px-1 pt-1 text-xs';
        dayHeader.appendChild(dayNumberEl);
      }
      
      wrapper.appendChild(dayHeader);
    }

    if (dayLeaves.length > 0) {
      const maxToShow = 2;
      const first = dayLeaves.slice(0, maxToShow);
      const remaining = dayLeaves.length - first.length;

      const list = document.createElement('div');
      list.className = 'mt-1 flex flex-col gap-0.5';

      first.forEach((l) => {
        const div = document.createElement('div');
        div.className =
          'text-[10px] leading-tight px-1 py-0.5 rounded bg-emerald-600 text-white truncate cursor-pointer';
        div.innerText = l.name || (l.employeeId as any)?.name || 'Anonim';
        list.appendChild(div);
      });

      if (remaining > 0) {
        const more = document.createElement('div');
        more.className =
          'text-[10px] leading-tight px-1 py-0.5 rounded bg-emerald-100 text-emerald-800 cursor-pointer';
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
        selectable={true}
        select={handleDaySelect}
        eventClick={handleEventClick}
        dayMaxEventRows={false}
        dayCellDidMount={renderDayCell}
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
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {selectedDate &&
                      format(selectedDate, 'dd MMMM yyyy', {
                        locale: ro,
                      })}
                  </h3>
                  <p className="text-sm text-emerald-50 mt-1">
                    {selectedDate &&
                      format(selectedDate, 'EEEE', {
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
                          {(e.name || (e.employeeId as any)?.name || '—').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-slate-900 text-sm">
                            {e.name || (e.employeeId as any)?.name}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {e.function || '—'}
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
                          <span>{(e.workplaceId as any)?.name || '—'}</span>
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
                            {format(parseISO(e.startDate), 'dd.MM.yyyy', {
                              locale: ro,
                            })}{' '}
                            –{' '}
                            {format(parseISO(e.endDate), 'dd.MM.yyyy', {
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

