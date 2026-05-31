import React, { createContext, useContext, useEffect, useState } from 'react'
import { auth } from '../firebase'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged
} from 'firebase/auth'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!auth) {
      console.warn('Firebase Auth not initialized. Set VITE_FIREBASE_API_KEY in .env')
      setLoading(false)
      return
    }

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return unsub
  }, [])

  const ensureAuth = () => {
    if (!auth) throw new Error('Firebase Auth is not initialized. Add VITE_FIREBASE_API_KEY to .env')
  }

  const signup = (email, password) => { ensureAuth(); return createUserWithEmailAndPassword(auth, email, password) }
  const signin = (email, password) => { ensureAuth(); return signInWithEmailAndPassword(auth, email, password) }
  const signout = () => { ensureAuth(); return fbSignOut(auth) }

  return (
    <AuthContext.Provider value={{ user, loading, signup, signin, signout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
