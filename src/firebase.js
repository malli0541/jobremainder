import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

let app = null
let auth = null
let db = null
let storage = null
let messaging = null

if (!firebaseConfig.apiKey) {
  console.warn('Firebase API key not found. Set VITE_FIREBASE_API_KEY in your .env file. Firebase will not be initialized.')
} else {
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true
  })
  storage = getStorage(app)
  try {
    messaging = typeof window !== 'undefined' ? getMessaging(app) : null
  } catch (e) {
    console.warn('Firebase Messaging is not supported in this browser.', e)
  }
}

export { auth, db, storage, messaging }

export async function requestFcmToken() {
  if (!messaging) return null
  if (!import.meta.env.VITE_FIREBASE_VAPID_KEY) {
    console.warn('FCM VAPID key missing. Set VITE_FIREBASE_VAPID_KEY in your .env file.')
    return null
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration
    })
    return token
  } catch (e) {
    console.warn('FCM token error', e)
    return null
  }
}

export function listenForForegroundMessages(handler) {
  if (!messaging) return () => {}
  return onMessage(messaging, handler)
}
