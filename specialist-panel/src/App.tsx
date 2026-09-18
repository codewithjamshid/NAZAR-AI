import { Navigate, Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { CaseViewPage } from "./pages/CaseView";
import { LoginPage } from "./pages/Login";
import { MapPage } from "./pages/MapView";
import { QueuePage } from "./pages/Queue";
import { StatsPage } from "./pages/Stats";
import { QueueProvider } from "./state/queue";
import { SessionProvider, useSession } from "./state/session";

function Protected() {
  const { token } = useSession();
  if (!token) return <Navigate to="/kirish" replace />;
  return (
    <QueueProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<QueuePage />} />
          <Route path="/holat/:caseId" element={<CaseViewPage />} />
          <Route path="/xarita" element={<MapPage />} />
          <Route path="/statistika" element={<StatsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </QueueProvider>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <Routes>
        <Route path="/kirish" element={<LoginPage />} />
        <Route path="/*" element={<Protected />} />
      </Routes>
    </SessionProvider>
  );
}
