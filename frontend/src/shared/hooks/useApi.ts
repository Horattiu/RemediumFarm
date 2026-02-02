import { useState, useCallback } from 'react';
import { apiClient } from '@/shared/services/api/client';
import { FetchError } from '@/shared/types/api.types';

interface UseApiOptions {
  onSuccess?: (data: unknown) => void;
  onError?: (error: FetchError) => void;
}

interface UseApiReturn<T> {
  data: T | null;
  loading: boolean;
  error: FetchError | null;
  execute: (...args: Parameters<typeof apiClient.get>) => Promise<void>;
  reset: () => void;
}

/**
 * Generic hook pentru API calls
 */
export function useApi<T = unknown>(options?: UseApiOptions): UseApiReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<FetchError | null>(null);

  const execute = useCallback(async (...args: Parameters<typeof apiClient.get>) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<T>(...args);
      setData(response.data as T);
      options?.onSuccess?.(response.data as T);
    } catch (err) {
      const fetchError = err instanceof FetchError ? err : new FetchError('Unknown error', 500);
      setError(fetchError);
      options?.onError?.(fetchError);
    } finally {
      setLoading(false);
    }
  }, [options]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, execute, reset };
}


