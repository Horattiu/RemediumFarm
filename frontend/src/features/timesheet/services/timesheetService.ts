import { apiClient } from '@/shared/services/api/client';
import { debugLog } from '@/shared/utils/debug';
import type { Timesheet, TimesheetFormData, TimesheetStatistics, MonthlySchedule, TimesheetViewerEntry, PlanningManagerNote, WorkplaceSchedulePayload } from '../types/timesheet.types';

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
    debugLog("💾 [DEBUG] timesheetService.save request", {
      employeeId: data.employeeId,
      workplaceId: data.workplaceId,
      date: data.date,
      status: data.status,
      force: data.force,
    });
    const response = await apiClient.post<Timesheet>('/api/pontaj', data);
    debugLog("✅ [DEBUG] timesheetService.save response", {
      employeeId: data.employeeId,
      date: data.date,
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
   * Get workplace schedule for a month (+ comentarii manager, dacă există)
   */
  async getWorkplaceSchedule(
    workplaceId: string,
    year: number,
    month: number
  ): Promise<WorkplaceSchedulePayload> {
    const response = await apiClient.get<{
      schedule: Record<string, Record<string, string>>;
      managerNotes?: PlanningManagerNote[];
    }>(`/api/schedule/${workplaceId}/${year}/${month}`);
    const data = response.data as WorkplaceSchedulePayload | undefined;
    return {
      schedule: data?.schedule || {},
      managerNotes: data?.managerNotes || [],
    };
  },

  /**
   * Adaugă comentariu manager pe planificare (doar superadmin)
   */
  async addPlanningManagerNote(
    workplaceId: string,
    year: number,
    month: number,
    text: string,
    durationDays: number = 1
  ): Promise<PlanningManagerNote[]> {
    const response = await apiClient.post<{ managerNotes: PlanningManagerNote[] }>(
      `/api/schedule/${workplaceId}/${year}/${month}/notes`,
      { text, durationDays }
    );
    const data = response.data as { managerNotes?: PlanningManagerNote[] } | undefined;
    return data?.managerNotes || [];
  },

  /**
   * Șterge comentariu manager (doar superadmin)
   */
  async deletePlanningManagerNote(
    workplaceId: string,
    year: number,
    month: number,
    noteId: string
  ): Promise<void> {
    await apiClient.delete(`/api/schedule/${workplaceId}/${year}/${month}/notes/${noteId}`);
  },

  /**
   * Save workplace schedule for a month
   */
  async saveWorkplaceSchedule(
    workplaceId: string,
    year: number,
    month: number,
    schedule: Record<string, Record<string, string>>
  ): Promise<Record<string, Record<string, string>>> {
    const response = await apiClient.post<{ schedule?: Record<string, Record<string, string>> }>('/api/schedule', {
      workplaceId,
      year,
      month,
      schedule,
    });
    const data = response.data as { schedule?: Record<string, Record<string, string>> };
    return data?.schedule || {};
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
    debugLog("📥 [DEBUG] getEntriesByWorkplace request", { workplaceId, from, to });

    const response = await apiClient.get<TimesheetViewerEntry[]>(
      `/api/pontaj/by-workplace/${workplaceId}`,
      { params }
    );

    const entries = (response.data as TimesheetViewerEntry[]) || [];
    debugLog("✅ [DEBUG] getEntriesByWorkplace response", {
      workplaceId,
      entriesCount: entries.length,
    });

    return entries;
  },
};


