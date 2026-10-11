import * as C from './core.js';
import * as A from './alokasi.js';
import * as D from './deteksi.js';
import * as N from './notifikasi.js';
import * as W from './wadah.js';
import { buatApi } from './api.js';

export async function buatIntegrasiSnapCompost({
  supabaseClient,
  ort,
  urlReferensi = 'data/data-referensi-snapcompost.json',
  urlModel = 'assets/models/best.onnx',
  urlLabels = 'assets/labels/labels.txt',
}) {
  if (!supabaseClient) throw new Error('Klien Supabase wajib diberikan untuk menjalankan integrasi.');

  const response = await fetch(urlReferensi);
  if (!response.ok) throw new Error(`Data referensi gagal dimuat (HTTP ${response.status}).`);
  C.muatReferensi(await response.json());

  const api = buatApi(supabaseClient);
  const pusatNotifikasi = N.buatPusatNotifikasi(api);
  let detektorPromise;

  async function deteksi(foto) {
    if (!ort) throw new Error('ONNX Runtime belum dikonfigurasi untuk fitur deteksi foto.');
    if (!detektorPromise) {
      detektorPromise = D.buatDetektor({
        ort,
        urlModel,
        urlLabels,
        namaJson: C.ref().sampah_organik.map(s => s.nama),
      }).catch(error => {
        detektorPromise = null;
        throw error;
      });
    }
    return (await detektorPromise).deteksi(foto);
  }

  return {
    core: C,
    alokasi: A,
    api,
    deteksi,
    notifikasi: pusatNotifikasi,
    wadah: W,
    async muatBeranda(hariIni = C.hariIniWIB(), urut = 'progress_tinggi') {
      const data = await api.daftarWadah();
      const daftarAktif = W.daftarHomepage(data, hariIni, urut);
      return {
        statistik: W.dashboard(data, hariIni),
        wadah: daftarAktif.map(item => W.kartuWadah(item, hariIni)),
      };
    },
    async muatDetailWadah(id, hariIni = C.hariIniWIB()) {
      const [wadah, item] = await Promise.all([api.wadah(id), api.itemWadah(id)]);
      return W.detailWadah(wadah, item, hariIni);
    },
  };
}
