import React from 'react'
import { Toaster } from 'react-hot-toast'
import { Navigate, Route, Routes } from 'react-router-dom'
import Auth from './pages/Auth'
import ProtectedRoute from './components/ProtectedRoute'
import Protectedlayout from './components/Protectedlayout'
import Dashboard from './pages/Dashboard'
import Sessions from './pages/Sessions'
import Pricing from './pages/Pricing'
import MeetingRoom from './pages/MeetingRoom'

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
      <Routes>
        {/* Public Routes */}
        {/* Clerk uses sub-paths for later steps (e.g. /register/verify-email-address) */}
        <Route path='/login/*' element={ <Auth mode="login"/>}/>
        <Route path='/register/*' element={ <Auth mode="register"/>}/>

        {/* Private Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Protectedlayout />}>
            <Route path='/dashboard' element={ <Dashboard /> }/>
            <Route path='/sessions' element={ <Sessions /> }/>
            <Route path='/pricing' element={ <Pricing /> }/>
          </Route>
          <Route path='/meeting/:meetingId' element={ <MeetingRoom /> }/>
        </Route>

        {/* other Routes */}
      <Route path='*' element={ <Navigate to='/dashboard' replace/> }/>
      </Routes>
    </>
  )
}

export default App