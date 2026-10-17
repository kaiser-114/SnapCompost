// js/logic/kondisi.js — pembantu Langkah 3 (Cek Kondisi + Perlakuan). Murni, tanpa DOM.
// Semua aturan (§3, §4) tetap di core.js; file ini hanya menyusun data untuk layar dan hasil centang.
import { daftarKondisiUntukLabel, perlakuan, ref } from './core.js';

// §4 di langkah ini belum ada resep terpilih → perlakuan default (level atas).
// override_per_resep (kulit_bawang di kompos_kering) baru dipakai setelah resep dipilih.
function perlakuanLangkah3(nama) {
  const p = perlakuan(nama);
  return p.instruksi ? { instruksi: p.instruksi, wajib: !!p.wajib } : null;
}

// daftarEntri = keluaran sesi.deteksiSudahBenar(): [{ nama, confidence, sumber }]
export function bentukLangkahKondisi(daftarEntri) {
  return daftarEntri.map(e => ({
    nama: e.nama,
    label_tampilan: ref().peta.get(e.nama)?.label_tampilan ?? e.nama,
    kondisi: daftarKondisiUntukLabel(e.nama),   // tiap item: { id, label_tampilan, ... }
    perlakuan: perlakuanLangkah3(e.nama),       // { instruksi, wajib } atau null
  }));
}

// Langkah 3 dilewati bila tidak ada satu pun kondisi maupun perlakuan.
export const perluLayarKondisi = langkah => langkah.some(b => b.kondisi.length > 0 || b.perlakuan);

// tercentang = { [nama]: Iterable<id_kondisi> } → entri bentuk §2 untuk langkah 4 dan §2.1.
// id yang bukan milik label itu dibuang (guard terhadap state basi).
export function terapkanKondisi(daftarEntri, tercentang) {
  return daftarEntri.map(e => {
    const boleh = new Set(daftarKondisiUntukLabel(e.nama).map(k => k.id));
    return { ...e, nama_sampah: e.nama, kondisi_tercentang: [...(tercentang[e.nama] ?? [])].filter(id => boleh.has(id)) };
  });
}