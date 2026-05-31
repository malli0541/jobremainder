import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'

export default function useUserSettings(user) {
  const [settings, setSettings] = useState(() => {
    try { return JSON.parse(localStorage.getItem('jt_user_settings') || 'null') } catch(e){ return null }
  })

  useEffect(() => {
    let mounted = true
    if (!user) return
    const load = async () => {
      try {
        const ref = doc(db, 'users', user.uid, 'settings', 'prefs')
        const snap = await getDoc(ref)
        if (snap.exists() && mounted) {
          const data = snap.data()
          setSettings(data)
          try { localStorage.setItem('jt_user_settings', JSON.stringify(data)) } catch(e){}
        }
      } catch(e) { console.warn('load settings failed', e) }
    }
    load()
    return () => { mounted = false }
  }, [user])

  const saveSettings = async (next) => {
    const merged = { ...(settings||{}), ...(typeof next === 'function' ? next(settings) : next) }
    setSettings(merged)
    try { localStorage.setItem('jt_user_settings', JSON.stringify(merged)) } catch(e){}
    if (user) {
      try {
        const ref = doc(db, 'users', user.uid, 'settings', 'prefs')
        await setDoc(ref, merged, { merge: true })
      } catch(e) { console.warn('save settings failed', e) }
    }
  }

  return [settings, saveSettings]
}
