import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Activity } from "lucide-react";
import {
  PublicOnlyRoute,
  ProtectedRoute,
} from "./components/auth/ProtectedRoute";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { ModulePlaceholder } from "./components/pages/ModulePlaceholder";
import { AIWorkspace } from "./pages/AIWorkspace";
import { AutomationHub } from "./pages/AutomationHub";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import { ModelControl } from "./pages/ModelControl";
import { OSINTWorkspace } from "./pages/OSINTWorkspace";
import { Register } from "./pages/Register";
import { ReportsArchive } from "./pages/ReportsArchive";
import { SecurityCenter } from "./pages/SecurityCenter";
import { Settings } from "./pages/Settings";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route element={<Login />} path="/login" />
          <Route element={<Register />} path="/register" />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route element={<Dashboard />} index />
            <Route element={<AIWorkspace />} path="ai-workspace" />

            <Route
              element={
                <ModulePlaceholder
                  description="Pantau kesehatan layanan, aktivitas operasional, dan kesiapan backend secara real-time."
                  eyebrow="LIVE TELEMETRY"
                  icon={Activity}
                  title="System Monitoring"
                />
              }
              path="monitoring"
            />

            <Route element={<SecurityCenter />} path="security" />
            <Route element={<OSINTWorkspace />} path="osint" />
            <Route element={<AutomationHub />} path="automation" />
            <Route element={<ReportsArchive />} path="reports" />
            <Route element={<ModelControl />} path="models" />

            <Route element={<Settings />} path="settings" />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
