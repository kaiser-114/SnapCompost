// notifikasi.js — pusat notifikasi dalam aplikasi (satu modul untuk SEMUA halaman). Tidak menyentuh HTML.
// Sumber data = tabel `notifikasi` (ditulis cron). Dibuat SATU kali saat aplikasi dimuat (setelah muatReferensi) lalu dibagikan ke semua halaman:
//   const pusat = buatPusatNotifikasi(api);
//   pusat.langganan((daftar, jumlah) => { /* gambar ulang lonceng + daftar */ });
//   pusat.muat();   // panggil saat: aplikasi dibuka, tab kembali terlihat (visibilitychange), dan pesan dari service worker diterima
//   // Tombol "Lihat":   const { id_wadah } = await pusat.buka(n.id, n.id_wadah);  lalu pindah ke detail wadah
//   // Banner HP ditekan: service worker membuka  ?buka_wadah=<id>&notif=<id>  → const p = bacaParameterNotifikasi(location.search);
//   //                    if (p) { await pusat.buka(p.id_notifikasi, p.id_wadah); /* pindah ke detail wadah */ }
import * as C from './core.js';

export const MAKS_BADGE = 99;
export const teksBadge = n => n <= 0 ? '' : n > MAKS_BADGE ? `${MAKS_BADGE}+` : String(n);

// Parameter URL dari service worker. null = bukan dari notifikasi.
export function bacaParameterNotifikasi(search) {
  const p = new URLSearchParams(search);
  const id_wadah = p.get('buka_wadah');
  return id_wadah ? { id_wadah, id_notifikasi: p.get('notif') } : null;
}

export function buatPusatNotifikasi(api) {
  let daftar = [], urutan = 0;
  const pendengar = new Set();
  const label = n => C.ref().resep.find(r => r.nama === n)?.label_tampilan ?? n ?? '';
  // Data siap render: nama wadah & resep dibaca LIVE dari wadah (ganti nama ikut berubah); `isi` = teks yang disimpan cron.
  const tampil = n => ({ id: n.id, id_wadah: n.id_wadah, jenis: n.jenis, isi: n.isi, waktu: n.dibuat_pada,
    namaWadah: n.wadah?.nama ?? '', resep: label(n.wadah?.nama_resep) });
  const kabari = () => pendengar.forEach(f => f(pusat.daftar(), pusat.jumlah()));

  const pusat = {
    daftar: () => daftar.map(tampil),
    jumlah: () => daftar.length,                      // semua baris = belum dibaca (yang dibaca dihapus)
    langganan(f) { pendengar.add(f); return () => pendengar.delete(f); },
    async muat() {                                     // balapan: hasil muat yang lebih lama tidak boleh menimpa yang lebih baru
      const u = ++urutan, hasil = await api.daftarNotifikasi();
      if (u === urutan) { daftar = hasil; kabari(); }
      return pusat.daftar();
    },
    // Dipakai tombol "Lihat" dan banner HP. Notifikasi dihapus (= dibaca), lalu id_wadah dikembalikan untuk navigasi.
    // Gagal menghapus TIDAK menghalangi user membuka wadah; baris itu muncul lagi di muat() berikutnya.
    async buka(id_notifikasi, id_wadah) {
      if (id_notifikasi) {
        try { await api.hapusNotifikasi(id_notifikasi); daftar = daftar.filter(n => n.id !== id_notifikasi); kabari(); }
        catch (e) { console.error('Gagal menandai notifikasi dibaca:', e); }
      }
      return { id_wadah };
    },
  };
  return pusat;
}
