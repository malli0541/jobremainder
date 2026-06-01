importScripts('https://www.gstatic.com/firebasejs/12.14.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/12.14.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyCPjVWQEaagmio9QgAjNsRzO9-E52rDaGY',
  authDomain: 'job-remainder.firebaseapp.com',
  projectId: 'job-remainder',
  storageBucket: 'job-remainder.firebasestorage.app',
  messagingSenderId: '1042121456519',
  appId: '1:1042121456519:web:0609d25447e14666467122'
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {}
  const data = payload.data || {}
  const title = notification.title || data.title || 'Job Tracker Reminder'
  const options = {
    body: notification.body || data.body || 'You have a reminder.',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: data.tag || data.applicationId || 'job-tracker-reminder',
    data: {
      url: data.url || '/applications'
    }
  }

  self.registration.showNotification(title, options)
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const sameOriginClient = clients.find((client) => new URL(client.url).origin === self.location.origin)
        if (sameOriginClient) {
          sameOriginClient.focus()
          return sameOriginClient.navigate(url)
        }
        return self.clients.openWindow(url)
      })
  )
})
