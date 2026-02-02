import type { BaseEntity } from './common.types';

export interface Employee extends BaseEntity {
  name: string;
  email?: string;
  function?: string;
  workplaceId: string;
  isActive: boolean;
  monthlyTargetHours?: number;
}

export interface EmployeeFormData {
  name: string;
  email?: string;
  function?: string;
  workplaceId: string;
  monthlyTargetHours?: number;
}

