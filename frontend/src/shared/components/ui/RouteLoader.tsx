import React from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface RouteLoaderProps {
  message?: string;
}

/**
 * Simple route loading component
 * Minimal fallback for lazy-loaded routes - keeps it lightweight
 */
export const RouteLoader: React.FC<RouteLoaderProps> = ({ 
  message = 'Se încarcă...' 
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <LoadingSpinner size="md" className="mb-2" />
      <p className="text-slate-500 text-xs">{message}</p>
    </div>
  );
};

