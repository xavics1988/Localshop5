// Service Worker — LocalShop Web Push Notifications
// Debe estar en la raíz del scope (/public) para interceptar todos los push events.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// ── Push Event ────────────────────────────────────────────────────────────────
// Se dispara cuando el servidor Push envía un mensaje a esta suscripción.
// Funciona aunque la pestaña esté cerrada (mientras el navegador corra).
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: '¡Nueva venta!', body: event.data.text() };
  }

  const title = data.title || '¡Nueva venta!';
  const options = {
    body:               data.body  || 'Tienes un nuevo pedido.',
    icon:               data.icon  || '/icon-192.png',
    badge:              data.badge || '/icon-96.png',
    data:               data.data  || {},
    vibrate:            [200, 100, 200],
    requireInteraction: false,
    tag:                'new-order',
    renotify:           true,
    actions: [
      { action: 'view',    title: 'Ver pedido' },
      { action: 'dismiss', title: 'Cerrar'     },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// ── pushsubscriptionchange ────────────────────────────────────────────────────
// El servicio Push invalida la suscripción (raro, pero importante manejarlo).
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: event.oldSubscription?.options?.applicationServerKey,
    }).then((newSubscription) =>
      clients.matchAll({ type: 'window' }).then((clientList) => {
        clientList.forEach((client) =>
          client.postMessage({
            type:         'PUSH_SUBSCRIPTION_CHANGED',
            subscription: newSubscription.toJSON(),
          })
        );
      })
    )
  );
});
