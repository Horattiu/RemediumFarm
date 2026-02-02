import { lazy, Suspense } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import './App.css';
import './index.css';

// ✅ Critical components - keep in main bundle (small, used frequently)
import { LoginPage } from './features/auth';
import { ProtectedRoute } from './app/router/ProtectedRoute';
import { PontajDashboard } from './features/timesheet';
import { RouteLoader } from './shared/components/ui/RouteLoader';

// ✅ Lazy load large admin dashboards (used less frequently, very large)
const AdminManagerDashboard = lazy(() => 
  import('./features/admin/manager').then(module => ({ 
    default: module.AdminManagerDashboard 
  }))
);

const AdminFarmacieDashboard = lazy(() => 
  import('./features/admin/farmacie').then(module => ({ 
    default: module.AdminFarmacieDashboard 
  }))
);

const AccountancyDashboard = lazy(() => 
  import('./features/admin/accountancy').then(module => ({ 
    default: module.AccountancyDashboard 
  }))
);

// ✅ Lazy load large timesheet component (used less frequently)
const PlanificareLunaraDashboard = lazy(() => 
  import('./features/timesheet').then(module => ({ 
    default: module.PlanificareLunaraDashboard 
  }))
);

function App() {
  return (
    <Router>
      <Routes>
        {/* LOGIN */}
        <Route path="/" element={<LoginPage />} />

        {/* PONTAJ – NEPROTEJAT */}
        <Route path="/pontaj" element={<PontajDashboard />} />
        <Route 
          path="/planificare" 
          element={
            <Suspense fallback={<RouteLoader message="Se încarcă planificarea..." />}>
              <PlanificareLunaraDashboard />
            </Suspense>
          } 
        />

        {/* RUTE PROTEJATE (necesită login) */}
        <Route element={<ProtectedRoute />}>
          {/* ADMIN MANAGER (SUPERADMIN) */}
          <Route 
            path="/adminmanager" 
            element={
              <Suspense fallback={<RouteLoader message="Se încarcă dashboard-ul admin..." />}>
                <AdminManagerDashboard />
              </Suspense>
            } 
          />

          {/* ADMIN FARMACIE */}
          <Route 
            path="/adminfarmacie" 
            element={
              <Suspense fallback={<RouteLoader message="Se încarcă dashboard-ul farmacie..." />}>
                <AdminFarmacieDashboard />
              </Suspense>
            } 
          />

          {/* CONTABILITATE */}
          <Route 
            path="/accountancy" 
            element={
              <Suspense fallback={<RouteLoader message="Se încarcă dashboard-ul contabilitate..." />}>
                <AccountancyDashboard />
              </Suspense>
            } 
          />
        </Route>

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;


