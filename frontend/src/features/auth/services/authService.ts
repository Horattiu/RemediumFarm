import { apiClient } from '@/shared/services/api/client';
import type { LoginRequest, LoginResponse, User } from '../types/auth.types';

export const authService = {
  /**
   * Login user
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/api/login', credentials);
    
    // Backend returnează direct { message, user } sau wrapped în { data: { message, user } }
    if (response.data) {
      // Dacă e wrapped
      if ('data' in response.data && typeof response.data === 'object') {
        return response.data as LoginResponse;
      }
      // Dacă e direct
      return response.data as LoginResponse;
    }
    
    // Fallback: încercăm să returnăm response-ul direct
    if (response && typeof response === 'object' && 'user' in response) {
      return response as unknown as LoginResponse;
    }
    
    throw new Error('Invalid response from server');
  },

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      await apiClient.post('/api/logout');
    } catch (error) {
      console.error('Logout error:', error);
    }
  },

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<User>('/api/user/me');
    if (response.data) {
      return response.data as User;
    }
    throw new Error('User not found');
  },
};

