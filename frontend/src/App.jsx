import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import "./App.css";
import "./index.css";

import LoginPage from "./components/Login";
import AdminManagerDashboard from "./components/AdminManagerDashboard";
import AdminFarmacieDashboard from "./components/AdminFarmacieDashboard";
import AccountancyDashboard from "./components/AccountancyDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import PontajDashboard from "../pontaj/PontajDashboard";
import PlanificareLunaraDashboard from "../pontaj/PlanificareLunaraDashboard";
import UserGuide from "./components/UserGuide";

function App() {
  return (
    <Router>
      <Routes>
        {/* LOGIN */}
        <Route path="/" element={<LoginPage />} />

        {/* PONTAJ – NEPROTEJAT */}
        <Route path="/pontaj" element={<PontajDashboard />} />
        <Route path="/planificare" element={<PlanificareLunaraDashboard />} />

        {/* RUTE PROTEJATE (necesită login) */}
        <Route element={<ProtectedRoute />}>
          {/* ADMIN MANAGER (SUPERADMIN) */}
          <Route path="/adminmanager" element={<AdminManagerDashboard />} />

          {/* ADMIN FARMACIE */}
          <Route path="/adminfarmacie" element={<AdminFarmacieDashboard />} />

          {/* CONTABILITATE */}
          <Route path="/accountancy" element={<AccountancyDashboard />} />
        </Route>

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
