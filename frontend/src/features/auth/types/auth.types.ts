import type { BaseEntity, UserRole } from '@/shared/types/common.types';

export interface Workplace {
  _id: string;
  name: string;
  address?: string;
  phone?: string;
}

export interface User extends BaseEntity {
  name: string;
  role: UserRole;
  workplaceId: string | Workplace;
  email?: string;
  phone?: string;
  function?: string;
  isActive?: boolean;
  monthlyTargetHours?: number;
  emailNotificationsEnabled?: boolean;
}

export interface LoginRequest {
  name: string;
  password: string;
}

export interface LoginResponse {
  message?: string;
  user: User;
  token?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}


