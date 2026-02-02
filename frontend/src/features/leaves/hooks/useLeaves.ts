import { useState, useCallback } from 'react';
import { leaveService } from '../services/leaveService';
import type { Leave, LeaveRequest } from '../types/leave.types';

interface UseLeavesOptions {
  workplaceId?: string;
  autoLoad?: boolean;
}

export const useLeaves = (options: UseLeavesOptions = {}) => {
  const { workplaceId, autoLoad = false } = options;
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!autoLoad && !workplaceId) return;

    setLoading(true);
    setError(null);

    try {
      let data: Leave[];
      if (workplaceId) {
        data = await leaveService.getByWorkplace(workplaceId);
      } else {
        data = await leaveService.getAll();
      }
      setLeaves(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Eroare la încărcare cereri concediu';
      setError(errorMessage);
      console.error('Error loading leaves:', err);
    } finally {
      setLoading(false);
    }
  }, [workplaceId, autoLoad]);

  const create = useCallback(async (data: LeaveRequest) => {
    setLoading(true);
    setError(null);

    try {
      const created = await leaveService.create(data);
      await load(); // Reload after create
      return created;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Eroare la creare cerere concediu';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [load]);

  const update = useCallback(async (id: string, data: Partial<LeaveRequest>) => {
    setLoading(true);
    setError(null);

    try {
      const updated = await leaveService.update(id, data);
      await load(); // Reload after update
      return updated;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Eroare la actualizare cerere concediu';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [load]);

  const remove = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      await leaveService.delete(id);
      await load(); // Reload after delete
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Eroare la ștergere cerere concediu';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [load]);

  const approve = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const approved = await leaveService.approve(id);
      await load(); // Reload after approve
      return approved;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Eroare la aprobare cerere concediu';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [load]);

  const reject = useCallback(async (id: string, reason?: string) => {
    setLoading(true);
    setError(null);

    try {
      const rejected = await leaveService.reject(id, reason);
      await load(); // Reload after reject
      return rejected;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Eroare la respingere cerere concediu';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [load]);

  return {
    leaves,
    loading,
    error,
    load,
    create,
    update,
    remove,
    approve,
    reject,
  };
};

