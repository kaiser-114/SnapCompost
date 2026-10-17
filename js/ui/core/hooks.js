// Titik sambung ke modul yang belum dikonversi / akan ditulis ulang.
// Modul UI murni (camera, navigation) memanggil hooks.* dan TIDAK meng-import
// layar yang akan dibuang. Layar baru cukup mengisi hook ini saat inisialisasi.

import { showToast } from "./ui.js";

export const hooks = {
  // Dipanggil camera.js setelah foto diambil / dipilih. Nanti diisi alur scan baru
  // (detektor.deteksi(file) -> tampilkan hasil).
  processCapturedPhoto: async (file) => {
    console.warn("hooks.processCapturedPhoto belum diisi", file);
  },
  // Dipanggil scan.js saat "Deteksi sudah benar, lanjut" ditekan. Diisi pages/review.js (Langkah 3).
  lanjutDariDeteksi: (daftarEntri) => {
    console.warn("hooks.lanjutDariDeteksi belum diisi", daftarEntri);
    showToast("Langkah berikutnya (cek kondisi) belum tersedia");
  },
  // Dipanggil review.js setelah kondisi dicek (atau dilewati). Nanti diisi pages/quantity.js (Langkah 4).
  // daftarEntri = [{ nama, nama_sampah, kondisi_tercentang[], confidence, sumber }]
  lanjutDariKondisi: (daftarEntri) => {
    console.warn("hooks.lanjutDariKondisi belum diisi", daftarEntri);
    showToast("Langkah berikutnya (jumlah) belum tersedia");
  },
  // Dipanggil quantity.js setelah semua jumlah dikonfirmasi. Nanti diisi layar alokasi/pilih resep (alokasi.js, §2.1).
  // batchInput = [{ id_entri, nama_sampah, berat_gram, kondisi_tercentang[] }]  (berat sudah gram)
  lanjutDariJumlah: (batchInput) => {
    console.warn("hooks.lanjutDariJumlah belum diisi", batchInput);
    showToast("Langkah berikutnya (pilih wadah / resep) belum tersedia");
  },
  // Dipanggil navigation.js saat layar Wadah / Beranda ditampilkan. Diisi oleh pages/wadah.js dan pages/home.js
  // (memuat ulang data dari server lalu menggambar ulang).
  updateWadahCards: () => {},
  updateHome: () => {},
  // Dipanggil saat kartu wadah diketuk. Nanti diisi layar detail wadah.
  openVessel: (id) => {
    console.warn("hooks.openVessel belum diisi", id);
    showToast("Detail wadah belum tersedia");
  },
};