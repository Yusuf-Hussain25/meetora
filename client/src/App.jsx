import { lazy, Suspense } from 'react'
import { Toaster } from 'react-hot-toast'
import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'
import Loader from './components/Loader'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'

// The meeting room (WebRTC, captions) and history load on demand
const Sessions = lazy(() => import('./pages/Sessions'))
const Plans = lazy(() => import('./pages/Plans'))
const MeetingRoom = lazy(() => import('./pages/MeetingRoom'))

const App = () => {
  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'var(--panel-solid)',
            color: 'var(--text)',
            border: '1px solid var(--border-strong)',
            borderRadius: '14px',
            boxShadow: 'var(--shadow-md)',
            fontSize: '14px',
            padding: '10px 14px',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#03140f' } },
          error: { iconTheme: { primary: '#f43f5e', secondary: '#fff' } },
        }}
      />
      <Suspense fallback={<Loader text="Loading" />}>
        <Routes>
          {/* Public Routes. Clerk uses sub-paths for later steps (e.g. /register/verify-email-address) */}
          <Route path='/login/*' element={<Auth mode="login" />} />
          <Route path='/register/*' element={<Auth mode="register" />} />

          {/* Private Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path='/dashboard' element={<Dashboard />} />
              <Route path='/sessions' element={<Sessions />} />
              <Route path='/plans' element={<Plans />} />
              <Route path='/pricing' element={<Navigate to='/plans' replace />} />
            </Route>
            <Route path='/meeting/:meetingId' element={<MeetingRoom />} />
          </Route>

          <Route path='*' element={<Navigate to='/dashboard' replace />} />
        </Routes>
      </Suspense>
    </>
  )
}

export default App
