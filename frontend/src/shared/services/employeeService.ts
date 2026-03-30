import { apiClient } from './api/client';
import type { Employee, EmployeeFormData } from '../types/employee.types';

export interface DeleteEmployeeResponse {
  message?: string;
  deleted?: Employee;
  leavesDeleted?: number;
  timesheetsDeleted?: number;
}

export const employeeService = {
  /**
   * Get all employees
   */
  async getAll(): Promise<Employee[]> {
    const response = await apiClient.get<Employee[]>('/api/users/employees');
    return (response.data as Employee[]) || [];
  },

  /**
   * Get employees by workplace
   */
  async getByWorkplace(workplaceId: string): Promise<Employee[]> {
    const response = await apiClient.get<Employee[]>(`/api/users/by-workplace/${workplaceId}`);
    return (response.data as Employee[]) || [];
  },

  /**
   * Get employees by IDs
   */
  async getByIds(ids: string[]): Promise<Employee[]> {
    const response = await apiClient.post<Employee[]>('/api/users/by-ids', { ids });
    return (response.data as Employee[]) || [];
  },

  /**
   * Create employee
   */
  async create(data: EmployeeFormData): Promise<Employee> {
    const response = await apiClient.post<Employee>('/api/users', data);
    return response.data as Employee;
  },

  /**
   * Update employee
   */
  async update(id: string, data: Partial<EmployeeFormData>): Promise<Employee> {
    const response = await apiClient.put<Employee>(`/api/users/${id}`, data);
    return response.data as Employee;
  },

  /**
   * Delete employee
   */
  async delete(id: string): Promise<DeleteEmployeeResponse> {
    const response = await apiClient.delete<DeleteEmployeeResponse>(`/api/users/${id}`);
    return (response.data as DeleteEmployeeResponse) || {};
  },
};

