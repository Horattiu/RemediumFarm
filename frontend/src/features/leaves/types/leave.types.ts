import type { BaseEntity, LeaveStatus, LeaveType } from '@/shared/types/common.types';

export interface Leave extends BaseEntity {
  employeeId: string | { _id: string; name?: string };
  name?: string; // Denormalizat: numele angajatului (poate veni din employeeId populate)
  workplaceId: string | { _id: string; name?: string };
  function?: string;
  type: LeaveType | 'odihna' | 'medical' | 'fara_plata' | 'eveniment';
  reason?: string;
  startDate: string; // ISO date string
  endDate: string;   // ISO date string
  days?: number;
  directSupervisorName?: string;
  status: LeaveStatus | 'În așteptare' | 'Aprobată' | 'Respinsă';
  createdBy?: string | { _id: string; name?: string };
}

export interface LeaveRequest {
  employeeId: string;
  workplaceId: string;
  function: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  type: LeaveType | 'odihna' | 'medical' | 'fara_plata' | 'eveniment';
  reason: string;
  days: number; // Număr de zile (inclusiv start și end)
  directSupervisorName?: string;
  force?: boolean; // Pentru forțarea în ciuda conflictelor
}

export interface LeaveFormData {
  employeeId: string;
  function: string;
  startDate: Date | string;
  endDate: Date | string;
  type: LeaveType | 'odihna' | 'medical' | 'fara_plata' | 'eveniment';
  reason: string;
  directSupervisorName?: string;
}

export interface LeaveCalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  type: LeaveType | 'odihna' | 'medical' | 'fara_plata' | 'eveniment';
  status: LeaveStatus | 'În așteptare' | 'Aprobată' | 'Respinsă';
  employeeName: string;
}

export interface LeaveStatistics {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  byType: Record<string, number>;
}

export interface LeaveConflict {
  type: 'timesheet' | 'overlap';
  message: string;
  conflictingTimesheets?: Array<{
    date: string;
    entries: Array<{
      workplaceName: string;
      startTime: string;
      endTime: string;
      hoursWorked: number;
    }>;
  }>;
  overlappingLeaves?: Array<{
    _id: string;
    startDate: string;
    endDate: string;
    status: string;
  }>;
  canForce?: boolean;
}

// Types for Concediu component
export interface TimesheetConflictData {
  leave: {
    _id?: string;
    startDate: string;
    endDate: string;
    status?: string;
  };
  conflictingTimesheets: Array<{
    date: string;
    entries: Array<{
      workplaceName: string;
      startTime: string;
      endTime: string;
      hoursWorked: number;
    }>;
  }>;
  isNewLeave: boolean;
}

export interface LeaveOverlapData {
  conflicts: Array<{
    _id: string;
    startDate: string;
    endDate: string;
    type: string;
    days: number;
    status: string;
  }>;
  message: string;
  isNewLeave: boolean;
}

export interface LeaveFormState {
  employeeId: string;
  function: string;
  startDate: string;
  endDate: string;
  type: string;
  reason: string;
  directSupervisorName: string;
}

