import React, { useState, useEffect, useRef } from 'react';
import { announcementService } from '@/shared/services/announcementService';
import { workplaceService } from '@/shared/services/workplaceService';
import type { Announcement, AnnouncementFormData } from '@/shared/types/announcement.types';
import type { Workplace } from '@/shared/types/workplace.types';

interface AnnouncementManagerProps {
  onClose?: () => void;
}

// Componentă dropdown custom pentru farmacii
interface WorkplaceDropdownProps {
  workplaces: Workplace[];
  onSelect: (workplaceId: string) => void;
  placeholder: string;
  disabled?: boolean;
}

const WorkplaceDropdown: React.FC<WorkplaceDropdownProps> = ({
  workplaces,
  onSelect,
  placeholder,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filtrare farmacii după search
  const filteredWorkplaces = workplaces.filter((wp) =>
    wp.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Click outside pentru a închide dropdown-ul
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (workplaceId: string) => {
    onSelect(workplaceId);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="relative mb-4" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-left bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 flex items-center justify-between ${
          disabled
            ? 'bg-slate-50 text-slate-400 cursor-not-allowed'
            : 'hover:border-slate-400 cursor-pointer'
        }`}
      >
        <span className={disabled ? 'text-slate-400' : 'text-slate-700'}>
          {placeholder}
        </span>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-slate-200">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Caută farmacie..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              autoFocus
            />
          </div>

          {/* Lista farmaciilor */}
          <div className="max-h-48 overflow-y-auto">
            {filteredWorkplaces.length > 0 ? (
              filteredWorkplaces.map((wp) => (
                <button
                  key={wp._id}
                  type="button"
                  onClick={() => handleSelect(wp._id)}
                  className="w-full px-4 py-2.5 text-sm text-left hover:bg-emerald-50 active:bg-emerald-100 transition-colors border-b border-slate-100 last:border-b-0"
                >
                  {wp.name}
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-slate-500 text-center">
                {searchQuery ? 'Nu s-au găsit farmacii' : 'Nu există farmacii disponibile'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const AnnouncementManager: React.FC<AnnouncementManagerProps> = ({ onClose }) => {
  const [message, setMessage] = useState('');
  const [selectedWorkplaceIds, setSelectedWorkplaceIds] = useState<string[]>([]);
  const [allWorkplaces, setAllWorkplaces] = useState<Workplace[]>([]);
  const [isGlobal, setIsGlobal] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    return nextWeek.toISOString().split('T')[0];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);

  // Încarcă farmaciile
  useEffect(() => {
    const loadWorkplaces = async () => {
      try {
        const workplaces = await workplaceService.getAllForAdmin();
        const activeWorkplaces = workplaces.filter(w => w.isActive);
        console.log('Farmacii încărcate:', activeWorkplaces.length, activeWorkplaces);
        setAllWorkplaces(activeWorkplaces);
      } catch (err) {
        console.error('Eroare la încărcarea farmaciilor:', err);
        setAllWorkplaces([]);
      }
    };
    loadWorkplaces();
  }, []);

  // Încarcă mesajele existente
  useEffect(() => {
    loadAnnouncements();
  }, []);


  const loadAnnouncements = async () => {
    setLoadingAnnouncements(true);
    try {
      const data = await announcementService.getAll();
      setAnnouncements(data);
    } catch (err) {
      console.error('Eroare la încărcarea mesajelor:', err);
    } finally {
      setLoadingAnnouncements(false);
    }
  };

  const handleAddWorkplace = (workplaceId: string) => {
    if (!selectedWorkplaceIds.includes(workplaceId)) {
      setSelectedWorkplaceIds(prev => [...prev, workplaceId]);
    }
  };

  const handleRemoveWorkplace = (workplaceId: string) => {
    setSelectedWorkplaceIds(prev => prev.filter(id => id !== workplaceId));
  };

  const handleToggleGlobal = () => {
    setIsGlobal(!isGlobal);
    if (!isGlobal) {
      setSelectedWorkplaceIds([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!message.trim()) {
      setError('Mesajul este obligatoriu');
      return;
    }

    if (!startDate || !endDate) {
      setError('Data de început și data de sfârșit sunt obligatorii');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError('Data de început trebuie să fie înainte de data de sfârșit');
      return;
    }

    if (!isGlobal && selectedWorkplaceIds.length === 0) {
      setError('Selectează cel puțin o farmacie sau alege "Mesaj pentru toate farmaciile"');
      return;
    }

    setLoading(true);
    try {
      const formData: AnnouncementFormData = {
        message: message.trim(),
        workplaceIds: isGlobal ? [] : selectedWorkplaceIds,
        startDate,
        endDate,
      };

      await announcementService.create(formData);
      setSuccess('Mesajul a fost trimis cu succes!');
      setMessage('');
      setSelectedWorkplaceIds([]);
      setIsGlobal(true);
      setStartDate(new Date().toISOString().split('T')[0]);
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      setEndDate(nextWeek.toISOString().split('T')[0]);
      
      // Reîncarcă mesajele
      await loadAnnouncements();
      
      // Reset form după 2 secunde
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Eroare la trimiterea mesajului');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sigur vrei să ștergi acest mesaj? Acțiunea este permanentă.')) return;
    
    try {
      await announcementService.delete(id);
      await loadAnnouncements();
      setSuccess('Mesajul a fost șters cu succes!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Eroare la ștergerea mesajului:', err);
      alert('Eroare la ștergerea mesajului');
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('Sigur vrei să ștergi TOATE mesajele? Acțiunea este permanentă și nu poate fi anulată.')) return;
    
    try {
      const result = await announcementService.deleteAll();
      await loadAnnouncements();
      setSuccess(`Toate mesajele (${result.deletedCount}) au fost șterse cu succes!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Eroare la ștergerea mesajelor:', err);
      alert('Eroare la ștergerea mesajelor');
    }
  };

  const formatDateRange = (start: string, end: string): string => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.toLocaleDateString('ro-RO')} - ${endDate.toLocaleDateString('ro-RO')}`;
  };

  const isActive = (announcement: Announcement): boolean => {
    const now = new Date();
    const start = new Date(announcement.startDate);
    const end = new Date(announcement.endDate);
    return now >= start && now <= end && announcement.isActive;
  };

  // Farmaciile disponibile pentru dropdown (exclude cele deja selectate)
  const availableWorkplaces = allWorkplaces.filter(wp => !selectedWorkplaceIds.includes(wp._id));
  // Farmaciile selectate (pentru afișare ca tag-uri)
  const selectedWorkplaces = allWorkplaces.filter(wp => selectedWorkplaceIds.includes(wp._id));
  
  // Funcție helper pentru a obține numele farmaciilor pentru un mesaj
  const getWorkplaceNames = (workplaceIds: string[]): string[] => {
    if (workplaceIds.length === 0) return ['Toate farmaciile'];
    return workplaceIds
      .map(id => allWorkplaces.find(wp => wp._id === id)?.name)
      .filter((name): name is string => !!name);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-900">Mesaje către farmacii</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Form pentru creare mesaj */}
      <form onSubmit={handleSubmit} className="mb-8 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Mesaj
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
            placeholder="Scrie mesajul către farmacii..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Data de început
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Data de sfârșit
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Destinatar mesaj
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex items-center gap-3 p-4 bg-white border-2 rounded-xl cursor-pointer transition-all hover:border-emerald-300 hover:bg-emerald-50/50">
                <input
                  type="radio"
                  name="messageType"
                  checked={isGlobal}
                  onChange={() => setIsGlobal(true)}
                  className="w-5 h-5 text-emerald-600 border-slate-300 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <span className="text-sm font-semibold text-slate-700 block">Toate farmaciile</span>
                  <span className="text-xs text-slate-500">Mesajul va fi trimis tuturor farmaciilor</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-4 bg-white border-2 rounded-xl cursor-pointer transition-all hover:border-emerald-300 hover:bg-emerald-50/50">
                <input
                  type="radio"
                  name="messageType"
                  checked={!isGlobal}
                  onChange={() => setIsGlobal(false)}
                  className="w-5 h-5 text-emerald-600 border-slate-300 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <span className="text-sm font-semibold text-slate-700 block">Farmacii selectate</span>
                  <span className="text-xs text-slate-500">Alege farmaciile țintă</span>
                </div>
              </label>
            </div>
          </div>

          {!isGlobal && (
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl">
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Selectează farmaciile țintă
              </label>
              
              {/* Dropdown custom pentru selectare farmacii */}
              <WorkplaceDropdown
                workplaces={availableWorkplaces}
                onSelect={handleAddWorkplace}
                placeholder={
                  allWorkplaces.length === 0 
                    ? 'Se încarcă farmaciile...' 
                    : availableWorkplaces.length === 0
                    ? 'Toate farmaciile sunt selectate'
                    : 'Selectează o farmacie'
                }
                disabled={allWorkplaces.length === 0 || availableWorkplaces.length === 0}
              />

              {/* Tag-uri cu farmaciile selectate */}
              {selectedWorkplaces.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">
                    Farmacii selectate ({selectedWorkplaces.length}):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedWorkplaces.map((wp) => (
                      <span
                        key={wp._id}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium border border-emerald-200"
                      >
                        {wp.name}
                        <button
                          type="button"
                          onClick={() => handleRemoveWorkplace(wp._id)}
                          className="text-emerald-600 hover:text-emerald-800 hover:bg-emerald-200 rounded transition-colors p-0.5"
                          aria-label="Elimină farmacie"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
            {success}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || !message.trim()}
            className="px-6 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Se trimite...' : 'Trimite mesaj'}
          </button>
        </div>
      </form>

      {/* Lista mesajelor existente */}
      <div className="border-t border-slate-200 pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Mesaje trimise</h3>
          {announcements.length > 0 && (
            <button
              onClick={handleDeleteAll}
              className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 hover:border-red-300 transition-colors"
              title="Șterge toate mesajele"
            >
              Șterge toate mesajele
            </button>
          )}
        </div>
        
        {loadingAnnouncements ? (
          <div className="text-center py-8 text-slate-500">Se încarcă...</div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-8 text-slate-500">Nu există mesaje trimise</div>
        ) : (
          <div className="space-y-3">
            {announcements.map((announcement) => {
              const active = isActive(announcement);
              return (
                <div
                  key={announcement._id}
                  className={`p-4 border rounded-lg ${
                    active 
                      ? 'bg-emerald-50 border-emerald-200' 
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {active ? (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-emerald-100 text-emerald-700">
                            Activ
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-slate-100 text-slate-700">
                            Inactiv
                          </span>
                        )}
                        <span className="text-xs text-slate-500">
                          {announcement.workplaceIds.length === 0 
                            ? 'Toate farmaciile' 
                            : `${announcement.workplaceIds.length} ${announcement.workplaceIds.length === 1 ? 'farmacie' : 'farmacii'}`
                          }
                        </span>
                      </div>
                      <p className="text-sm text-slate-900 mb-2">{announcement.message}</p>
                      {/* Afișează numele farmaciilor țintă */}
                      <div className="mt-2">
                        <span className="text-xs font-medium text-slate-600">Farmacii țintă: </span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {getWorkplaceNames(announcement.workplaceIds).map((name, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded border border-emerald-200"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>De: {announcement.createdByName}</span>
                        <span>{formatDateRange(announcement.startDate, announcement.endDate)}</span>
                        <span>
                          {new Date(announcement.createdAt).toLocaleDateString('ro-RO', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(announcement._id)}
                      className="px-3 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                      title="Șterge mesaj"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
