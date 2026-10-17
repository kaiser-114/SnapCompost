// FCM di halaman. Service worker TUNGGAL = /sw.js (Jalur A di catatan notifikasi §3).
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, deleteToken, onMessage } from 'firebase/messaging';

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});
export const messaging = getMessaging(app);

export async function daftarkanSW() {
  await navigator.serviceWorker.register('/sw.js');   // didaftarkan SEKALI
  return navigator.serviceWorker.ready;               // tunggu sampai benar-benar aktif

}

// Panggil dari KLIK tombol (Android 13+), bukan otomatis saat dimuat.
export async function aktifkanNotifikasi(api) {
  const izin = await Notification.requestPermission();
  if (izin !== 'granted') return null;
  const reg = await daftarkanSW();
  const token = await getToken(messaging, { vapidKey: import.meta.env.VITE_VAPID_KEY, serviceWorkerRegistration: reg });
  await api.daftarkanPerangkat(token);
  return token;
}

export function pasangOnMessage(pusat) {
  onMessage(messaging, () => pusat.muatAman());            // aplikasi fokus: hanya lonceng
}

export async function lepasNotifikasi(api) {
  if (Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  if (!reg) return;
  const token = await getToken(messaging, { vapidKey: import.meta.env.VITE_VAPID_KEY, serviceWorkerRegistration: reg });
  await api.lepasPerangkat(token);
  await deleteToken(messaging);   // token berikutnya baru, tidak mewarisi akun lama
}
