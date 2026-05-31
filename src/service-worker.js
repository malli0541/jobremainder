/* Service worker placeholder for offline caching. VitePWA will manage registration. */
self.addEventListener('install', (e) => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  clients.claim()
})

self.addEventListener('fetch', (e) => {
  // Basic network-first strategy can be added here.
})
