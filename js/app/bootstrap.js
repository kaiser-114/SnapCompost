// Urutan boot: referensi → api → pusat notifikasi → (detektor di latar belakang) → render UI.
// Login Supabase Auth dilakukan di main.js SEBELUM modul ini dimuat (klien ada di supabase.js supaya layar login tidak menunggu onnxruntime).
import * as ort from 'onnxruntime-web';
import * as C from '../logic/core.js';
import { buatApi } from '../logic/api.js';
import { buatPusatNotifikasi } from '../logic/notifikasi.js';
import { buatDetektor } from '../logic/deteksi.js';
import { supabase } from './supabase.js';

export { supabase };                                       // tetap diekspor: kode lain boleh terus `import { supabase } from bootstrap`
export const api = buatApi(supabase);
export let pusat, detektor;

let referensiSiap;
export function muatReferensi() {
  return referensiSiap ??= (async () => {
    const res = await fetch('/data-referensi-snapcompost.json');
    if (!res.ok) throw new Error('Gagal memuat data referensi');
    C.muatReferensi(await res.json());
  })();
}

// Progres menyiapkan model (0–100), dibaca layar scan. 0–90 = unduh best.onnx, 90–100 = membuat sesi ONNX.
const pendengar = new Set();
export const progresModel = {
  persen: 0,
  ikuti(fn) { pendengar.add(fn); return () => pendengar.delete(fn); },
};
const lapor = (p) => { progresModel.persen = p; pendengar.forEach((fn) => fn(p)); };

const UKURAN_MODEL = 44_806_144; // ganti dengan ukuran asli best.onnx (byte)

// ponytail: persen unduhan memakai Content-Length. Bila server mengirim gzip/tanpa header itu, persen melompat 0 → 90 (tetap benar, hanya kasar).
async function unduhModel(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Gagal mengunduh model');
  const terkompresi = res.headers.get('content-encoding');
  const total = terkompresi ? UKURAN_MODEL : (Number(res.headers.get('content-length')) || UKURAN_MODEL);
  if (!res.body) { const b = await res.blob(); lapor(90); return URL.createObjectURL(b); }const baca = res.body.getReader(), bagian = [];
  let n = 0;
  for (;;) {
    const { done, value } = await baca.read();
    if (done) break;
    bagian.push(value);
    n += value.length;
    lapor(Math.min(90, Math.round((n / total) * 90)));
  }
  return URL.createObjectURL(new Blob(bagian));
}

// Satu promise dibagi semua pemanggil: model dimuat sekali; scan yang ditekan lebih awal ikut menunggu yang sama.
let detektorSiap;
export function siapkanDetektor() {
  return detektorSiap ??= (async () => {
    lapor(0);
    const urlModel = await unduhModel('/assets/models/best.onnx');
    try {
      detektor = await buatDetektor({
        ort,
        urlModel,
        urlLabels: '/assets/labels/labels.txt',
        namaJson: C.ref().sampah_organik.map(s => s.nama),
      });
    } finally { URL.revokeObjectURL(urlModel); }
    lapor(100);
    return detektor;
  })().catch((e) => { detektorSiap = null; throw e; });     // gagal → scan berikutnya boleh mengulang
}

export async function boot() {
  await muatReferensi();
  pusat = buatPusatNotifikasi(api);
  // ponytail: tanpa await agar Beranda tidak menunggu; ditunda ke idle (maks 3 dtk) supaya init ONNX tidak mengganggu render pertama
  (window.requestIdleCallback ?? setTimeout)(() =>
    siapkanDetektor().catch(e => console.warn('Model belum siap:', e)), { timeout: 3000 });
}