import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { getAuthErrorMessage } from '../utils/authErrors'

export default function SignUp() {
  const { signup } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  const [error, setError] = useState(null)

  const validate = (email, password) => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return 'Please enter a valid email address.'
    }
    if (!password || password.length < 6) {
      return 'Password must be at least 6 characters.'
    }
    return null
  }

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    const v = validate(email, password)
    if (v) return setError(v)
    setSubmitting(true)
    try {
      await signup(email, password)
      setSuccess(true)
      setTimeout(() => navigate('/'), 420)
    } catch (err) {
      console.error(err)
      setError(getAuthErrorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-shell flex-1 flex items-center justify-center px-4">
      <div className="particle-field" aria-hidden="true" />
      <motion.div
        className="reveal w-full max-w-md card glass-hover p-8 auth-card"
        initial={{ opacity: 0, y: 32, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="mb-6 flex items-center gap-3">
          <span className="brand-mark">JT</span>
          <div>
            <p className="section-kicker">Start tracking</p>
            <h2 className="section-title">Create account</h2>
          </div>
        </div>
        <motion.form
          onSubmit={submit}
          className="space-y-4"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
        >
          <motion.input variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } }} className="px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-cyan-400 focus:border-transparent w-full" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
          <motion.input variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } }} type="password" className="px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-cyan-400 focus:border-transparent w-full" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
          <motion.button
            variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } }}
            disabled={submitting}
            className={"magnetic w-full glow-button py-3 font-semibold auth-submit " + (submitting ? 'is-loading' : '') + (success ? ' is-success' : '')}
          >
            <span>{success ? 'Account ready' : submitting ? 'Creating account' : 'Sign up'}</span>
          </motion.button>
        </motion.form>
        {error && <div className="mt-3 auth-error">{error}</div>}
        <p className="mt-4 text-sm app-muted">Already have an account? <Link to="/signin" className="premium-link">Sign in</Link></p>
      </motion.div>
    </div>
  )
}
