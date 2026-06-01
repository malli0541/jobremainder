import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import Dashboard from './pages/Dashboard'
import Applications from './pages/Applications'
import { useAuth } from './contexts/AuthContext'
import useMagneticEffect from './hooks/useMagneticEffect'
import useScrollReveal from './hooks/useScrollReveal'

function Protected({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/signin" replace />
  return children
}

export default function App() {
  useMagneticEffect()
  useScrollReveal()

  return (
    <Routes>
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
  )
}
