import { useState, useCallback } from 'react';
import { timesheetService } from '../services/timesheetService';
import type { TimesheetStatistics } from '../types/timesheet.types';

interface UseTimesheetStatsOptions {
  from?: string;
  to?: string;
  workplaceId?: string;
  autoLoad?: boolean;
}

export const useTimesheetStats = (options: UseTimesheetStatsOptions = {}) => {
  const { from, to, workplaceId, autoLoad = false } = options;
  const [stats, setStats] = useState<TimesheetStatistics[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!autoLoad && !from && !to) return;

    setLoading(true);
    setError(null);

    try {
      const data = await timesheetService.getStats(from, to, workplaceId);
      setStats(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Eroare la încărcare statistici';
      setError(errorMessage);
      console.error('Error loading timesheet stats:', err);
    } finally {
      setLoading(false);
    }
  }, [from, to, workplaceId, autoLoad]);

  return {
    stats,
    loading,
    error,
    load,
  };
};


