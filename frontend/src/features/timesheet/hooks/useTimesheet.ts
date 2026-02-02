import { useState, useCallback } from 'react';
import { timesheetService } from '../services/timesheetService';
import type { Timesheet, TimesheetFormData } from '../types/timesheet.types';

interface UseTimesheetOptions {
  workplaceId?: string;
  from?: string;
  to?: string;
  autoLoad?: boolean;
}

export const useTimesheet = (options: UseTimesheetOptions = {}) => {
  const { workplaceId, from, to, autoLoad = false } = options;
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workplaceId && !autoLoad) return;

    setLoading(true);
    setError(null);

    try {
      let data: Timesheet[];
      if (workplaceId) {
        data = await timesheetService.getByWorkplace(workplaceId, from, to);
      } else {
        data = await timesheetService.getAll(from, to);
      }
      setTimesheets(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Eroare la încărcare pontaj';
      setError(errorMessage);
      console.error('Error loading timesheets:', err);
    } finally {
      setLoading(false);
    }
  }, [workplaceId, from, to, autoLoad]);

  const save = useCallback(async (data: TimesheetFormData) => {
    setLoading(true);
    setError(null);

    try {
      const saved = await timesheetService.save(data);
      // Reload after save
      await load();
      return saved;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Eroare la salvare pontaj';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [load]);

  const remove = useCallback(async (employeeId: string, date: string) => {
    setLoading(true);
    setError(null);

    try {
      await timesheetService.delete(employeeId, date);
      // Reload after delete
      await load();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Eroare la ștergere pontaj';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [load]);

  return {
    timesheets,
    loading,
    error,
    load,
    save,
    remove,
  };
};


