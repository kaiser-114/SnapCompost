// Service worker UTAMA (satu-satunya). Versi SDK harus sama dengan package.json (firebase 10.14.1).
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
              'https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyA049erIqw5woIx9ZVc52gGIdleL2jYp4s', projectId: 'snapcompost-9f79f', messagingSenderId: '199743837501', appId: '1:199743837501:web:2a72ae4914c688b9bf6154',   // config web Firebase (publik); SW tidak bisa baca import.meta.env
});
const messaging = firebase.messaging();

messaging.onBackgroundMessage(p => {
  const d = p.data;
  return self.registration.showNotification(d.judul, { body: d.isi, data: d, tag: d.id_notifikasi });
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const d = e.notification.data;
  const url = `/?buka_wadah=${d.id_wadah}&notif=${d.id_notifikasi}`;
  e.waitUntil((async () => {
    const jendela = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (jendela[0]) {
      await jendela[0].focus();
      jendela[0].postMessage({ tipe: 'buka_notifikasi', id_wadah: d.id_wadah, id_notifikasi: d.id_notifikasi });
    } else await clients.openWindow(url);
  })());
});
