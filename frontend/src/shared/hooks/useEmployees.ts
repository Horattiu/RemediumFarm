import { useState, useCallback } from 'react';
import { employeeService } from '../services/employeeService';
import type { Employee, EmployeeFormData } from '../types/employee.types';

interface UseEmployeesOptions {
  workplaceId?: string;
  autoLoad?: boolean;
}

export const useEmployees = (options: UseEmployeesOptions = {}) => {
  const { workplaceId, autoLoad = false } = options;
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!autoLoad && !workplaceId) return;

    setLoading(true);
    setError(null);

    try {
      let data: Employee[];
      if (workplaceId) {
        data = await employeeService.getByWorkplace(workplaceId);
      } else {
        data = await employeeService.getAll();
      }
      setEmployees(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Eroare la încărcare angajați';
      setError(errorMessage);
      console.error('Error loading employees:', err);
    } finally {
      setLoading(false);
    }
  }, [workplaceId, autoLoad]);

  const create = useCallback(async (data: EmployeeFormData) => {
    setLoading(true);
    setError(null);

    try {
      const created = await employeeService.create(data);
      await load();
      return created;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Eroare la creare angajat';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [load]);

  const update = useCallback(async (id: string, data: Partial<EmployeeFormData>) => {
    setLoading(true);
    setError(null);

    try {
      const updated = await employeeService.update(id, data);
      await load();
      return updated;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Eroare la actualizare angajat';
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
      await employeeService.delete(id);
      await load();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Eroare la ștergere angajat';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [load]);

  return {
    employees,
    loading,
    error,
    load,
    create,
    update,
    remove,
  };
};


