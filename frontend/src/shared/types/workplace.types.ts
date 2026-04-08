import type { BaseEntity } from './common.types';

export interface Workplace extends BaseEntity {
  name: string;
  code: string;
  location: string;
  isActive: boolean;
  leaveFiltersProtectionEnabled?: boolean;
  leaveFiltersPasswordSet?: boolean;
}

export interface WorkplaceFormData {
  name: string;
  code: string;
  location: string;
}

