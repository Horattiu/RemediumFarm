import { apiClient } from './api/client';
import type { Announcement, AnnouncementFormData } from '../types/announcement.types';

/**
 * Announcement Service
 * Serviciu pentru gestionarea mesajelor/anunțurilor de la manager
 */
export const announcementService = {
  /**
   * Obține toate mesajele active pentru farmacia curentă sau toate (superadmin)
   */
  async getAll(): Promise<Announcement[]> {
    const response = await apiClient.get<Announcement[]>('/api/announcements');
    return (response.data as Announcement[]) || [];
  },

  /**
   * Creează un mesaj nou (doar superadmin)
   */
  async create(data: AnnouncementFormData): Promise<Announcement> {
    const response = await apiClient.post<Announcement>('/api/announcements', data);
    return response.data as Announcement;
  },

  /**
   * Arhivează un mesaj (doar superadmin)
   */
  async archive(id: string): Promise<Announcement> {
    const response = await apiClient.put<Announcement>(`/api/announcements/${id}`, {
      isActive: false,
    });
    return response.data as Announcement;
  },

  /**
   * Reactivează un mesaj (doar superadmin)
   */
  async activate(id: string): Promise<Announcement> {
    const response = await apiClient.put<Announcement>(`/api/announcements/${id}`, {
      isActive: true,
    });
    return response.data as Announcement;
  },

  /**
   * Șterge un mesaj (doar superadmin)
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/announcements/${id}`);
  },

  /**
   * Șterge toate mesajele (doar superadmin)
   */
  async deleteAll(): Promise<{ deletedCount: number }> {
    const response = await apiClient.delete<{ message: string; deletedCount: number }>('/api/announcements/all');
    return response.data;
  },
};











