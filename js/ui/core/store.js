// Data bersama untuk Beranda dan layar Wadah: satu sumber, satu kali muat, banyak penggambar.
// Halaman cukup langganan(render) lalu panggil muatData() kapan data perlu disegarkan.

import { api } from "../../app/bootstrap.js";

export const store = {
  wadah: [],        // baris dari VIEW wadah_status_efektif
  profil: null,
  dimuat: false,    // true setelah daftar wadah berhasil dimuat minimal sekali
  galat: "",        // pesan error muat terakhir (kosong bila sukses)
};

const pendengar = new Set();
let urutan = 0;

export function langganan(f) {
  pendengar.add(f);
  return () => pendengar.delete(f);
}

function kabari() {
  pendengar.forEach((f) => {
    try { f(store); } catch (e) { console.error("Gagal menggambar ulang:", e); }
  });
}

// Tidak pernah melempar. Bila gagal, data lama dipertahankan dan `galat` diisi.
// Balapan: hasil muat yang lebih lama tidak boleh menimpa yang lebih baru.
export async function muatData() {
  const u = ++urutan;
  const [w, p] = await Promise.allSettled([api.daftarWadah(), api.profil()]);
  if (u !== urutan) return;
  if (w.status === "fulfilled") {
    store.wadah = w.value ?? [];
    store.dimuat = true;
    store.galat = "";
  } else {
    console.error("Gagal memuat daftar wadah:", w.reason);
    store.galat = w.reason?.message ?? "Gagal memuat data, coba lagi.";
  }
  if (p.status === "fulfilled") store.profil = p.value;
  else console.error("Gagal memuat profil:", p.reason);
  kabari();
}

