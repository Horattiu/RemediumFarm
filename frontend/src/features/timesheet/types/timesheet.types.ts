import type { BaseEntity, TimesheetStatus } from '@/shared/types/common.types';
import type { Employee } from '@/shared/types/employee.types';

export interface TimesheetEntry {
  workplaceId: string;
  workplaceName: string;
  startTime?: string; // HH:mm format
  endTime?: string;   // HH:mm format
  hoursWorked?: number;
  minutesWorked?: number;
  type: 'home' | 'visitor';
  leaveType?: string | null; // null, "odihna", "medical", "liber"
  status?: TimesheetStatus | null;
  notes?: string;
}

export interface Timesheet extends BaseEntity {
  employeeId: string;
  employeeName: string;
  date: string; // ISO date string (YYYY-MM-DD)
  entries: TimesheetEntry[];
  totalHours: number;
  totalMinutes: number;
  isComplete: boolean;
}

export interface TimesheetFormData {
  employeeId: string;
  workplaceId: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  hoursWorked?: number;
  minutesWorked?: number;
  leaveType?: string | null;
  status?: TimesheetStatus;
  notes?: string;
  force?: boolean;
}

export interface DaySchedule {
  date: string; // YYYY-MM-DD
  startTime?: string;
  endTime?: string;
  status: TimesheetStatus;
  isHoliday: boolean;
  isWeekend: boolean;
}

export interface MonthlySchedule extends BaseEntity {
  employeeId: string;
  workplaceId: string;
  month: string; // YYYY-MM format
  schedule: DaySchedule[];
}

export interface TimesheetStatistics {
  totalDays?: number;
  workedDays?: number;
  leaveDays?: number;
  totalHours: number;
  totalMinutes?: number;
  averageHoursPerDay?: number;
  // For aggregated stats from /api/pontaj/stats
  employeeId?: string | { _id: string };
  employeeName?: string;
  workplaceId?: string | { _id: string };
  monthlyTargetHours?: number;
  visitorHours?: number;
}

export interface Visitor {
  _id: string;
  name: string;
  workplaceId?: string;
}

// Workplace-level schedule structure: { [employeeId]: { [dateKey: YYYY-MM-DD]: shiftId } }
export type WorkplaceSchedule = Record<string, Record<string, string>>;

export interface ShiftType {
  id: string;
  nume: string;
  ore: string;
  culoare: string;
}

export interface DayInfo {
  zi: number;
  data: Date;
  ziSaptamana: string;
  weekend: boolean;
}

export interface ShiftInfo {
  id: string;
  nume: string;
  ore: string;
  culoareHex: string;
}

// TimesheetViewer specific types
export interface TimesheetViewerEntry {
  _id?: string;
  employeeId: string | { _id: string };
  employeeName: string;
  workplaceId: string | { _id: string };
  workplaceName: string;
  date: string; // YYYY-MM-DD
  startTime?: string;
  endTime?: string;
  hoursWorked?: number;
  minutesWorked?: number;
  type: 'home' | 'visitor';
  leaveType?: string | null;
  status?: TimesheetStatus | null;
  notes?: string;
}

export interface DayHoursData {
  hours?: number;
  minutes?: number;
  isLeave?: boolean;
  leaveType?: string;
  isVisitor?: boolean;
  visitorInfo?: Array<{
    workplaceName: string;
    date: string;
  }>;
}

export interface PontajData {
  employee: Employee;
  date: string; // YYYY-MM-DD
}

export interface OverlapData {
  payload: TimesheetFormData;
  employeeName: string;
  date: string;
  overlappingEntry?: {
    startTime: string;
    endTime: string;
  };
  newEntry?: {
    startTime: string;
    endTime: string;
  };
}

export interface VisitorInfo {
  workplaceName: string;
  date: string;
}


