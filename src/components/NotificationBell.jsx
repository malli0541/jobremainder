import React, { useCallback, useEffect, useRef, useState } from 'react'
import BellIcon from './BellIcon'
import { useNotifications } from '../contexts/NotificationsContext'

export default function NotificationBell({ buttonClassName }) {
  const { notifications, permission, requestPermission, remove } = useNotifications()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const panelId = 'notification-panel'

  const resolvedButtonClassName = buttonClassName || (
    permission === 'granted'
      ? 'magnetic glass-button icon-button'
      : 'magnetic glow-button icon-button'
  )

  const close = useCallback(() => setOpen(false), [])

  const toggle = useCallback(() => {
    setOpen(prev => !prev)
  }, [])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        close()
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') close()
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, close])

  const enableNotifications = async () => {
    await requestPermission()
  }

  if (permission === 'unsupported') return null

  const unreadCount = notifications.length
  const panelItems = notifications // Show all notifications, not just first 8

  return (
    <div ref={rootRef} className="notification-bell-root">
      <button
        type="button"
        onClick={toggle}
        className={resolvedButtonClassName}
        aria-label={open ? 'Close notifications' : 'Open notifications'}
        aria-expanded={open}
        aria-controls={panelId}
        title={open ? 'Close notifications' : 'Notifications'}
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="notification-badge" aria-hidden="true">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <div
        id={panelId}
        className={`notification-panel ${open ? 'show' : ''}`}
        role="dialog"
        aria-label="Notifications"
      >
        <div className="notification-panel-header">
          <strong>Notifications {unreadCount > 0 && `(${unreadCount})`}</strong>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {unreadCount > 0 && (
              <button 
                type="button" 
                className="notification-panel-action clear-all"
                onClick={() => {
                  notifications.forEach(n => remove(n.id))
                }}
              >
                Clear all
              </button>
            )}
            {permission !== 'granted' && (
              <button type="button" className="notification-panel-action" onClick={enableNotifications}>
                Enable alerts
              </button>
            )}
          </div>
        </div>

        {panelItems.length === 0 ? (
          <p className="notification-panel-empty">No notifications yet.</p>
        ) : (
          <ul className="notification-panel-list">
            {panelItems.map((item) => (
              <li key={item.id} className="notification-panel-item">
                <div>
                  <div className="notification-panel-title">{item.title}</div>
                  {item.body && <div className="notification-panel-body">{item.body}</div>}
                  {item.time && (
                    <div className="notification-panel-time">
                      {new Date(item.time).toLocaleString()}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="notification-panel-dismiss"
                  aria-label="Dismiss notification"
                  onClick={() => remove(item.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
