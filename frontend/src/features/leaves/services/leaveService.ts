import { apiClient } from '@/shared/services/api/client';
import { FetchError } from '@/shared/types/api.types';
import type { Leave, LeaveRequest } from '../types/leave.types';

export const leaveService = {
  /**
   * Get leaves by workplace
   */
  async getByWorkplace(workplaceId: string): Promise<Leave[]> {
    const response = await apiClient.get<Leave[]>(`/api/leaves/by-workplace/${workplaceId}`);
    return (response.data as Leave[]) || [];
  },

  /**
   * Get all leaves (for superadmin)
   */
  async getAll(): Promise<Leave[]> {
    const response = await apiClient.get<Leave[]>('/api/leaves/all');
    return (response.data as Leave[]) || [];
  },

  /**
   * Get leave by ID
   */
  async getById(id: string): Promise<Leave> {
    const response = await apiClient.get<Leave>(`/api/leaves/${id}`);
    return response.data as Leave;
  },

  /**
   * Create leave request
   * Throws FetchError with status 409 if there are conflicts
   */
  async create(data: LeaveRequest): Promise<Leave> {
    try {
      const response = await apiClient.post<Leave>('/api/leaves/create', data);
      return response.data as Leave;
    } catch (error) {
      if (error instanceof FetchError && error.status === 409) {
        // Re-throw to let component handle conflict data
        throw error;
      }
      throw error;
    }
  },

  /**
   * Update leave request
   * Throws FetchError with status 409 if there are conflicts
   */
  async update(id: string, data: Partial<LeaveRequest>): Promise<Leave> {
    try {
      const response = await apiClient.put<Leave>(`/api/leaves/${id}`, data);
      return response.data as Leave;
    } catch (error) {
      if (error instanceof FetchError && error.status === 409) {
        // Re-throw to let component handle conflict data
        throw error;
      }
      throw error;
    }
  },

  /**
   * Delete leave request
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/leaves/${id}`);
  },

  /**
   * Approve leave request
   */
  async approve(id: string): Promise<Leave> {
    const response = await apiClient.put<Leave>(`/api/leaves/${id}/approve`, {});
    return response.data as Leave;
  },

  /**
   * Reject leave request
   */
  async reject(id: string, reason?: string): Promise<Leave> {
    const response = await apiClient.put<Leave>(`/api/leaves/${id}/reject`, { reason });
    return response.data as Leave;
  },
};

