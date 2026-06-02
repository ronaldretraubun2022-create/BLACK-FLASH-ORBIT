import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import {
  ProtectedRoute,
  PublicOnlyRoute,
} from "./components/auth/ProtectedRoute";
import { ModulePlaceholder } from "./components/pages/ModulePlaceholder";
import {
  Activity,
  Bot,
  FileText,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { Dashboard } from "./pages/Dashboard";
import { AIWorkspace } from "./pages/AIWorkspace";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route index element={<Dashboard />} />
            <Route
              path="ai-workspace"
              element={<AIWorkspace />}
            />
            <Route
              path="security"
              element={
                <ModulePlaceholder
                  description="Pusat kontrol perlindungan aplikasi, validasi akses admin, dan audit keamanan."
                  eyebrow="DEFENSIVE CONTROL"
                  icon={ShieldCheck}
                  title="Security Center"
                />
              }
            />
            <Route
              path="monitoring"
              element={
                <ModulePlaceholder
                  description="Pantau kesehatan layanan, aktivitas operasional, dan kesiapan sistem secara real-time."
                  eyebrow="LIVE TELEMETRY"
                  icon={Activity}
                  title="System Monitoring"
                />
              }
            />
            <Route
              path="reports"
              element={
                <ModulePlaceholder
                  description="Kelola arsip berita, laporan operasional, dan persiapan ekspor dokumen."
                  eyebrow="NEWSROOM ARCHIVE"
                  icon={FileText}
                  title="Reports Archive"
                />
              }
            />
            <Route
              path="settings"
              element={
                <ModulePlaceholder
                  description="Konfigurasi workspace, preferensi operasional, dan integrasi produksi."
                  eyebrow="SYSTEM CONFIGURATION"
                  icon={Settings}
                  title="Settings"
                />
              }
            />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
