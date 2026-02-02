import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { getUserFromStorage } from '@/features/auth/utils/auth.utils';

export const ProtectedRoute: React.FC = () => {
  const user = getUserFromStorage();

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};


