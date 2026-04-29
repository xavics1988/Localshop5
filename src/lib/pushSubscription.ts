import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output  = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

export function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager'   in window   &&
    'Notification'  in window
  );
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    if (reg.installing) {
      await new Promise<void>((resolve) => {
        reg.installing!.addEventListener('statechange', function handler() {
          if (this.state === 'activated') {
            this.removeEventListener('statechange', handler);
            resolve();
          }
        });
      });
    }
    return reg;
  } catch (err) {
    console.error('[SW] Registration failed:', err);
    return null;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  return Notification.requestPermission();
}

export async function subscribeToPush(userId: string): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY) {
    console.error('[Push] VITE_VAPID_PUBLIC_KEY no está configurada');
    return false;
  }
  const reg = await registerServiceWorker();
  if (!reg) return false;

  try {
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      console.error('[Push] Suscripción incompleta');
      return false;
    }

    const { error } = await supabase.from('push_subscriptions').upsert(
      { user_id: userId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
      { onConflict: 'user_id,endpoint' }
    );
    if (error) { console.error('[Push] Error guardando suscripción:', error); return false; }

    return true;
  } catch (err) {
    console.error('[Push] Subscribe falló:', err);
    return false;
  }
}

export async function unsubscribeFromPush(userId: string): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration('/');
  if (!reg) return;
  const subscription = await reg.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint);
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export async function showBrowserNotification(title: string, body: string, url?: string): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    if (reg) {
      await reg.showNotification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-96.png',
        tag: 'order-update',
        data: { url },
      });
    } else {
      new Notification(title, { body, icon: '/icon-192.png' });
    }
  } catch {
    // silently fail
  }
}
