import React, { createContext, useContext, useEffect, useState, useRef } from 'react'

const NotificationsContext = createContext()

export function NotificationsProvider({ children }){
  const [notifications, setNotifications] = useState([])
  const timersRef = useRef({})
  const [visibleIds, setVisibleIds] = useState([])

  useEffect(()=>{
    // request permission for browser notifications
    if ('Notification' in window && Notification.permission === 'default'){
      Notification.requestPermission().catch(()=>{})
    }
    return () => {
      // clear timers
      Object.values(timersRef.current).forEach(id => clearTimeout(id))
    }
  }, [])

  const add = (notif) => {
    setNotifications(n => [notif, ...n])
    // show animated toast briefly
    setVisibleIds(v => [notif.id, ...v])
    // auto-hide after 6s
    setTimeout(()=> setVisibleIds(v => v.filter(x=>x!==notif.id)), 6000)
  }

  const schedule = (id, title, body, when) => {
    // when: Date instance
    if (!when || !(when instanceof Date)) return
    const delay = when.getTime() - Date.now()
    if (delay <= 0){
      showNow(title, body)
      add({ id, title, body, time: when.toISOString() })
      return
    }
    const t = setTimeout(()=>{
      showNow(title, body)
      add({ id, title, body, time: when.toISOString() })
      delete timersRef.current[id]
    }, delay)
    // store timer
    timersRef.current[id] = t
  }

  const showNow = (title, body) => {
    // in-app
    add({ id: Date.now().toString(), title, body, time: new Date().toISOString() })
    // browser
    if ('Notification' in window && Notification.permission === 'granted'){
      try { new Notification(title, { body }) } catch(e) { console.warn('Notification failed', e) }
    }
  }

  const remove = (id) => setNotifications(n => n.filter(x=>x.id !== id))

  return (
    <NotificationsContext.Provider value={{ notifications, add, schedule, remove }}>
      {children}
      {/* Toast container */}
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
