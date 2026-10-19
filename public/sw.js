// Service worker utama SnapCompost.
//
// Bagian 1:
// Firebase Cloud Messaging untuk background notification
// dan penanganan klik notifikasi.
//
// Bagian 2:
// Offline caching untuk PWA dan Trusted Web Activity.
//
// Catatan keamanan:
// - Semua request cross-origin langsung menggunakan jaringan.
// - Semua endpoint /api/* langsung menggunakan jaringan.
// - Request selain GET tidak diproses oleh cache.
// - URL autentikasi dan notifikasi dinamis tidak dicache.
// - Hanya response same-origin yang berhasil yang boleh dicache.
// - Response opaque, CORS, error, dan partial content tidak dicache.

// ================================================================
// BAGIAN 1: FIREBASE CLOUD MESSAGING
// ================================================================

importScripts(
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js',
);

firebase.initializeApp({
  apiKey: 'AIzaSyA049erIqw5woIx9ZVc52gGIdleL2jYp4s',
  projectId: 'snapcompost-9f79f',
  messagingSenderId: '199743837501',
  appId: '1:199743837501:web:2a72ae4914c688b9bf6154',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload.data ?? {};

  return self.registration.showNotification(
    data.judul || 'SnapCompost',
    {
      body: data.isi || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data,
      tag: data.id_notifikasi || undefined,
    },
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data ?? {};
  const vesselId = data.id_wadah ?? '';
  const notificationId = data.id_notifikasi ?? '';

  const url =
    `/?buka_wadah=${encodeURIComponent(vesselId)}` +
    `&notif=${encodeURIComponent(notificationId)}`;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      if (windows.length > 0) {
        const activeWindow = windows[0];

        await activeWindow.focus();

        activeWindow.postMessage({
          tipe: 'buka_notifikasi',
          id_wadah: vesselId,
          id_notifikasi: notificationId,
        });

        return;
      }

      await self.clients.openWindow(url);
    })(),
  );
});

// ================================================================
// BAGIAN 2: OFFLINE CACHING
// ================================================================

// Naikkan versi ini setiap kali strategi cache atau app shell berubah.
const VERSI_CACHE = 'snapcompost-v2';

const CACHE_PRECACHE = `${VERSI_CACHE}-precache`;
const CACHE_RUNTIME = `${VERSI_CACHE}-runtime`;

// Aset inti aplikasi.
//
// File JavaScript dan CSS hasil build Vite memiliki nama ber-hash,
// sehingga file tersebut dicache ketika pertama kali diminta.
//
// Model ONNX tidak diprecache karena ukurannya besar.
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/data-referensi-snapcompost.json',
];

// Parameter URL yang tidak boleh disimpan ke Cache Storage.
const PARAM_AUTH = [
  'access_token',
  'refresh_token',
  'token_type',
  'expires_in',
  'code',
  'error',
  'error_description',
  'error_code',
  'type',
  'provider_token',

  // Parameter tautan notifikasi bersifat dinamis.
  'buka_wadah',
  'notif',
];

/**
 * Menentukan apakah request harus dilewatkan langsung ke jaringan.
 */
const lewati = (request) => {
  const url = new URL(request.url, self.location.href);

  // Semua request cross-origin langsung ke jaringan.
  //
  // Ini meliputi Supabase, Firebase, Google Fonts, gstatic,
  // FCM, dan seluruh layanan eksternal lainnya.
  if (url.origin !== self.location.origin) {
    return true;
  }

  // Endpoint API dinamis selalu menggunakan jaringan.
  //
  // Endpoint tidak dibaca dari cache, tidak ditulis ke cache,
  // tidak menggunakan stale-while-revalidate, dan tidak memakai
  // fallback offline.
  if (url.pathname.startsWith('/api/')) {
    return true;
  }

  // Jangan cache callback autentikasi atau tautan notifikasi dinamis.
  const parameterKeys = [...url.searchParams.keys()];

  if (parameterKeys.some((key) => PARAM_AUTH.includes(key))) {
    return true;
  }

  // Beberapa alur autentikasi menggunakan hash fragment,
  // misalnya #access_token=...
  if (
    url.hash &&
    PARAM_AUTH.some((parameter) =>
      url.hash.includes(`${parameter}=`)
    )
  ) {
    return true;
  }

  return false;
};

