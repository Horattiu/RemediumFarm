import { apiClient } from '@/shared/services/api/client';
import type { Timesheet, TimesheetFormData, TimesheetStatistics, MonthlySchedule, TimesheetViewerEntry } from '../types/timesheet.types';

export const timesheetService = {
  /**
   * Get timesheets by workplace
   */
  async getByWorkplace(
    workplaceId: string,
    from?: string,
    to?: string
  ): Promise<Timesheet[]> {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;

    const response = await apiClient.get<Timesheet[]>(
      `/api/pontaj/by-workplace/${workplaceId}`,
      { params }
    );

    return (response.data as Timesheet[]) || [];
  },

  /**
   * Get all timesheets (all workplaces)
   */
  async getAll(from?: string, to?: string): Promise<Timesheet[]> {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;

    const response = await apiClient.get<Timesheet[]>('/api/pontaj/all-workplaces', { params });
    return (response.data as Timesheet[]) || [];
  },

  /**
   * Get all timesheet entries (all workplaces) - returns individual entries
   * Used by AccountancyDashboard
   */
  async getAllEntries(from?: string, to?: string): Promise<TimesheetViewerEntry[]> {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;

    const response = await apiClient.get<TimesheetViewerEntry[]>('/api/pontaj/all-workplaces', { params });
    return (response.data as TimesheetViewerEntry[]) || [];
  },

  /**
   * Create or update timesheet
   */
  async save(data: TimesheetFormData): Promise<Timesheet> {
    console.log("💾 [FRONTEND] timesheetService.save REQUEST:", {
      employeeId: data.employeeId,
      workplaceId: data.workplaceId,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      hoursWorked: data.hoursWorked,
      status: data.status,
      force: data.force,
    });

    const response = await apiClient.post<Timesheet>('/api/pontaj', data);
    
    console.log("💾 [FRONTEND] timesheetService.save RESPONSE:", {
      employeeId: data.employeeId,
      workplaceId: data.workplaceId,
      date: data.date,
      responseData: response.data,
    });

    return response.data as Timesheet;
  },

  /**
   * Delete timesheet
   */
  async delete(employeeId: string, date: string): Promise<void> {
    await apiClient.delete('/api/pontaj', {
      params: { employeeId, date },
    });
  },

  /**
   * Get timesheet statistics
   */
  async getStats(from?: string, to?: string, workplaceId?: string): Promise<TimesheetStatistics[]> {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    if (workplaceId) params.workplaceId = workplaceId;

    const response = await apiClient.get<TimesheetStatistics[]>('/api/pontaj/stats', { params });
    return (response.data as TimesheetStatistics[]) || [];
  },

  /**
   * Get monthly schedule
   */
  async getMonthlySchedule(
    employeeId: string,
    month: string
  ): Promise<MonthlySchedule | null> {
    const response = await apiClient.get<MonthlySchedule>(
      `/api/employees/${employeeId}/timesheet`,
      { params: { month } }
    );
    return response.data as MonthlySchedule || null;
  },

  /**
   * Get workplace schedule for a month
   */
  async getWorkplaceSchedule(
    workplaceId: string,
    year: number,
    month: number
  ): Promise<Record<string, Record<string, string>>> {
    const response = await apiClient.get<{ schedule: Record<string, Record<string, string>> }>(
      `/api/schedule/${workplaceId}/${year}/${month}`
    );
    // Backend returnează { schedule: {...} }
    const data = response.data as { schedule?: Record<string, Record<string, string>> };
    return data?.schedule || {};
  },

  /**
   * Save workplace schedule for a month
   */
  async saveWorkplaceSchedule(
    workplaceId: string,
    year: number,
    month: number,
    schedule: Record<string, Record<string, string>>
  ): Promise<void> {
    await apiClient.post('/api/schedule', {
      workplaceId,
      year,
      month,
      schedule,
    });
  },

  /**
   * Get timesheet entries by workplace (for TimesheetViewer)
   * Returns individual entries, not full Timesheet objects
   */
  async getEntriesByWorkplace(
    workplaceId: string,
    from?: string,
    to?: string
  ): Promise<TimesheetViewerEntry[]> {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;

    console.log("📥 [FRONTEND] getEntriesByWorkplace REQUEST:", {
      workplaceId,
      from,
      to,
      url: `/api/pontaj/by-workplace/${workplaceId}`,
      params,
    });

    const response = await apiClient.get<TimesheetViewerEntry[]>(
      `/api/pontaj/by-workplace/${workplaceId}`,
      { params }
    );

    const entries = (response.data as TimesheetViewerEntry[]) || [];
    
    console.log("📥 [FRONTEND] getEntriesByWorkplace RESPONSE:", {
      workplaceId,
      from,
      to,
      entriesCount: entries.length,
      sampleEntries: entries.slice(0, 3).map(e => ({
        employeeId: typeof e.employeeId === 'object' ? e.employeeId?._id : e.employeeId,
        employeeName: e.employeeName,
        date: e.date,
        workplaceId: typeof e.workplaceId === 'object' ? e.workplaceId?._id : e.workplaceId,
        workplaceName: e.workplaceName,
        hoursWorked: e.hoursWorked,
        status: e.status,
        type: e.type,
      })),
    });

    return entries;
  },
};


