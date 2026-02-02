import { useState, useCallback } from 'react';
import { workplaceService } from '../services/workplaceService';
import type { Workplace, WorkplaceFormData } from '../types/workplace.types';

interface UseWorkplacesOptions {
  autoLoad?: boolean;
}

export const useWorkplaces = (options: UseWorkplacesOptions = {}) => {
  const { autoLoad = false } = options;
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!autoLoad) return;

    setLoading(true);
    setError(null);

    try {
      const data = await workplaceService.getAll();
      setWorkplaces(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Eroare la încărcare locuri de muncă';
      setError(errorMessage);
      console.error('Error loading workplaces:', err);
    } finally {
      setLoading(false);
    }
  }, [autoLoad]);

  const create = useCallback(async (data: WorkplaceFormData) => {
    setLoading(true);
    setError(null);

    try {
      const created = await workplaceService.create(data);
      await load();
      return created;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Eroare la creare loc de muncă';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [load]);

  const update = useCallback(async (id: string, data: Partial<WorkplaceFormData>) => {
    setLoading(true);
    setError(null);

    try {
      const updated = await workplaceService.update(id, data);
      await load();
      return updated;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Eroare la actualizare loc de muncă';
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
      await workplaceService.delete(id);
      await load();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Eroare la ștergere loc de muncă';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [load]);

  return {
    workplaces,
    loading,
    error,
    load,
    create,
    update,
    remove,
  };
};


