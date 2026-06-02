import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { ModulePlaceholder } from "./components/pages/ModulePlaceholder";
import {
  Activity,
  Bot,
  FileText,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { Dashboard } from "./pages/Dashboard";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route
            path="ai-workspace"
            element={
              <ModulePlaceholder
                description="Workspace produksi AI untuk berita otomatis, transkrip audio, dan visual jurnalistik."
                eyebrow="AI OPERATIONS"
                icon={Bot}
                title="AI Workspace"
              />
            }
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
      </Routes>
    </BrowserRouter>
  );
}

export default App;
