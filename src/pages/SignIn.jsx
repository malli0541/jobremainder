import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { getAuthErrorMessage } from '../utils/authErrors'

export default function SignIn() {
  const { signin, resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [message, setMessage] = useState(null)
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
    setMessage(null)
    const v = validate(email, password)
    if (v) return setError(v)
    setSubmitting(true)
    try {
      await signin(email, password)
      setSuccess(true)
      setTimeout(() => navigate('/'), 420)
    } catch (err) {
      console.error(err)
      setError(getAuthErrorMessage(err))
      setSubmitting(false)
    }
  }

  const forgotPassword = async () => {
    setError(null)
    setMessage(null)
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return setError('Enter your email first, then click Forgot password.')
    }
    setResetting(true)
    try {
      await resetPassword(email)
      setMessage('Password reset email sent. Please check your inbox.')
    } catch (err) {
      console.error(err)
      setError(getAuthErrorMessage(err))
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="login-orb-shell flex-1 flex items-center justify-center px-4">
      <div className="login-orb orb-left" aria-hidden="true" />
      <div className="login-orb orb-right" aria-hidden="true" />
      <div className="login-orb orb-bottom" aria-hidden="true" />
      <div className="login-orb-glow" aria-hidden="true" />
      <motion.div
        className="login-orb-card"
        initial={{ opacity: 0, y: 34, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1>LOGIN</h1>
        <motion.form
          onSubmit={submit}
          className="login-orb-form"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
        >
          <motion.label variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } }}>
            <span>Email</span>
            <input placeholder="" value={email} onChange={e=>setEmail(e.target.value)} />
          </motion.label>
          <motion.label variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } }}>
            <span>Password</span>
            <input type="password" placeholder="" value={password} onChange={e=>setPassword(e.target.value)} />
          </motion.label>
          <motion.button
            variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } }}
            disabled={submitting}
            className={"magnetic auth-submit login-orb-submit " + (submitting ? 'is-loading' : '') + (success ? ' is-success' : '')}
          >
            <span>{success ? 'Signed in' : submitting ? 'Signing in' : 'Sign in'}</span>
          </motion.button>
        </motion.form>
        <div className="login-orb-links">
          <button type="button" onClick={forgotPassword} disabled={resetting}>
            {resetting ? 'Sending...' : 'Forgot password?'}
          </button>
          <Link to="/signup">Sign up</Link>
        </div>
        {error && <div className="auth-error login-auth-message">{error}</div>}
        {message && <div className="auth-success login-auth-message">{message}</div>}
      </motion.div>
    </div>
  )
}