/**
 * Mengambil resource dari jaringan dengan batas waktu.
 */
const fetchDenganTimeout = (request, timeout = 4000) => {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    fetch(request, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then((response) => {
        clearTimeout(timeoutId);
        resolve(response);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
};

/**
 * Memastikan response aman untuk disimpan ke Cache Storage.
 */
const amanDicache = (response, request) => {
  if (!response || !response.ok) {
    return false;
  }

  // Hanya cache response same-origin.
  if (response.type !== 'basic') {
    return false;
  }

  // Jangan cache response partial content.
  if (response.status === 206) {
    return false;
  }

  // Hormati request yang secara eksplisit melarang cache.
  if (request.cache === 'no-store') {
    return false;
  }

  return true;
};

/**
 * Stale-while-revalidate.
 *
 * Mengembalikan cache terlebih dahulu jika tersedia,
 * kemudian memperbarui cache melalui jaringan di background.
 */
const staleWhileRevalidate = async (request) => {
  const runtimeCache = await caches.open(CACHE_RUNTIME);
  const cachedResponse = await runtimeCache.match(request);

  const networkResponsePromise = fetchDenganTimeout(request)
    .then(async (response) => {
      if (amanDicache(response, request)) {
        await runtimeCache.put(request, response.clone());
      }

      return response;
    })
    .catch(() => cachedResponse);

  return cachedResponse || networkResponsePromise;
};

/**
 * Network-first untuk navigasi dan dokumen HTML.
 *
 * Jika jaringan gagal, fungsi mencari response di seluruh
 * Cache Storage, termasuk precache dan runtime cache.
 */
const networkFirst = async (request) => {
  const runtimeCache = await caches.open(CACHE_RUNTIME);

  try {
    const response = await fetchDenganTimeout(request, 5000);

    if (amanDicache(response, request)) {
      await runtimeCache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    // Cari request pada seluruh cache, termasuk precache.
    //
    // ignoreSearch digunakan agar route seperti /?buka=wadah
    // dapat menggunakan app shell "/" ketika offline.
    const cachedRequest = await caches.match(request, {
      ignoreSearch: true,
    });

    if (cachedRequest) {
      return cachedRequest;
    }

    // Fallback terakhir ke app shell yang tersimpan saat install.
    return (
      (await caches.match('/')) ||
      (await caches.match('/index.html')) ||
      Response.error()
    );
  }
};

// ================================================================
// SERVICE WORKER LIFECYCLE
// ================================================================

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const precache = await caches.open(CACHE_PRECACHE);

      // Best effort precaching.
      //
      // Jika satu aset gagal dimuat, instalasi service worker
      // tetap dilanjutkan.
      await Promise.allSettled(
        APP_SHELL.map(async (url) => {
          try {
            await precache.add(
              new Request(url, {
                cache: 'reload',
              }),
            );
          } catch (error) {
            console.warn(
              `[SnapCompost SW] Gagal precache: ${url}`,
              error,
            );
          }
        }),
      );

      // Aktifkan service worker baru tanpa menunggu worker lama dilepas.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheKeys = await caches.keys();

      // Hapus cache SnapCompost versi lama.
      await Promise.all(
        cacheKeys
          .filter((key) => {
            const isSnapCompostCache =
              key.startsWith('snapcompost-');

            const isCurrentCache =
              key === CACHE_PRECACHE ||
              key === CACHE_RUNTIME;

            return isSnapCompostCache && !isCurrentCache;
          })
          .map((key) => caches.delete(key)),
      );

      // Kendalikan halaman yang sudah terbuka.
      await self.clients.claim();
    })(),
  );
});

// ================================================================
// FETCH HANDLER
// ================================================================

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Hanya request GET yang boleh ditangani cache.
  if (request.method !== 'GET') {
    return;
  }

  // Lewati API, autentikasi, notifikasi dinamis,
  // serta semua request cross-origin.
  if (lewati(request)) {
    return;
  }

  const url = new URL(request.url);

  // Lewati protocol selain HTTP dan HTTPS.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // Navigasi HTML memakai network-first.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Aset same-origin memakai stale-while-revalidate.
  //
  // Model ONNX akan dicache saat pertama kali diminta,
  // bukan ketika service worker dipasang.
  event.respondWith(staleWhileRevalidate(request));
});

// ================================================================
// MESSAGE HANDLER
// ================================================================

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});