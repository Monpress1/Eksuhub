console.log("SW.JS is alive!");

const CACHE_NAME = 'eksuhub-cache-v2'; // Incremented version to force update

const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// --- INSTALL EVENT ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// --- ACTIVATE EVENT ---
self.addEventListener('activate', (event) => {
  // Clear old caches
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// --- FETCH EVENT (Network-First) ---
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

/**
 * PUSH NOTIFICATION LOGIC
 */

// Listen for incoming push messages
self.addEventListener('push', (event) => {
  let data = { 
    title: 'EKSUHUB', 
    body: 'New notification!', 
    url: '/',
    icon: '/icons/icon-192x192.png', // Default fallback
    badge: '/icons/icon-192x192.png' // Default fallback
  };

  if (event.data) {
    try {
      // This is where we catch the JSON sent from your Edge Function
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    // DYNAMIC ICONS: This uses the .jpg URL from your Edge Function
    icon: data.icon || '/icons/icon-192x192.png', 
    badge: data.badge || '/icons/icon-192x192.png',
    vibrate: [100, 50, 100],
    data: {
      // Ensure the URL is passed through so clicking works
      url: data.data?.url || data.url || '/'
    },
    // Optional: grouping notifications
    tag: 'eksuhub-notification'
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Extract the URL we sent in the data object
  const targetUrl = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If the app is already open, just focus it
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // If not open, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
