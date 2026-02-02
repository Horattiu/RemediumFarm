import { apiClient } from './api/client';
import type { Workplace, WorkplaceFormData } from '../types/workplace.types';

export const workplaceService = {
  /**
   * Get all workplaces
   */
  async getAll(): Promise<Workplace[]> {
    const response = await apiClient.get<Workplace[]>('/api/workplaces');
    return (response.data as Workplace[]) || [];
  },

  /**
   * Get all workplaces (for superadmin - includes all workplaces)
   */
  async getAllForAdmin(): Promise<Workplace[]> {
    const response = await apiClient.get<Workplace[]>('/api/workplaces/all');
    return (response.data as Workplace[]) || [];
  },

  /**
   * Get workplace by ID
   */
  async getById(id: string): Promise<Workplace> {
    const response = await apiClient.get<Workplace>(`/api/workplaces/${id}`);
    return response.data as Workplace;
  },

  /**
   * Create workplace
   */
  async create(data: WorkplaceFormData): Promise<Workplace> {
    const response = await apiClient.post<Workplace>('/api/workplaces', data);
    return response.data as Workplace;
  },

  /**
   * Update workplace
   */
  async update(id: string, data: Partial<WorkplaceFormData>): Promise<Workplace> {
    const response = await apiClient.put<Workplace>(`/api/workplaces/${id}`, data);
    return response.data as Workplace;
  },

  /**
   * Delete workplace
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/workplaces/${id}`);
  },
};

