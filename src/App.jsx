import React from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import Dashboard from './pages/Dashboard'
import Applications from './pages/Applications'
import { useAuth } from './contexts/AuthContext'
import useMagneticEffect from './hooks/useMagneticEffect'
import useScrollReveal from './hooks/useScrollReveal'
import Loader from './components/Loader'
import AppFooter from './components/AppFooter'

function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="particle-field" aria-hidden="true" />
        <div className="loading-logo">JT</div>
        <div className="loading-line"><span /></div>
        <Loader className="text-cyan-200" />
      </div>
    )
  }
  if (!user) return <Navigate to="/signin" replace />
  return children
}

export default function App() {
  const location = useLocation()
  useMagneticEffect()
  useScrollReveal()

  return (
    <div className="route-frame flex flex-col min-h-screen">
      <div className="flex-1 flex flex-col min-h-0">
        <Routes location={location}>
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route
            path="/"
            element={
              <Protected>
                <Dashboard />
              </Protected>
            }
          />
          <Route
            path="/applications"
            element={
              <Protected>
                <Applications />
              </Protected>
            }
          />
        </Routes>
      </div>
      <AppFooter />
    </div>
  )
}
