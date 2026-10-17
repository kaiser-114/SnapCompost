// Alur scan: foto -> Hasil Deteksi -> (Cek) -> (Perbaiki / isi manual) -> Hasil Deteksi -> lanjut.
// Menggantikan detection.js, confirm.js, dan manual.js. Semua aturan alur ada di sesi scan
// (core.js: buatSesiScan); file ini hanya menggambar layar dan meneruskan klik ke sesi.
//
// Pemetaan layar (data-workflow-screen di index.html):
//   results      = "hasil"    : daftarHasilDeteksi() — baris ✓ (terverifikasi) dulu, lalu kandidat + persen
//   confirm      = "cek"      : centang kandidat AI yang benar -> lanjutDiCek()
//   manual       = "perbaiki" : cari/tambah (lanjutkanManual) dan hapus (hapus) bahan terverifikasi
//   no-detection / not-found  : tetap seperti sebelumnya

import * as C from "../../logic/core.js";
import {
  workflowView, detectionList, detectionSummary,
  confirmList, confirmCount, confirmAdd,
  manualInput, manualSuggestions, manualPicked, manualFindButton
} from "../core/dom.js";
import { S } from "../core/ui-state.js";
import { hooks } from "../core/hooks.js";
import { showToast } from "../core/ui.js";
import { setWorkflowScreen, showWorkflowError, clearWorkflowError, closeWasteFlow } from "../core/workflow.js";
import { ikonSampah } from "../core/waste-icon.js";
import { revokeCapturedPhoto, startCamera } from "./camera.js";

let sesi = null; // sesi scan aktif (satu per foto)
let ulang = false; // true = foto berikutnya adalah scan ulang: sesi lama dipertahankan

export const sesiScanAktif = () => sesi;

