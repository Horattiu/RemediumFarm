/**
 * Base entity interface - toate entitățile au aceste câmpuri
 */
export interface BaseEntity {
  _id: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * User roles în sistem
 */
export type UserRole = 
  | 'superadmin'    // Super administrator
  | 'admin'         // Admin farmacie
  | 'accountancy'   // Contabilitate
  | 'employee';     // Angajat

/**
 * Status pentru cereri de concediu
 */
export type LeaveStatus = 
  | 'pending'       // În așteptare
  | 'approved'      // Aprobat
  | 'rejected';      // Respins

/**
 * Status pentru pontaj
 */
export type TimesheetStatus = 
  | 'necompletat'   // Necompletat
  | 'prezent'       // Prezent
  | 'concediu'      // Concediu
  | 'liber'         // Liber
  | 'medical'       // Medical
  | 'garda';        // Garda

/**
 * Tipuri de concediu
 */
export type LeaveType = 
  | 'concediu'      // Concediu de odihnă
  | 'medical'       // Concediu medical
  | 'neplatit'      // Concediu neplătit
  | 'maternitate'   // Concediu de maternitate
  | 'paternitate';  // Concediu de paternitate

/**
 * Luni ale anului (pentru planificare)
 */
export type Month = 
  | '01' | '02' | '03' | '04' | '05' | '06'
  | '07' | '08' | '09' | '10' | '11' | '12';

/**
 * Format pentru luna selectată (YYYY-MM)
 */
export type MonthFormat = `${number}-${Month}`;

/**
 * Generic API Response wrapper
 */
export interface ApiResponse<T = unknown> {
  data?: T;
  message?: string;
  success?: boolean;
  error?: string;
}

/**
 * Generic API Error
 */
export interface ApiError {
  error: string;
  message?: string;
  statusCode?: number;
  details?: Record<string, unknown>;
}


