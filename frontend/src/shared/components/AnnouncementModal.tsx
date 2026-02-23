import React, { useState, useEffect } from 'react';
import { announcementService } from '@/shared/services/announcementService';
import { getUserFromStorage } from '@/features/auth/utils/auth.utils';
import type { Announcement } from '@/shared/types/announcement.types';

export const AnnouncementModal: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Verifică dacă utilizatorul este admin (farmacie) - modalul apare doar pentru farmacii
  const user = getUserFromStorage();
  const shouldShowModal = user?.role === 'admin'; // Doar pentru admin (farmacie), nu pentru superadmin sau accountancy
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('dismissedAnnouncements');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // Încarcă mesajele doar dacă utilizatorul este admin (farmacie)
    if (shouldShowModal) {
      loadAnnouncements();
    } else {
      setLoading(false);
    }
  }, [shouldShowModal]);

  const loadAnnouncements = async () => {
    setLoading(true);
    try {
      const data = await announcementService.getAll();
      // Backend-ul returnează deja mesajele filtrate pe perioadă și farmacie
      // Aici doar filtrăm pe dismissedIds
      const visible = data.filter(a => !dismissedIds.includes(a._id));
      setAnnouncements(visible);
    } catch (err) {
      console.error('Eroare la încărcarea mesajelor:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => {
      const updated = [...prev, id];
      localStorage.setItem('dismissedAnnouncements', JSON.stringify(updated));
      return updated;
    });
    
    // Dacă mai sunt mesaje, treci la următorul
    if (announcements.length > 1) {
      const nextIndex = announcements.findIndex(a => a._id === id);
      if (nextIndex !== -1) {
        const remaining = announcements.filter(a => a._id !== id);
        setAnnouncements(remaining);
        setCurrentIndex(0);
      }
    } else {
      setAnnouncements([]);
    }
  };

  const handleNext = () => {
    if (currentIndex < announcements.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  // Nu afișa modalul dacă utilizatorul nu este admin (farmacie)
  if (!shouldShowModal || loading || announcements.length === 0) {
    return null;
  }

  const currentAnnouncement = announcements[currentIndex];
  if (!currentAnnouncement) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Mesaj</h3>
              {announcements.length > 1 && (
                <p className="text-xs text-emerald-100">
                  {currentIndex + 1} din {announcements.length}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => handleDismiss(currentAnnouncement._id)}
            className="text-white hover:text-emerald-100 transition-colors"
            aria-label="Închide mesaj"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            <div className="prose max-w-none">
              <p className="text-slate-900 text-base leading-relaxed whitespace-pre-wrap">
                {currentAnnouncement.message}
              </p>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          {announcements.length > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ← Anterior
              </button>
              <span className="text-xs text-slate-500">
                {currentIndex + 1} / {announcements.length}
              </span>
              <button
                onClick={handleNext}
                disabled={currentIndex === announcements.length - 1}
                className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Următor →
              </button>
            </div>
          )}
          <div className="ml-auto">
            <button
              onClick={() => handleDismiss(currentAnnouncement._id)}
              className="px-6 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Am înțeles
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

