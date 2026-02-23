import React, { useState, useEffect } from 'react';
import { announcementService } from '@/shared/services/announcementService';
import { getUserFromStorage } from '@/features/auth/utils/auth.utils';
import type { Announcement } from '@/shared/types/announcement.types';

export const AnnouncementsBanner: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Verifică dacă utilizatorul este admin (farmacie) - bannerul nu apare pentru accountancy sau superadmin
  const user = getUserFromStorage();
  const shouldShowBanner = user?.role === 'admin'; // Doar pentru admin (farmacie)
  
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('dismissedAnnouncements');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    // Încarcă mesajele doar dacă utilizatorul este admin (farmacie)
    if (shouldShowBanner) {
      loadAnnouncements();
    } else {
      setLoading(false);
    }
  }, [shouldShowBanner]);

  const loadAnnouncements = async () => {
    setLoading(true);
    try {
      const data = await announcementService.getAll();
      // Filtrează doar mesajele active în perioada curentă
      const now = new Date();
      const active = data.filter(a => {
        const start = new Date(a.startDate);
        const end = new Date(a.endDate);
        return a.isActive && now >= start && now <= end && !dismissedIds.includes(a._id);
      });
      setAnnouncements(active);
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
    setAnnouncements(prev => prev.filter(a => a._id !== id));
  };

  // Nu afișa bannerul dacă utilizatorul nu este admin (farmacie) sau dacă nu sunt mesaje
  if (!shouldShowBanner || loading || announcements.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mb-6">
      {announcements.map((announcement) => (
        <div
          key={announcement._id}
          className="p-4 rounded-lg border bg-emerald-50 border-emerald-200"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
                {announcement.workplaceIds.length === 0 && (
                  <span className="text-xs text-slate-500">• Toate farmaciile</span>
                )}
              </div>
              <p className="text-sm text-slate-900 mb-2">{announcement.message}</p>
            </div>
            <button
              onClick={() => handleDismiss(announcement._id)}
              className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
              aria-label="Închide mesaj"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

