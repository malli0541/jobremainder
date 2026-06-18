import React from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import Dashboard from './pages/Dashboard'
import Applications from './pages/Applications'
import { useAuth } from './contexts/AuthContext'
import useMagneticEffect from './hooks/useMagneticEffect'
import useScrollReveal from './hooks/useScrollReveal'
import Loader from './components/Loader'

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
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        className="route-frame"
        initial={{ opacity: 0, x: 32, scale: 1.015, filter: 'blur(12px)' }}
        animate={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, x: -28, scale: 0.975, filter: 'blur(10px)' }}
        transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
      >
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
      </motion.div>
    </AnimatePresence>
  )
}
