import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import { getRedirectPath } from '../utils/auth.utils';
import type { LoginRequest } from '../types/auth.types';

export const useLogin = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (credentials: LoginRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await login(credentials.name, credentials.password);
      
      // Navigate based on role
      const redirectPath = getRedirectPath(response.user.role);
      navigate(redirectPath, { replace: true, state: { user: response.user } });
      
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Autentificare eșuată';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    handleLogin,
    isLoading,
    error,
  };
};


