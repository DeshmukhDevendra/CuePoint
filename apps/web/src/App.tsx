import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/stores/auth'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'
import { RoomsPage } from '@/pages/RoomsPage'
import { ControllerPage } from '@/pages/ControllerPage'
import { ViewerPage } from '@/pages/ViewerPage'
import { AgendaPage } from '@/pages/AgendaPage'
import { ModeratorPage } from '@/pages/ModeratorPage'
import { OperatorPage } from '@/pages/OperatorPage'
import { SubmitQuestionPage } from '@/pages/SubmitQuestionPage'
import { OutputLinkViewerPage } from '@/pages/OutputLinkViewerPage'
import { OutputEditorPage } from '@/pages/OutputEditorPage'
import { LogsPage } from '@/pages/LogsPage'
import { RoomSettingsPage } from '@/pages/RoomSettingsPage'
import { TeamsPage } from '@/pages/TeamsPage'
import { TeamDetailPage } from '@/pages/TeamDetailPage'
import { AcceptInvitePage } from '@/pages/AcceptInvitePage'
import { AnalyticsPage } from '@/pages/AnalyticsPage'

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { me, loaded } = useAuth()
  if (!loaded) return null
  if (!me) return <Navigate to="/login" replace />
  return children
}

export function App() {
  const { fetchMe, loaded } = useAuth()

  useEffect(() => {
    if (!loaded) void fetchMe()
  }, [loaded, fetchMe])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* Viewer is public — accessible without auth */}
      <Route path="/o/:shortCode" element={<OutputLinkViewerPage />} />
      <Route path="/out/:signature" element={<OutputLinkViewerPage />} />
      <Route path="/rooms/:roomId/viewer" element={<ViewerPage />} />
      <Route path="/rooms/:roomId/agenda" element={<AgendaPage />} />
      <Route path="/rooms/:roomId/moderator" element={<ModeratorPage />} />
      <Route path="/rooms/:roomId/operator" element={<OperatorPage />} />
      <Route path="/rooms/:roomId/submit" element={<SubmitQuestionPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <RoomsPage />
          </ProtectedRoute>
        }
      />
      <Route path="/rooms/:roomId/outputs/:outputId/edit" element={<OutputEditorPage />} />
      <Route path="/rooms/:roomId/logs" element={<LogsPage />} />
      <Route path="/rooms/:roomId/analytics" element={<AnalyticsPage />} />
      <Route path="/rooms/:roomId/settings" element={<RoomSettingsPage />} />
      <Route
        path="/teams"
        element={
          <ProtectedRoute>
            <TeamsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teams/:teamId"
        element={
          <ProtectedRoute>
            <TeamDetailPage />
          </ProtectedRoute>
        }
      />
      {/* Controller may be used logged-in (owner) or as a guest with a saved controller token */}
      <Route path="/rooms/:roomId" element={<ControllerPage />} />

      <Route path="/accept-invite" element={<AcceptInvitePage />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
