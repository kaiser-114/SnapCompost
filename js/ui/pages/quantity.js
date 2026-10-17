// js/ui/pages/quantity.js — Langkah 4: Input Jumlah (spec §7.3) → batch_input untuk alokasi (§2.1).
// Satu layar per label (layar "quantity"), lalu ringkasan (layar "quantity-confirm"), lalu Perlakuan Khusus (review.js).
// Validasi & konversi ke gram memakai core.js (validasiInputJumlah); file ini hanya menggambar layar.

import * as C from "../../logic/core.js";
import { quantityCard, quantityConfirmList } from "../core/dom.js";
import { hooks } from "../core/hooks.js";
import { setWorkflowScreen } from "../core/workflow.js";
import { bukaHasilDeteksi } from "./scan.js";
import { kembaliKeKondisi, mulaiPerlakuan } from "./review.js";

const IKON = "♻️";

let sesiAktif = null;       // sesi scan pemilik isian; berganti sesi = isian dibuang
let entri = [];             // keluaran langkah 3: [{ nama, nama_sampah, kondisi_tercentang, ... }]
let indeks = 0;             // label yang sedang diisi
let isian = {};             // { [nama]: teks yang diketik }
let hasil = {};             // { [nama]: hasil validasiInputJumlah } — terisi saat "Lanjut" lolos validasi
let besarDikonfirmasi = {}; // { [nama]: gram } — supaya dialog ≥ 10 kg tidak muncul dua kali untuk angka yang sama
let galatEl = null;

const $ = (sel) => document.querySelector(sel);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function infoSatuan(nama) {
  const m = C.dataSampah(nama);
  return m.tipe_input === "hitungan"
    ? { satuan: "butir", hitungan: true, perSatuan: m.berat_per_satuan }
    : { satuan: "g", hitungan: false, perSatuan: 1 };
}

const teksJumlah = (nama, v) =>
  infoSatuan(nama).hitungan ? `${v.nilai} butir (≈${v.gram} g)` : `${v.gram} g`;

function tampilGalat(pesan) {
  galatEl.textContent = pesan;
  galatEl.hidden = !pesan;
}

function renderItem() {
  const e = entri[indeks];
  const nama = C.dataSampah(e.nama_sampah).label_tampilan;
  const s = infoSatuan(e.nama_sampah);

  $("#quantity-progress-label").textContent = `Bahan ${indeks + 1} dari ${entri.length}`;
  $("#quantity-progress-fill").style.width = `${((indeks + 1) / entri.length) * 100}%`;
  $("#quantity-next").textContent = indeks === entri.length - 1 ? "Periksa jumlah →" : "Lanjut →";

  const art = el("span", "waste-art", IKON);
  art.setAttribute("aria-hidden", "true");

  const pembungkus = el("label", "quantity-input");
  const input = document.createElement("input");
  input.id = "quantity-value-input";
  input.type = "text";            // bukan type=number: "1,5" harus bisa diketik lalu ditolak dengan pesan (§7.3)
  input.inputMode = "numeric";
  input.autocomplete = "off";
  input.value = isian[e.nama] ?? "";
  input.setAttribute("aria-label", s.hitungan ? `Jumlah ${nama} dalam butir` : `Berat ${nama} dalam gram`);
  pembungkus.append(input, el("span", null, s.satuan));

  const petunjuk = el("p", "quantity-hint",
    s.hitungan ? `Hitung jumlah butirnya (sekitar ${s.perSatuan} g per butir).`
               : "Timbang atau perkirakan beratnya, lalu ketik angka bulat dalam gram.");
  galatEl = el("p", "workflow-error");
  galatEl.setAttribute("role", "alert");
  galatEl.hidden = true;

  input.addEventListener("input", () => {
    isian[e.nama] = input.value;
    tampilGalat("");
    if (s.hitungan) {
      const v = C.validasiInputJumlah(e.nama_sampah, input.value);
      petunjuk.textContent = v.valid ? `≈ ${v.gram} g` : `Hitung jumlah butirnya (sekitar ${s.perSatuan} g per butir).`;
    }
  });

  quantityCard.replaceChildren(art, el("strong", "quantity-name", nama), pembungkus, petunjuk, galatEl);
  setWorkflowScreen("quantity");
  input.focus();
}