// Dipakai review.js dan quantity.js untuk kembali ke Hasil Deteksi (digambar ulang: baris yang sudah dikonfirmasi kini bertanda ✓).
export function bukaHasilDeteksi() {
  if (sesi) renderHasil();
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// ---------- Hasil Deteksi ----------

function kartuDeteksi(baris) {
  const kartu = el("article", "detection-card");
  const art = el("span", "waste-art", ikonSampah(baris.nama ?? baris.label_tampilan));
  art.setAttribute("aria-hidden", "true");
  const info = el("div", "waste-card-info");
  info.append(el("span", "waste-name", baris.label_tampilan));
  if (baris.persen !== null) {
    const bar = el("div", "waste-confidence");
    const isi = document.createElement("span");
    isi.style.width = `${Math.max(0, Math.min(100, baris.persen))}%`;
    bar.append(isi);
    info.append(bar);
  } else if (baris.keterangan) {
    info.append(el("span", "notification-description", baris.keterangan));
  }
  const kanan = el("span", "waste-percent", baris.persen !== null ? `${baris.persen}%` : "✓");
  if (baris.persen === null) kanan.setAttribute("aria-label", "Sudah dikonfirmasi");
  kartu.append(art, info, kanan);
  return kartu;
}

// Saat loading: teks ringkasan dan tombol bawah disembunyikan (pakai style inline agar tidak bergantung pada CSS lain).
function aturTampilanLoading(sedangLoading) {
  const nilai = sedangLoading ? "none" : "";
  detectionSummary.style.display = nilai;
  const aksi = document.querySelector('[data-workflow-screen="results"] .workflow-actions');
  if (aksi) aksi.style.display = nilai;
}

function renderHasil() {
  aturTampilanLoading(false);
  const data = sesi.daftarHasilDeteksi();
  clearWorkflowError();
  detectionSummary.textContent = data.judul;
  detectionList.replaceChildren(...data.baris.map(kartuDeteksi));
  document.querySelector("#to-confirm").disabled = !data.tombol_lanjut_aktif;
  const koreksi = document.querySelector("#detection-correction");
  koreksi.hidden = false; // "Ada yang salah" selalu aktif
  koreksi.textContent = "Ada yang salah / tidak terdeteksi";
  setWorkflowScreen("results");
}

const tungguGambar = () => new Promise((selesai) => window.setTimeout(selesai, 50));

const tungguPenuh = () => new Promise((selesai) => {
  const t0 = performance.now();
  const cek = () => (halus.tampil >= 99.5 || performance.now() - t0 > 450) ? selesai() : requestAnimationFrame(cek);
  cek();
});

// ---------- Loading deteksi ----------
// Satu elemen loading dipakai dari foto diambil sampai hasil muncul. Hanya teksnya yang berganti
// ("Menyiapkan model AI…" → "Mendeteksi sampah…"), jadi putaran tidak berhenti atau mulai ulang saat model siap.

function tampilLoading(teks, persen = 0) {
  const kotak = el("div", "detection-loading");
  const putar = el("span", "detection-spinner");
  putar.setAttribute("aria-hidden", "true");
  const label = el("p", null, teks);
  label.setAttribute("role", "status");            // hanya teks tahap yang dibacakan; angka persen berubah terlalu sering
  const angka = el("strong", "detection-persen", "0%");
  angka.setAttribute("aria-hidden", "true");
  const bar = el("div", "detection-progress");
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", "100");
  bar.append(document.createElement("span"));
  kotak.append(putar, label, angka, bar);
  detectionList.replaceChildren(kotak);
  halus.tampil = halus.target = persen;
  ubahLoading(teks, persen);
}

const halus = { target: 0, tampil: 0, raf: 0, t: 0 };

function ubahLoading(teks, persen) {
  const kotak = detectionList.querySelector(".detection-loading");
  if (!kotak) return;
  const p = kotak.querySelector("p");
  if (p.textContent !== teks) p.textContent = teks;
  halus.target = Math.max(0, Math.min(100, persen));
  if (halus.target < halus.tampil - 5) halus.tampil = halus.target;
  if (!halus.raf) { halus.t = performance.now(); halus.raf = requestAnimationFrame(gambarHalus); }
}

function gambarHalus(now) {
  halus.raf = 0;
  const kotak = detectionList.querySelector(".detection-loading");
  if (!kotak) return;
  const dt = Math.min(now - halus.t, 100);
  halus.t = now;
  const merayap = halus.target >= 90 && halus.target < 100;
  const tujuan = merayap ? 98 : halus.target;
  const tau = merayap ? 1500 : halus.target === 100 ? 120 : 250;
  halus.tampil += (tujuan - halus.tampil) * (1 - Math.exp(-dt / tau));
  if (Math.abs(tujuan - halus.tampil) < 0.05) halus.tampil = tujuan;
  const bulat = Math.round(halus.tampil);
  kotak.querySelector(".detection-persen").textContent = `${bulat}%`;
  kotak.querySelector(".detection-progress span").style.transform = `scaleX(${halus.tampil / 100})`;
  kotak.querySelector(".detection-progress").setAttribute("aria-valuenow", String(bulat));
  if (halus.tampil !== tujuan) halus.raf = requestAnimationFrame(gambarHalus);
}

// Persen deteksi = ESTIMASI: satu panggilan inferensi tidak melapor kemajuan. Naik mendekati 95% menurut durasi
// lari terakhir (awal 4 dtk), lalu 100% saat hasil datang. Angka hanya bergerak bila thread utama tidak terblokir inferensi.
let durasiDeteksi = 4000;
function mulaiEstimasi() {
  const t0 = performance.now();
  let raf = 0;
  const tik = () => {
    ubahLoading("Mendeteksi sampah…", 95 * (1 - Math.exp(-(performance.now() - t0) / (durasiDeteksi / 3))));
    raf = requestAnimationFrame(tik);
  };
  tik();
  return () => { cancelAnimationFrame(raf); durasiDeteksi = Math.max(500, performance.now() - t0); };
}

// Model dimuat di latar belakang (bootstrap): tunggu sampai siap. null = layar sudah ditinggalkan.
// Tanpa batas waktu: berjalan sampai model siap; bila pemuatan gagal, galatnya dilempar ke catch prosesFoto.
async function tungguModel(basi) {
  const teks = "Menyiapkan model AI…";
  ubahLoading(teks, model.progres.persen);
  const lepas = model.progres.ikuti((p) => ubahLoading(teks, p));
  let d;
  try { d = await model.siapkan(); } finally { lepas(); }   // memulai pemuatan bila belum jalan; berbagi promise bila sudah
  if (basi()) return null;
  ubahLoading(teks, 100);
  await tungguPenuh();
  return basi() ? null : d;
}

async function prosesFoto(file, getDetektor) {
  const id = ++S.detectionRequestId;
  // Scan ulang (dari Perbaiki) mempertahankan terverifikasi; terimaHasilScan mengganti kandidat lama (spec §2.3).
  if (!ulang || !sesi) { sesi?.buang(); sesi = C.buatSesiScan(); }
  ulang = false;
  const basi = () => id !== S.detectionRequestId || workflowView.hidden;

  clearWorkflowError();
  setWorkflowScreen("results");
  detectionSummary.textContent = "";
  aturTampilanLoading(true);
  tampilLoading(getDetektor() ? "Mendeteksi sampah…" : "Menyiapkan model AI…", getDetektor() ? 0 : model.progres.persen);
  document.querySelector("#to-confirm").disabled = true;
  document.querySelector("#detection-correction").hidden = true;

  try {
    // Inferensi ONNX/wasm memblokir thread utama: beri kesempatan "Memeriksa foto…" digambar dulu.
    await tungguGambar();
    if (basi()) return;
    const detektor = getDetektor() ?? await tungguModel(basi);   // model belum siap: loading tetap berputar
    if (basi() || !detektor) return;
    ubahLoading("Mendeteksi sampah…", 0);
    await tungguGambar();                                                       // gambar teks baru sebelum inferensi memblokir
    if (basi()) return;
    const berhenti = mulaiEstimasi();
    let hasil;
    try { hasil = await detektor.deteksi(file); } finally { berhenti(); }
    if (basi()) return;
    ubahLoading("Mendeteksi sampah…", 100);
    await tungguPenuh();                                                       // gambar 100% sebelum layar hasil menggantikannya
    if (basi()) return;
    sesi.terimaHasilScan(hasil);
    // ponytail: diagnostik sementara; hapus setelah deteksi terbukti jalan di perangkat
    console.info(`Detektor: ${hasil.length} label lolos ambang, ${sesi.kandidat.size} jadi kandidat`, hasil.slice(0, 3));
  } catch (error) {
    console.error("Deteksi gagal:", error);
    if (basi()) return;
    renderHasil();
    detectionSummary.textContent = "Deteksi tidak dapat dijalankan.";
    document.querySelector("#detection-correction").textContent = "Masukkan sampah secara manual";
    showWorkflowError(error?.message === "Deteksi sedang berjalan"
      ? "Deteksi sebelumnya masih berjalan. Tunggu sebentar lalu coba lagi."
      : `Deteksi gagal dijalankan (${error?.message ?? "sebab tidak diketahui"}). Coba foto lagi atau masukkan sampah secara manual.`);
    return;
  }

  // Spec §2.3: daftar kosong tetap di Hasil Deteksi ("Tidak ada sampah terdeteksi"),
  // tombol "Ada yang salah" tetap aktif -> Perbaiki. Tidak ada layar no-detection terpisah.
  renderHasil(); // judul "Tidak ada sampah terdeteksi" sudah dari sesi.daftarHasilDeteksi()
}

function lanjutDariHasil() {
  const entri = sesi.deteksiSudahBenar(); // null = tidak ada sampah, tombol sebenarnya sudah nonaktif
  if (!entri) return;
  // Layar berikutnya (Cek Kondisi) dipasang lewat hook ini.
  if (typeof hooks.lanjutDariDeteksi === "function") hooks.lanjutDariDeteksi(entri, sesi);
  else showToast("Langkah berikutnya (cek kondisi) belum tersedia");
}

function tekanAdaYangSalah() {
  if (sesi.tekanAdaYangSalah() === "cek") renderCek();
  else bukaPerbaiki();
}

// ---------- Cek: centang kandidat AI yang benar ----------

function renderCek() {
  const kandidat = [...sesi.kandidat.values()].sort((a, b) => b.confidence - a.confidence);
  confirmList.replaceChildren(...kandidat.map((k) => {
    const label = el("label", "confirm-card");
    const kotak = document.createElement("input");
    kotak.type = "checkbox";
    kotak.className = "confirm-check";
    kotak.checked = false; // spec: CekYangSudahBenar tanpa centang awal
    kotak.dataset.nama = k.nama;
    const nama = C.ref().peta.get(k.nama).label_tampilan;
    kotak.setAttribute("aria-label", `Pilih ${nama}`);
    const art = el("span", "waste-art", ikonSampah(k.nama));
    art.setAttribute("aria-hidden", "true");
    const info = el("span", "waste-card-info");
    info.append(el("span", "waste-name", nama),
      el("span", "notification-description", `Keyakinan AI ${Math.round(k.confidence * 100)}%`));
    label.append(kotak, art, info);
    return label;
  }));
  confirmCount.textContent = `${kandidat.length} jenis sampah terdeteksi. Centang yang benar:`;
  document.querySelector("#confirm-correction").hidden = true; // alur koreksi sudah berjalan di layar ini
  perbaruiCek();
  setWorkflowScreen("confirm");
}

function perbaruiCek() {
  const kotak = [...confirmList.querySelectorAll(".confirm-check")];
  const dipilih = kotak.filter((k) => k.checked).length;
  confirmAdd.disabled = false; // tanpa centang pun boleh lanjut (isi manual)
  confirmAdd.textContent = dipilih ? `Tambahkan ${dipilih} sampah terpilih` : "Lanjutkan tanpa memilih";
  document.querySelector("#toggle-all-confirm").textContent = dipilih === kotak.length ? "Batalkan semua" : "Pilih semua";
}

function lanjutDariCek() {
  const dicentang = [...confirmList.querySelectorAll(".confirm-check:checked")].map((k) => k.dataset.nama);
  sesi.lanjutDiCek(dicentang); // yang tidak dicentang dibuang; layar berikutnya = perbaiki
  bukaPerbaiki();
}

// ---------- Perbaiki / isi manual ----------

function bukaPerbaiki() {
  S.manualReturnScreen = "results";
  manualInput.value = "";
  renderPilihan();
  renderSaran("");
  setWorkflowScreen("manual");
  manualInput.focus();
}

// Teks & status tombol hijau layar manual: ditentukan oleh isi kolom cari, apakah isinya cocok persis
// (tier 1, sama seperti aturan di tambahManual), dan jumlah bahan terverifikasi.
function perbaruiTombolManual() {
  const teks = manualInput.value.trim();
  const jumlah = sesi ? sesi.terverifikasi.size : 0;
  const persis = teks !== "" && C.cariSaran(teks).some((s) => s.tier === 1);

  let label;
  if (persis) label = "Tambahkan ke list sampah terpilih";
  else if (teks || !jumlah) label = "Cari dan tambahkan ke list terpilih";
  else label = `Tambahkan ${jumlah} sampah terpilih`;
  manualFindButton.textContent = label;

  const nonaktif = !teks && !jumlah; // pudar (gaya :disabled) & tidak bisa ditekan
  manualFindButton.disabled = nonaktif;
  manualFindButton.setAttribute("aria-disabled", String(nonaktif));
}

function renderPilihan() {
  const label = (nama) => C.ref().peta.get(nama)?.label_tampilan ?? nama;
  manualPicked.replaceChildren(...[...sesi.terverifikasi.values()].map((v) => {
    const baris = el("div", "manual-picked-item");
    baris.append(el("span", null, `${ikonSampah(v.nama)} ${label(v.nama)} · ${v.sumber === "manual" ? "Manual" : "Terdeteksi AI"}`));
    const hapus = el("button", null, "×");
    hapus.type = "button";
    hapus.setAttribute("aria-label", `Hapus ${label(v.nama)}`);
    hapus.addEventListener("click", () => {
      sesi.hapus(v.nama);
      renderPilihan();
    });
    baris.append(hapus);
    return baris;
  }));
  const jumlah = sesi.terverifikasi.size;
  perbaruiTombolManual();
  document.querySelector("#not-found-back").textContent = jumlah ? "Kembali ke Hasil Deteksi" : "Kembali";
}

function renderSaran(teks) {
  const saran = teks.trim()
    ? C.cariSaran(teks)
    : C.ref().sampah_organik.slice(0, 4).map((s) => ({ nama: s.nama, label_tampilan: s.label_tampilan }));
  manualSuggestions.replaceChildren(...saran.map((s) => {
    const tombol = el("button", "manual-suggestion");
    tombol.type = "button";
    tombol.setAttribute("role", "option");
    tombol.dataset.nama = s.nama;
    const ikon = el("span", null, "♧");
    ikon.setAttribute("aria-hidden", "true");
    tombol.append(ikon, el("span", null, s.label_tampilan));
    return tombol;
  }));
  manualSuggestions.hidden = saran.length === 0;
  manualInput.setAttribute("aria-expanded", String(saran.length > 0));
}

function sembunyikanSaran() {
  manualSuggestions.hidden = true;
  manualInput.setAttribute("aria-expanded", "false");
}

function tambahManual() {
  const teks = manualInput.value.trim();
  if (teks) {
    const saran = C.cariSaran(teks);
    const tepat = saran.find((s) => s.tier === 1); // cocok persis dengan label, nama, atau sinonim
    if (!tepat) {
      if (saran.length) { // ada yang mirip: isi dengan yang paling cocok, tekan lagi untuk menambahkan
        manualInput.value = saran[0].label_tampilan;
        sembunyikanSaran();
        perbaruiTombolManual();
        return;
      }
      document.querySelector("#not-found-message").textContent =
        `"${teks}" belum ada di daftar resep kami. Coba nama lain atau kembali ke hasil deteksi.`;
      setWorkflowScreen("not-found");
      return;
    }
    if (sesi.terverifikasi.has(tepat.nama)) showToast(`${tepat.label_tampilan} sudah ada di daftar`);
    else sesi.lanjutkanManual(tepat.nama);
    manualInput.value = "";
    renderPilihan();
    renderSaran("");
    return;
  }
  if (sesi.terverifikasi.size) { renderHasil(); return; }
  manualInput.focus();
  showToast("Pilih atau ketik nama sampah terlebih dahulu");
}

function kembaliDariPerbaiki() {
  if (sesi.kembaliDariPerbaiki() === "hasil") renderHasil();
  else closeWasteFlow(); // tidak ada bahan terverifikasi: sesi dibuang, kembali ke layar asal
}

// ---------- Pemasangan ----------

let model; // { siapkan, progres } dari bootstrap; diisi initScan
export function initScan({ getDetektor, siapkanDetektor, progresModel }) {
  model = { siapkan: siapkanDetektor, progres: progresModel };
  hooks.processCapturedPhoto = (file) => prosesFoto(file, getDetektor);
  hooks.tutupAlur = () => { sesi?.buang(); ulang = false; aturTampilanLoading(false); };

  document.querySelector("#manual-rescan").addEventListener("click", () => {
    ulang = true;
    revokeCapturedPhoto();
    setWorkflowScreen("camera");
    startCamera();
  });

  document.querySelector("#to-confirm").addEventListener("click", lanjutDariHasil);
  document.querySelector("#detection-correction").addEventListener("click", tekanAdaYangSalah);

  document.querySelector("#retry-camera").addEventListener("click", () => {
    sesi?.buang();
    revokeCapturedPhoto();
    setWorkflowScreen("camera");
    startCamera();
  });
  document.querySelector("#manual-from-empty").addEventListener("click", bukaPerbaiki);

  confirmList.addEventListener("change", perbaruiCek);
  document.querySelector("#toggle-all-confirm").addEventListener("click", () => {
    const kotak = [...confirmList.querySelectorAll(".confirm-check")];
    const centangSemua = kotak.some((k) => !k.checked);
    kotak.forEach((k) => { k.checked = centangSemua; });
    perbaruiCek();
  });
  confirmAdd.addEventListener("click", lanjutDariCek);

  manualInput.addEventListener("input", () => {
    renderSaran(manualInput.value);
    perbaruiTombolManual();
  });
  manualInput.addEventListener("focus", () => renderSaran(manualInput.value));
  manualInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    tambahManual();
  });
  manualSuggestions.addEventListener("click", (event) => {
    const saran = event.target.closest(".manual-suggestion");
    if (!saran) return;
    manualInput.value = C.ref().peta.get(saran.dataset.nama).label_tampilan;
    sembunyikanSaran();
    perbaruiTombolManual();
    manualInput.focus();
  });
  manualFindButton.addEventListener("click", tambahManual);
  document.querySelector("#try-another-name").addEventListener("click", () => {
    setWorkflowScreen("manual");
    manualInput.focus();
    manualInput.select();
  });
  document.querySelector("#not-found-back").addEventListener("click", kembaliDariPerbaiki);

  // Tombol kembali di header layar manual: workflow.js akan memakai S.manualReturnScreen apa adanya (tanpa menggambar ulang
  // dan tanpa membuang sesi kosong), jadi dicegat di sini lalu diserahkan ke aturan sesi.
  document.querySelector('[data-workflow-screen="manual"] [data-workflow-back]').addEventListener("click", (event) => {
    event.stopPropagation();
    kembaliDariPerbaiki();
  });
}