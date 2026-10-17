// js/app/push-sambung.js — FILE BARU. Menyambungkan push FCM (firebase.js) ke lonceng (ui/components/notification-center.js).
// Tidak mengubah file lain. Dipanggil SEKALI dari main.js setelah boot (satu baris, lihat catatan di bawah kode).
import { pusat } from '../ui/components/notification-center.js';
import { bacaParameterNotifikasi } from '../logic/notifikasi.js';
import { showToast } from '../ui/core/ui.js';

const ID_TOMBOL = 'aktifkan-notifikasi';   // OPSIONAL: tombol di HTML. Tanpa tombol, izin notifikasi tidak bisa diminta (Android 13+ wajib dari klik).

export async function sambungkanPush(api) {
  // 1. Lonceng membaca tabel `notifikasi`; "Lihat" menghapus barisnya (= dibaca) lalu membuka detail wadah.
  await pusat.init({ ambil: () => api.daftarNotifikasi(), hapus: id => api.hapusNotifikasi(id) });

  // 2. Segarkan lonceng saat tab/aplikasi kembali terlihat (cron bisa menambah baris saat aplikasi di latar belakang).
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pusat.muatAman(); });

  // 3. Banner ditekan saat aplikasi sudah terbuka: sw.js mengirim pesan 'buka_notifikasi'.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.tipe !== 'buka_notifikasi') return;
      pusat.buka(e.data.id_notifikasi, e.data.id_wadah).catch(err => console.error('Gagal membuka wadah dari notifikasi:', err));
    });
  }

  // 4. Banner ditekan saat aplikasi tertutup: sw.js membuka /?buka_wadah=<id>&notif=<id>.
  const p = bacaParameterNotifikasi(location.search);
  if (p) {
    history.replaceState(null, '', location.pathname);   // refresh tidak membuka wadah yang sama lagi
    pusat.buka(p.id_notifikasi, p.id_wadah).catch(err => console.error('Gagal membuka wadah dari URL:', err));
  }

  // 5. FCM. Dimuat dinamis: bila browser/WebView tidak mendukung, hanya push yang mati; lonceng di atas tetap jalan.
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
  let fb;
  try {
    fb = await import('./firebase.js');
    fb.pasangOnMessage(pusat);   // aplikasi fokus: hanya lonceng yang diperbarui
  } catch (e) { console.warn('Push tidak didukung/gagal dimuat:', e); return; }

  const tombol = document.getElementById(ID_TOMBOL);

  // Izin sudah diberikan: daftarkan ulang token tanpa dialog. Penting setelah login akun lain di HP yang sama
  // (daftarkan_perangkat memindahkan kepemilikan token) dan saat token diperbarui FCM.
  if (Notification.permission === 'granted') {
    if (tombol) tombol.hidden = true;
    fb.aktifkanNotifikasi(api).catch(e => console.warn('Daftar ulang token gagal:', e));
    return;
  }

  if (!tombol) return;
  tombol.hidden = false;
  tombol.addEventListener('click', async () => {
    if (Notification.permission === 'denied') {
      showToast('Izin notifikasi diblokir. Aktifkan lewat pengaturan aplikasi/browser.');
      return;
    }
    tombol.disabled = true;
    try {
      const token = await fb.aktifkanNotifikasi(api);   // dari KLIK: aman untuk Android 13+
      if (token) { tombol.hidden = true; showToast('Notifikasi diaktifkan.'); }
      else showToast('Izin notifikasi tidak diberikan.');
    } catch (e) {
      console.error('Aktifkan notifikasi gagal:', e);
      showToast('Gagal mengaktifkan notifikasi, coba lagi.');
    } finally { tombol.disabled = false; }
  });
}

/* Satu baris yang ditambahkan di main.js, tepat SETELAH blok `try { await b.boot(); } catch (e) { catat("Boot", e); }`:

  import("./push-sambung.js").then(m => m.sambungkanPush(b.api)).catch(e => console.warn("Push gagal disambung:", e));

   Satu elemen HTML (opsional, taruh di halaman Profil atau dekat lonceng):

  <button id="aktifkan-notifikasi" type="button" hidden>Aktifkan notifikasi</button>
*/
