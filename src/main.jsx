import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles/index.css'
import { AuthProvider } from './contexts/AuthContext'
import { AppProvider } from './contexts/AppContext'
import { NotificationsProvider } from './contexts/NotificationsContext'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(
        registrations
          .filter((registration) => registration.active?.scriptURL.endsWith('/sw.js'))
          .map((registration) => registration.unregister())
      )
      await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    } catch (error) {
      console.warn('Service worker setup failed', error)
    }
  })
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <NotificationsProvider>
            <React.Suspense fallback={null}>
              <App />
            </React.Suspense>
          </NotificationsProvider>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
