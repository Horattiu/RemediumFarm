import type { User } from '../types/auth.types';
import type { UserRole } from '@/shared/types/common.types';

/**
 * Get user role display name
 */
export const getRoleDisplayName = (role: UserRole): string => {
  const roleMap: Record<UserRole, string> = {
    superadmin: 'Super Admin',
    admin: 'Admin Farmacie',
    accountancy: 'Contabilitate',
    employee: 'Angajat',
  };
  return roleMap[role] || role;
};

/**
 * Get redirect path based on user role
 */
export const getRedirectPath = (role: UserRole): string => {
  const pathMap: Record<UserRole, string> = {
    superadmin: '/adminmanager',
    admin: '/adminfarmacie',
    accountancy: '/accountancy',
    employee: '/user',
  };
  return pathMap[role] || '/';
};

/**
 * Normalize workplace ID (handles both string and populated object)
 */
export const normalizeWorkplaceId = (user: User): string => {
  if (typeof user.workplaceId === 'string') {
    return user.workplaceId;
  }
  if (user.workplaceId && typeof user.workplaceId === 'object' && '_id' in user.workplaceId) {
    return user.workplaceId._id;
  }
  return '';
};

/**
 * Save user to localStorage safely
 */
export const saveUserToStorage = (user: User): void => {
  const safeUser = {
    _id: user._id,
    name: user.name,
    role: user.role,
    workplaceId: normalizeWorkplaceId(user),
  };
  localStorage.setItem('user', JSON.stringify(safeUser));
};

/**
 * Get user from localStorage
 */
export const getUserFromStorage = (): User | null => {
  try {
    const stored = localStorage.getItem('user');
    if (!stored) return null;
    return JSON.parse(stored) as User;
  } catch {
    return null;
  }
};


