import { API_URL } from '@/config/api';
import type { ApiResponse, ApiError, RequestConfig } from '@/shared/types';
import { FetchError } from '@/shared/types/api.types';

/**
 * Get authentication token from localStorage
 */
const getToken = (): string | null => {
  return localStorage.getItem('token');
};

/**
 * Build query string from params
 */
const buildQueryString = (params?: Record<string, string | number | boolean>): string => {
  if (!params || Object.keys(params).length === 0) return '';
  
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    queryParams.append(key, String(value));
  });
  
  return `?${queryParams.toString()}`;
};

/**
 * Handle API response
 */
const handleResponse = async <T>(response: Response): Promise<ApiResponse<T>> => {
  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');
  
  let data: unknown;
  if (isJson) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorData = (data as ApiError) || { error: 'Unknown error' };
    throw new FetchError(
      errorData.error || errorData.message || `HTTP ${response.status}`,
      response.status,
      errorData
    );
  }

  // Backend-ul returnează direct data sau { data, message, ... }
  // Verifică dacă e deja wrapped în format ApiResponse
  if (data && typeof data === 'object' && 'data' in data && !('user' in data) && !('message' in data)) {
    return data as ApiResponse<T>;
  }

  // Dacă nu e wrapped, wrappăm noi (pentru compatibilitate)
  return { data: data as T, success: true };
};

/**
 * Make API request
 */
const makeRequest = async <T>(
  url: string,
  config: RequestConfig = {}
): Promise<ApiResponse<T>> => {
  const token = getToken();
  const queryString = buildQueryString(config.params);
  const fullUrl = `${API_URL}${url}${queryString}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(config.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions: RequestInit = {
    method: config.method || 'GET',
    headers,
    credentials: 'include',
  };

  if (config.data && (config.method === 'POST' || config.method === 'PUT' || config.method === 'PATCH')) {
    fetchOptions.body = JSON.stringify(config.data);
  }

  const response = await fetch(fullUrl, fetchOptions);
  return handleResponse<T>(response);
};

/**
 * API Client implementation
 */
export const apiClient = {
  get: <T>(url: string, config?: Omit<RequestConfig, 'method' | 'data'>) =>
    makeRequest<T>(url, { ...config, method: 'GET' }),

  post: <T>(url: string, data?: unknown, config?: Omit<RequestConfig, 'method'>) =>
    makeRequest<T>(url, { ...config, method: 'POST', data }),

  put: <T>(url: string, data?: unknown, config?: Omit<RequestConfig, 'method'>) =>
    makeRequest<T>(url, { ...config, method: 'PUT', data }),

  patch: <T>(url: string, data?: unknown, config?: Omit<RequestConfig, 'method'>) =>
    makeRequest<T>(url, { ...config, method: 'PATCH', data }),

  delete: <T>(url: string, config?: Omit<RequestConfig, 'method' | 'data'>) =>
    makeRequest<T>(url, { ...config, method: 'DELETE' }),
};

/**
 * Legacy apiFetch function (pentru compatibilitate temporară)
 * @deprecated Use apiClient instead
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const fullUrl = `${API_URL}${url}`;

  return fetch(fullUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    credentials: 'include',
  });
}

export default apiClient;

