import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function SignUp() {
  const { signup } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    try {
      await signup(email, password)
      navigate('/')
    } catch (err) {
      console.error(err)
      setError(err.message || 'Signup failed')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 fade-in">
      <div className="w-full max-w-md card p-8">
        <h2 className="text-2xl font-semibold mb-4">Create account</h2>
        <form onSubmit={submit} className="space-y-4">
          <input className="w-full" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
          <input type="password" className="w-full" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
          <button className="w-full bg-green-600 text-white py-2 rounded hover:brightness-95">Sign up</button>
        </form>
        {error && <div className="mt-2 text-red-600">{error}</div>}
        <p className="mt-3 text-sm">Already have an account? <Link to="/signin" className="text-blue-600">Sign in</Link></p>
      </div>
    </div>
  )
}
