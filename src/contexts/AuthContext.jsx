import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { auth, googleProvider } from '../firebase'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult
} from 'firebase/auth'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authInProgress, setAuthInProgress] = useState(false)
  const authInProgressRef = useRef(false)
  const redirectHandledRef = useRef(false)

  useEffect(() => {
    if (!auth) {
      console.warn('Firebase Auth not initialized. Set VITE_FIREBASE_API_KEY in .env')
      setLoading(false)
      return
    }

    // Handle redirect sign-in results (if the app returned from an OAuth redirect)
    ;(async () => {
      if (redirectHandledRef.current) return
      redirectHandledRef.current = true
      try {
        const result = await getRedirectResult(auth)
        if (result && result.user) {
          setUser(result.user)
        }
      } catch (err) {
        // getRedirectResult throws if there is no redirect result or on error
        console.warn('getRedirectResult error:', err)
      }
    })()

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
  const signInWithGoogle = async () => {
    ensureAuth()
    if (authInProgressRef.current) return
    authInProgressRef.current = true
    setAuthInProgress(true)
    try {
      // Use redirect-based sign-in to avoid popup issues caused by Cross-Origin-Opener-Policy
      await signInWithRedirect(auth, googleProvider)
    } catch (err) {
      console.error('signInWithRedirect failed:', err)
      throw err
    } finally {
      // In redirect flow this may not run because of navigation, but keep safe guard
      authInProgressRef.current = false
      setAuthInProgress(false)
    }
  }
  const signout = () => { ensureAuth(); return fbSignOut(auth) }

  return (
    <AuthContext.Provider value={{ user, loading, signup, signin, signout, signInWithGoogle, authInProgress }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