function lanjut() {
  const e = entri[indeks];
  const teks = isian[e.nama] ?? "";
  if (!teks.trim()) return tampilGalat("Isi jumlahnya dulu.");
  const v = C.validasiInputJumlah(e.nama_sampah, teks);
  if (!v.valid) return tampilGalat(v.pesan);
  if (v.perlu_konfirmasi && besarDikonfirmasi[e.nama] !== v.gram) {
    const kg = (v.gram / 1000).toLocaleString("id-ID");
    // window.confirm = dialog bawaan; ganti dengan dialog sendiri bila nanti ada komponen dialog.
    if (!window.confirm(`Jumlahnya ${kg} kg. Sudah benar?`)) return;
    besarDikonfirmasi[e.nama] = v.gram;
  }
  hasil[e.nama] = v;
  if (indeks < entri.length - 1) { indeks += 1; renderItem(); }
  else renderRingkasan();
}

function renderRingkasan() {
  quantityConfirmList.replaceChildren(...entri.map((e) => {
    const baris = el("div", "quantity-confirm-card");
    const art = el("span", "waste-art", IKON);
    art.setAttribute("aria-hidden", "true");
    baris.append(art, el("span", null, C.dataSampah(e.nama_sampah).label_tampilan),
      el("strong", null, teksJumlah(e.nama_sampah, hasil[e.nama])));
    return baris;
  }));
  setWorkflowScreen("quantity-confirm");
}

// batch_input (§2.1): satu baris per label; id_entri = nama label (satu label = satu entri, §2.3).
function konfirmasi() {
  if (entri.some((e) => !hasil[e.nama])) return;
  const batch = entri.map((e) => ({
    id_entri: e.nama,
    nama_sampah: e.nama_sampah,
    berat_gram: hasil[e.nama].gram,
    kondisi_tercentang: e.kondisi_tercentang,
  }));
  // Perlakuan Khusus (satu halaman per sampah) ada di review.js; setelah itu review.js memanggil hooks.lanjutDariJumlah.
  mulaiPerlakuan(batch, sesiAktif);
}

// Titik masuk dari review.js (hooks.lanjutDariKondisi).
function mulai(daftarEntri, sesi) {
  if (sesi !== sesiAktif) { sesiAktif = sesi; isian = {}; besarDikonfirmasi = {}; }
  entri = daftarEntri;
  const ada = new Set(entri.map((e) => e.nama));
  for (const k of Object.keys(isian)) if (!ada.has(k)) delete isian[k]; // label yang sudah dihapus
  hasil = {};
  indeks = 0;
  renderItem();
}

function kembali() {
  if (indeks > 0) { indeks -= 1; renderItem(); return; }
  // Bahan pertama: kembali ke kondisi sampah terakhir; kalau tidak ada halaman kondisi, ke Hasil Deteksi.
  if (!kembaliKeKondisi()) bukaHasilDeteksi();
}

export function initQuantity() {
  hooks.lanjutDariKondisi = mulai;
  $("#quantity-next").addEventListener("click", lanjut);
  $("#quantity-confirm-continue").addEventListener("click", konfirmasi);

  // "Ubah jumlah": ulangi pengisian dari bahan PERTAMA sampai terakhir.
  // isian tetap dipertahankan, jadi angka yang sudah diketik tidak hilang.
  $('[data-workflow-screen="quantity-confirm"] .workflow-secondary')?.addEventListener("click", (event) => {
    event.stopPropagation();        // cegah workflow.js menukar layar sendiri
    indeks = 0;
    renderItem();
  });

  quantityCard.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.id === "quantity-value-input") { event.preventDefault(); lanjut(); }
  });
  // Back di header: ke bahan sebelumnya. Dicegat karena workflow.js hanya menukar layar.
  $('[data-workflow-screen="quantity"] [data-workflow-back]').addEventListener("click", (event) => {
    event.stopPropagation();
    kembali();
  });
}