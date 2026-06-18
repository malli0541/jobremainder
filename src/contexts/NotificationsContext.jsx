import React, { createContext, useContext, useCallback, useEffect, useState, useRef } from 'react'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db, listenForForegroundMessages, requestFcmToken } from '../firebase'
import { useAuth } from './AuthContext'

const NotificationsContext = createContext()
const MAX_TIMEOUT = 2147483647

export function NotificationsProvider({ children }){
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const timersRef = useRef({})
  const scheduleMetaRef = useRef({})
  const [visibleIds, setVisibleIds] = useState([])
  const [permission, setPermission] = useState(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
    return Notification.permission
  })

  useEffect(()=>{
    return () => {
      Object.values(timersRef.current).forEach(id => clearTimeout(id))
    }
  }, [])

  const savePushToken = useCallback(async () => {
    if (!user || !db || !('serviceWorker' in navigator)) return null

    const token = await requestFcmToken()
    if (!token) return null

    const tokenId = encodeURIComponent(token)
    await setDoc(doc(db, 'users', user.uid, 'notificationTokens', tokenId), {
      token,
      userId: user.uid,
      platform: navigator.userAgent,
      updatedAt: serverTimestamp()
    }, { merge: true })

    return token
  }, [user])

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      setPermission('unsupported')
      return 'unsupported'
    }
    if (Notification.permission !== 'default') {
      setPermission(Notification.permission)
      if (Notification.permission === 'granted') await savePushToken()
      return Notification.permission
    }
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result === 'granted') await savePushToken()
      return result
    } catch (e) {
      setPermission(Notification.permission)
      return Notification.permission
    }
  }, [savePushToken])

  useEffect(() => {
    if (permission === 'granted') {
      savePushToken().catch((error) => console.warn('Unable to save push token', error))
    }
  }, [permission, savePushToken])

  const add = useCallback((notif) => {
    setNotifications(n => [notif, ...n.filter(x => x.id !== notif.id)])
    setVisibleIds(v => [notif.id, ...v.filter(x => x !== notif.id)])
    setTimeout(()=> setVisibleIds(v => v.filter(x=>x!==notif.id)), 6000)
  }, [])

  const showNow = useCallback((title, body, id = Date.now().toString(), when = new Date()) => {
    add({ id, title, body, time: when.toISOString() })

    if ('Notification' in window && Notification.permission === 'granted'){
      try {
        const notif = new Notification(title, {
          body,
          tag: id,
          renotify: true
        })
        notif.onclick = () => window.focus()
      } catch(e) {
        console.warn('Notification failed', e)
      }
    }
  }, [add])

  useEffect(() => {
    const unsubscribe = listenForForegroundMessages((payload) => {
      const notification = payload.notification || {}
      const data = payload.data || {}
      showNow(
        notification.title || data.title || 'Job Remainder Reminder',
        notification.body || data.body || 'You have a reminder.',
        data.tag || data.applicationId || Date.now().toString()
      )
    })

    return unsubscribe
  }, [showNow])

  const cancel = useCallback((id) => {
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id])
      delete timersRef.current[id]
    }
    delete scheduleMetaRef.current[id]
  }, [])

  const schedule = useCallback((id, title, body, when, options = {}) => {
    if (!id || !when || !(when instanceof Date) || Number.isNaN(when.getTime())) return false

    const signature = `${when.getTime()}|${title}|${body}`
    if (scheduleMetaRef.current[id] === signature) return true

    cancel(id)
    scheduleMetaRef.current[id] = signature

    const delay = when.getTime() - Date.now()
    if (delay <= 0){
      if (options.skipPast) {
        delete scheduleMetaRef.current[id]
        return false
      }
      showNow(title, body, id, when)
      return true
    }

    const run = () => {
      const remaining = when.getTime() - Date.now()
      if (remaining > MAX_TIMEOUT) {
        timersRef.current[id] = setTimeout(run, MAX_TIMEOUT)
        return
      }
      showNow(title, body, id, when)
      delete timersRef.current[id]
      delete scheduleMetaRef.current[id]
    }

    timersRef.current[id] = setTimeout(run, Math.min(delay, MAX_TIMEOUT))
    return true
  }, [cancel, showNow])

  const remove = useCallback((id) => setNotifications(n => n.filter(x=>x.id !== id)), [])

  return (
    <NotificationsContext.Provider value={{ notifications, add, notifyNow: showNow, schedule, cancel, remove, permission, requestPermission }}>
      {children}
      <div className="toasts" aria-live="polite">
        {notifications.slice(0,5).map(n => (
          <div key={n.id} className={"toast " + (visibleIds.includes(n.id) ? 'show' : 'hide') }>
            <div className="font-semibold">{n.title}</div>
            {n.body && <div className="text-sm text-gray-600 dark:text-gray-300">{n.body}</div>}
            <div className="text-xs text-gray-400 mt-1">{n.time ? new Date(n.time).toLocaleString() : ''}</div>
          </div>
        ))}
      </div>
    </NotificationsContext.Provider>
  )
}

export const useNotifications = () => useContext(NotificationsContext)
