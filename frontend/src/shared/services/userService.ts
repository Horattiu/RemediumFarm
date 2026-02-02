import { apiClient } from './api/client';
import type { User } from '@/features/auth/types/auth.types';

export const userService = {
  /**
   * Get all users
   */
  async getAll(): Promise<User[]> {
    const response = await apiClient.get<User[]>('/api/users');
    return (response.data as User[]) || [];
  },

  /**
   * Get user by ID
   */
  async getById(id: string): Promise<User> {
    const response = await apiClient.get<User>(`/api/users/${id}`);
    return response.data as User;
  },

  /**
   * Update user
   */
  async update(id: string, data: Partial<User>): Promise<User> {
    const response = await apiClient.put<User>(`/api/users/${id}`, data);
    return response.data as User;
  },

  /**
   * Delete user
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/users/${id}`);
  },
};

