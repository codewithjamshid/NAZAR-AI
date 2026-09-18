import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell, HomeRoute } from './components/AppShell'
import { AnamnesisScreen } from './screens/Anamnesis'
import { LoginScreen } from './screens/Login'
import { NewCaseScreen } from './screens/NewCase'
import { ResultScreen } from './screens/Result'
import { UploadScreen } from './screens/Upload'
import { startSync } from './offline/sync'
import { useApp } from './state/AppContext'

export function App() {
  const { user } = useApp()

  useEffect(() => {
    if (user) startSync()
  }, [user])

  if (!user) return <LoginScreen />

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomeRoute />} />
        <Route path="new" element={<NewCaseScreen />} />
        <Route path="case/:caseId" element={<ResultScreen />} />
        <Route path="case/:caseId/anamnesis" element={<AnamnesisScreen />} />
        <Route path="case/:caseId/upload" element={<UploadScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
