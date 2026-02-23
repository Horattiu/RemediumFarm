import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { getUserFromStorage } from '@/features/auth/utils/auth.utils';
import { AnnouncementModal } from '@/shared/components/AnnouncementModal';
import { useSessionTimeout } from '@/features/auth/hooks/useSessionTimeout';

export const ProtectedRoute: React.FC = () => {
  const user = getUserFromStorage();

  // Activează timeout-ul de sesiune pentru utilizatorii logați
  useSessionTimeout();

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <Outlet />
      <AnnouncementModal />
    </>
  );
};


