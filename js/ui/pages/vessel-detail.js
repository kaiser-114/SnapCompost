// js/ui/pages/vessel-detail.js
// Detail wadah berstatus "sedang_mengisi" (spec §7.2, §7.5, §8). Status lain belum ditangani di sini.
// Semua teks dari data/user dimasukkan lewat textContent (spec §12.1), tidak pernah innerHTML.
import * as C from "../../logic/core.js";
import { api } from "../../app/bootstrap.js";
import { phone, workflowView, vesselDetailContent, vesselDetailActions } from "../core/dom.js";
import { S } from "../core/ui-state.js";
import { showToast } from "../core/ui.js";
import { hooks } from "../core/hooks.js";
import { setWorkflowScreen, closeWasteFlow } from "../core/workflow.js";
import { openCamera } from "../pages/camera.js";

const IKON_HERO = { eco_enzyme: "💧", kompos: "🌱", kompos_kering: "🍂" };
const IKON_ALAT = { eco_enzyme: "🧴", kompos: "🪣", kompos_kering: "🪣" };
const TIPE = { eco_enzyme: "eco", kompos: "kompos", kompos_kering: "kompos" };

let w = null;          // baris wadah (VIEW wadah_status_efektif)
let items = [];        // baris item_wadah
let editMode = false;
let sibuk = false;

// ---------- helper ----------
function el(tag, kelas, teks) {
  const e = document.createElement(tag);
  if (kelas) e.className = kelas;
  if (teks !== undefined) e.textContent = teks;
  return e;
}
const gram = n => `${Number(n).toLocaleString("id-ID")}g`;
const layarDetail = () => workflowView.querySelector('[data-workflow-screen="vessel-detail"]');
const resepW = () => C.ref().resep.find(r => r.nama === w.nama_resep);
const paramW = () => C.ref().parameter_resep.find(p => p.nama_resep === w.nama_resep);

const fmtBerat = g => (g >= 1000 ? `${(g / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} kg` : `${g} g`);
const tglId = iso => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
  .format(new Date(iso + "T00:00:00Z"));
const modeFermentasi = () => w.status === "sedang_fermentasi";   // termasuk yang sudah matang
const modeMatang = () => modeFermentasi() && (w.status_efektif ?? C.statusEfektif(w)) === "matang";

// Baris checklist yang tampil (jumlah 0 = jejak bahan, disembunyikan; spec §7.2)
const barisChecklist = () => Object.entries(w.checklist_pending ?? {}).filter(([, c]) => c.jumlah > 0);
const jumlahTercentang = () => barisChecklist().filter(([, c]) => c.tercentang).length;
const bolehMulai = () => items.length > 0 && C.checklistLengkap(w.checklist_pending);

// Langkah pengolahan: JSON hanya punya urutan + detail_langkah (tanpa judul/label waktu)
function bacaLangkah(l) {
  return { judul: l.judul ?? "", isi: l.detail_langkah ?? "", waktu: l.waktu ?? "" };
}

// ---------- operasi (satu per satu; tampilan diperbarui hanya setelah server berhasil) ----------
async function jalankan(fn) {
  if (sibuk) return;
  sibuk = true;
  vesselDetailContent.setAttribute("aria-busy", "true");
  try { await fn(); }
  catch (e) { showToast(e.message || "Terjadi kesalahan, coba lagi."); }
  finally {
    sibuk = false;
    vesselDetailContent.removeAttribute("aria-busy");
    if (w) gambar();
  }
}

function toggleCentang(kunci) {
  const c = w.checklist_pending[kunci];
  return jalankan(async () => {
    const hasil = await api.centangChecklist(w.id, kunci, !c.tercentang);
    const lokal = { ...w.checklist_pending, [kunci]: { ...c, tercentang: !c.tercentang } };
    w = { ...w, checklist_pending: hasil?.checklist ?? lokal };
    S.selectedVessel = w;
  });
}

async function simpanJumlah(item, input, pesan) {
  const v = C.validasiInputJumlah(item.nama_sampah, input.value);
  if (!v.valid) {
    pesan.textContent = v.pesan;
    input.setAttribute("aria-invalid", "true");
    return;
  }
  pesan.textContent = "";
  input.removeAttribute("aria-invalid");
  if (v.gram === item.berat) return;
  if (v.perlu_konfirmasi) {
    const ya = await konfirmasi({
      ikon: "⚠️", judul: "Jumlah besar, sudah benar?",
      isi: `Anda memasukkan ${v.gram.toLocaleString("id-ID")} gram. Pastikan satuannya gram.`,
      ya: "Ya, simpan", tidak: "Periksa lagi",
    });
    if (!ya) return;
  }
  await jalankan(async () => {
    const baru = items.map(x => (x.id === item.id ? { ...x, berat: v.gram } : x));
    const checklist = C.hitungChecklistBaru(w.checklist_pending, C.hitungBahanPendukung(baru, w.nama_resep));
    await api.ubahJumlahItem({ id_item: item.id, berat: v.gram, checklist });
    items = baru;
    w = { ...w, checklist_pending: checklist };
    S.selectedVessel = w;
  });
}

async function mulaiFermentasi() {
  if (sibuk || !bolehMulai()) return;
  const ya = await konfirmasi({
    ikon: "⚠️", judul: "Mulai Fermentasi?", catatan: "Perhatikan sebelum melanjutkan",
    isi: `Setelah ini, ${w.nama} tidak bisa lagi menambah sampah organik baru. Menambahkan bahan setelah ini dapat mengganggu proses fermentasi dan membuat prediksi hari matang tidak akurat.`,
    ya: "Lanjut →", tidak: "Kembali",
  });
  if (!ya) return;
  await jalankan(async () => {
    const jadwal = C.hitungJadwal(w.nama_resep);
    const hasil = await api.mulaiFermentasi({ id_wadah: w.id, pesan_pemantauan: jadwal.pesan_pemantauan });
    const beda = C.jadwalMenyimpang(hasil, w.nama_resep);
    w = null;
    closeWasteFlow(beda ? "Fermentasi dimulai, tetapi jadwal server berbeda dari data aplikasi." : "Fermentasi dimulai!");
  });
}

async function hapusWadah() {
  if (sibuk) return;
  const fermentasi = modeFermentasi();
  const ya = await konfirmasi({
    ikon: "🗑️", judul: "Hapus wadah ini?", bahaya: true,
    isi: `Wadah "${w.nama}" beserta seluruh isinya akan dihapus permanen dan tidak bisa dikembalikan.`
      + (fermentasi && w.gram_dihitung > 0
        ? ` Total sampah organik yang Anda manfaatkan juga akan berkurang ${fmtBerat(w.gram_dihitung)}.`
        : ""),
    ya: "Hapus permanen", tidak: "Batal",
  });
  if (!ya) return;
  await jalankan(async () => {
    // Wadah fermentasi: RPC hapus_wadah (mengurangi total). Wadah mengisi: DELETE biasa (gram_dihitung selalu 0 setelah batalkan).
    if (fermentasi) await api.hapusWadahFermentasi(w.id);
    else await api.hapusWadah(w.id);
    w = null;
    closeWasteFlow("Wadah dihapus");
  });
}

async function batalkanFermentasi() {
  if (sibuk) return;
  const ya = await konfirmasi({
    ikon: "↩️", judul: "Batalkan fermentasi?",
    isi: `${w.nama} kembali ke status Sedang Mengisi dan jadwal fermentasi dihapus. Isi wadah dan bahan yang sudah tercentang tetap tersimpan, dan Anda bisa memulai fermentasi lagi dari hari ke-0.${w.gram_dihitung > 0 ? ` Total sampah organik yang dimanfaatkan berkurang ${fmtBerat(w.gram_dihitung)} dan bertambah lagi saat fermentasi dimulai.` : ""}`,
    ya: "Ya, batalkan", tidak: "Kembali",
  });
  if (!ya) return;
  await jalankan(async () => {
    await api.batalkanFermentasi(w.id);
    const id = w.id;
    w = null;
    showToast("Kembali ke sedang mengisi");
    await bukaDetail(id);
  });
}

function fotoUntukWadahLain() {
  S.workflowReturnScreen = phone.dataset.screen === "wadah" ? "Wadah" : "Beranda";
  openCamera();
}

// ---------- dialog konfirmasi (bottom sheet) ----------
function konfirmasi({ ikon, judul, isi, catatan, ya, tidak = "Kembali", bahaya = false }) {
  return new Promise(resolve => {
    const lapis = el("div", "vf-sheet-layer");
    lapis.setAttribute("role", "dialog");
    lapis.setAttribute("aria-modal", "true");
    const sheet = el("div", "vf-sheet");
    const kepala = el("div", "vf-sheet-head");
    const ik = el("div", "vf-sheet-icon" + (bahaya ? " danger" : ""), ikon);
    const tk = el("div", "vf-sheet-titles");
    const h = el("h3", "vf-sheet-title", judul);
    h.id = "vf-sheet-title";
    lapis.setAttribute("aria-labelledby", h.id);
    tk.append(h);
    if (catatan) tk.append(el("p", "vf-sheet-note", catatan));
    kepala.append(ik, tk);
    const badan = el("p", "vf-sheet-body" + (bahaya ? " danger" : ""), isi);
    const aksi = el("div", "vf-sheet-actions");
    const bTidak = el("button", "vf-btn vf-btn-soft", tidak);
    const bYa = el("button", "vf-btn " + (bahaya ? "vf-btn-danger" : "vf-btn-primary"), ya);
    bTidak.type = bYa.type = "button";
    aksi.append(bTidak, bYa);
    sheet.append(kepala, badan, aksi);
    lapis.append(sheet);

    const tutup = hasil => {
      document.removeEventListener("keydown", esc, true);
      lapis.remove();
      resolve(hasil);
    };
    // Esc menutup dialog dulu, bukan seluruh alur (workflow.js menutup alur pada Esc)
    const esc = e => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      tutup(false);
    };
    document.addEventListener("keydown", esc, true);
    lapis.addEventListener("click", e => { if (e.target === lapis) tutup(false); });
    bTidak.addEventListener("click", () => tutup(false));
    bYa.addEventListener("click", () => tutup(true));
    layarDetail().append(lapis);
    bTidak.focus();
  });
}

// ---------- tampilan ----------
function kartuStatus() {
  const tipe = TIPE[w.nama_resep] ?? "kompos";
  const kartu = el("section", `vf-card vf-hero ${tipe}`);
  kartu.append(el("span", "vf-pill", "Mengisi"));
  kartu.append(el("div", "vf-hero-icon", IKON_HERO[w.nama_resep] ?? "🌱"));
  const lengkap = bolehMulai();
  kartu.append(el("p", "vf-hero-title", lengkap ? "Siap dimulai" : "Belum mulai fermentasi"));
  kartu.append(el("p", "vf-hero-sub", lengkap ? "Semua bahan sudah dicentang" : "Lengkapi bahan pendukung di bawah"));
  return kartu;
}

function kartuResep() {
  const r = resepW();
  const p = paramW();
  const kartu = el("section", "vf-card");
  kartu.append(el("p", "vf-kicker", "Resep yang digunakan"));
  const baris = el("div", "vf-recipe-row");
  baris.append(el("div", "vf-tile", "📋"));
  const info = el("div", "vf-recipe-info");
  info.append(el("strong", "vf-recipe-name", r?.label_tampilan ?? w.nama_resep));
  const durasi = el("span", "vf-recipe-duration");
  durasi.append(el("b", "", "Durasi:"), document.createTextNode(` ${p?.base_durasi_hari ?? "-"} hari`));
  info.append(durasi);
  baris.append(info);
  kartu.append(baris);

  if (r?.bentuk_akhir || r?.manfaat?.length) {
    const rinci = el("dl", "vf-recipe-detail");
    if (r.bentuk_akhir) {
      rinci.append(el("dt", "", "Hasil akhir"), el("dd", "", r.bentuk_akhir));
    }
    if (r.manfaat?.length) {
      rinci.append(el("dt", "", "Manfaat & kegunaan"));
      const dd = el("dd");
      const ul = el("ul", "vf-bullets");
      r.manfaat.forEach(t => ul.append(el("li", "", t)));
      dd.append(ul);
      rinci.append(dd);
    }
    kartu.append(rinci);
  }
  return kartu;
}

function barisSampah(item) {
  const s = C.ref().peta.get(item.nama_sampah); // jalur tampilan toleran bila label hilang dari JSON
  const baris = el("li", "vf-item");
  const atas = el("div", "vf-item-row");
  atas.append(el("span", "vf-item-name", s?.label_tampilan ?? item.nama_sampah));

  if (!editMode) {
    atas.append(el("b", "vf-item-weight", gram(item.berat)));
    baris.append(atas);
    return baris;
  }

  const hitungan = s?.tipe_input === "hitungan";
  const input = el("input", "vf-item-input");
  input.type = "text";
  input.inputMode = "numeric";
  input.autocomplete = "off";
  input.value = String(hitungan ? Math.round(item.berat / s.berat_per_satuan) : item.berat);
  input.setAttribute("aria-label", `Jumlah ${s?.label_tampilan ?? item.nama_sampah}`);
  const pesan = el("p", "vf-field-error");
  pesan.setAttribute("role", "alert");
  const kanan = el("span", "vf-item-edit");
  kanan.append(input, el("span", "vf-unit", hitungan ? "butir" : "g"));
  atas.append(kanan);
  baris.append(atas, pesan);
  input.addEventListener("change", () => simpanJumlah(item, input, pesan));
  input.addEventListener("keydown", e => { if (e.key === "Enter") input.blur(); });
  return baris;
}

function kartuSampah() {
  const kartu = el("section", "vf-card vf-card-flush");
  const kepala = el("div", "vf-card-head");
  kepala.append(el("p", "vf-kicker", "Sampah organik yang digunakan"));
  const tombol = el("button", "vf-chip vf-chip-edit", editMode ? "Selesai" : "Edit jumlah");
  tombol.type = "button";
  tombol.setAttribute("aria-pressed", String(editMode));
  tombol.addEventListener("click", () => { if (!sibuk) { editMode = !editMode; gambar(); } });
  kepala.append(tombol);
  kartu.append(kepala);
  if (!items.length) {
    kartu.append(el("p", "vf-empty", "Wadah ini belum berisi sampah organik."));
  } else {
    const ul = el("ul", "vf-list");
    items.forEach(i => ul.append(barisSampah(i)));
    kartu.append(ul);
  }
  return kartu;
}

function kartuChecklist() {
  const kartu = el("section", "vf-card vf-card-flush");
  const pita = el("div", "vf-band");
  pita.append(el("p", "vf-band-title", "Checklist bahan pendukung"), el("p", "vf-band-sub", "Centang bahan yang sudah disiapkan"));
  kartu.append(pita);
  const baris = barisChecklist();
  if (!baris.length) {
    kartu.append(el("p", "vf-empty", "Belum ada bahan pendukung yang perlu disiapkan."));
    return kartu;
  }
  const ul = el("ul", "vf-checks");
  baris.forEach(([kunci, c]) => {
    const { teks, satuan } = C.teksBahan(kunci);
    const li = el("li");
    const b = el("button", "vf-check" + (c.tercentang ? " done" : ""));
    b.type = "button";
    b.setAttribute("role", "checkbox");
    b.setAttribute("aria-checked", String(c.tercentang));
    const kotak = el("span", "vf-check-box", c.tercentang ? "✓" : "");
    kotak.setAttribute("aria-hidden", "true");
    const jumlah = !c.tercentang && c.sudah_dituang > 0
      ? `+ ${C.sisaDituang(c).toLocaleString("id-ID")}${satuan}`
      : `${c.jumlah.toLocaleString("id-ID")}${satuan}`;
    b.append(kotak, el("span", "vf-check-label", teks), el("b", "vf-check-amount", jumlah));
    b.addEventListener("click", () => toggleCentang(kunci));
    li.append(b);
    ul.append(li);
  });
  kartu.append(ul);
  return kartu;
}

function kepalaKartu(ikon, judul, chip) {
  const kepala = el("div", "vf-card-head");
  const kiri = el("div", "vf-head-left");
  kiri.append(el("span", "vf-head-icon", ikon), el("p", "vf-kicker", judul));
  kepala.append(kiri);
  if (chip) kepala.append(el("span", "vf-chip static", chip));
  return kepala;
}

function kartuAlat() {
  const daftar = C.ref().alat_modifikasi.filter(a => a.nama_resep === w.nama_resep);
  if (!daftar.length) return null;
  const kartu = el("section", "vf-card vf-card-flush");
  kartu.append(kepalaKartu("🔧", "Alat yang perlu dimodifikasi", `${daftar.length} alat`));
  const badan = el("div", "vf-body");
  daftar.forEach(a => {
    const judul = el("div", "vf-tool-title");
    judul.append(el("div", "vf-tile", IKON_ALAT[w.nama_resep] ?? "🪣"), el("strong", "", a.nama_komponen));
    const ol = el("ol", "vf-steps");
    a.spesifikasi.forEach((t, n) => {
      const li = el("li", "vf-step");
      li.append(el("span", "vf-step-no", String(n + 1)), el("p", "", t));
      ol.append(li);
    });
    badan.append(judul, ol);
  });
  kartu.append(badan);
  return kartu;
}

function kartuLangkah() {
  const daftar = C.ref().langkah_resep
    .filter(l => l.nama_resep === w.nama_resep)
    .sort((a, b) => a.urutan - b.urutan);
  if (!daftar.length) return null;
  const kartu = el("section", "vf-card vf-card-flush");
  kartu.append(kepalaKartu("📋", "Langkah pengolahan"));
  const badan = el("div", "vf-body");
  const ol = el("ol", "vf-steps vf-steps-big");
  daftar.forEach(l => {
    const { judul, isi, waktu } = bacaLangkah(l);
    const li = el("li", "vf-step");
    li.append(el("span", "vf-step-no", String(l.urutan)));
    const isiLi = el("div", "vf-step-body");
    if (judul || waktu) {
      const atas = el("div", "vf-step-top");
      if (judul) atas.append(el("strong", "", judul));
      if (waktu) atas.append(el("span", "vf-tag", waktu));
      isiLi.append(atas);
    }
    if (isi) isiLi.append(el("p", "vf-step-desc", isi));
    li.append(isiLi);
    ol.append(li);
  });
  badan.append(ol);
  kartu.append(badan);
  return kartu;
}

function kartuHapus() {
  const kartu = el("section", "vf-card vf-card-danger");
  kartu.append(el("p", "vf-kicker", "Zona berbahaya"));
  const b = el("button", "vf-delete");
  b.type = "button";
  const teks = el("span", "vf-delete-text");
  teks.append(el("strong", "", "Hapus wadah"), el("small", "", "Hapus permanen, termasuk semua bahan di dalamnya"));
  b.append(el("span", "vf-delete-icon", "🗑️"), teks);
  b.addEventListener("click", hapusWadah);
  kartu.append(b);
  return kartu;
}

function tombolMulai() {
  const b = el("button", "vf-start");
  b.type = "button";
  const ok = bolehMulai();
  b.disabled = !ok;
  if (ok) b.textContent = "Mulai Fermentasi!";
  else if (!items.length) b.textContent = "Wadah masih kosong";
  else b.textContent = `Centang semua bahan dahulu (${jumlahTercentang()}/${barisChecklist().length})`;
  b.addEventListener("click", mulaiFermentasi);
  return b;
}

function kartuProses() {
  const pr = C.progress(w);
  const d = w.estimasi_durasi_hari;
  const kartu = el("section", "vf-card vf-hero vf-proses");
  kartu.append(el("span", "vf-pill vf-pill-proses", "Proses"));
  kartu.append(el("div", "vf-hero-icon", IKON_HERO[w.nama_resep] ?? "🌱"));
  kartu.append(el("p", "vf-day-number", String(pr.hariKe)));
  kartu.append(el("p", "vf-hero-sub", `${pr.hariKe} dari ${d} hari total`));
  const track = el("div", "vf-bar");
  track.setAttribute("role", "progressbar");
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", "100");
  track.setAttribute("aria-valuenow", String(pr.persen));
  const isi = el("span", "vf-bar-fill");
  isi.style.width = `max(1px, ${pr.persen}%)`;
  track.append(isi);
  kartu.append(track);
  const est = el("p", "vf-estimate");
  est.append(el("span", "vf-estimate-icon", "🕒"), document.createTextNode("Estimasi matang: "));
  est.append(el("b", "", tglId(w.tanggal_matang)));
  kartu.append(est);
  return kartu;
}

function kartuDaftar(judul, baris) {
  const kartu = el("section", "vf-card vf-card-flush");
  const kepala = el("div", "vf-card-head");
  kepala.append(el("p", "vf-kicker", judul));
  kartu.append(kepala);
  if (!baris.length) { kartu.append(el("p", "vf-empty", "Tidak ada data.")); return kartu; }
  const ul = el("ul", "vf-list");
  baris.forEach(([nama, jumlah]) => {
    const li = el("li", "vf-item");
    const r = el("div", "vf-item-row");
    r.append(el("span", "vf-item-name", nama), el("b", "vf-item-weight", jumlah));
    li.append(r);
    ul.append(li);
  });
  kartu.append(ul);
  return kartu;
}

const kartuSampahBaca = () => kartuDaftar("Sampah organik yang digunakan",
  items.map(i => [C.ref().peta.get(i.nama_sampah)?.label_tampilan ?? i.nama_sampah, gram(i.berat)]));

const kartuBahanLain = () => kartuDaftar("Bahan lain yang digunakan",
  barisChecklist().map(([kunci, c]) => {
    const { teks, satuan } = C.teksBahan(kunci);
    return [teks, `${c.jumlah.toLocaleString("id-ID")}${satuan}`];
  }));

function kartuAksi() {
  const kartu = el("section", "vf-card vf-card-danger");
  kartu.append(el("p", "vf-kicker", "Zona berbahaya"));
  const kotak = el("div", "vf-actions-stack");

  const undo = el("button", "vf-undo");
  undo.type = "button";
  const tu = el("span", "vf-delete-text");
  tu.append(el("strong", "", "Batalkan fermentasi"), el("small", "", "Kembali ke sedang mengisi. Isi wadah dan centang bahan tetap tersimpan."));
  undo.append(el("span", "vf-delete-icon", "↩️"), tu);
  undo.addEventListener("click", batalkanFermentasi);

  const hapus = el("button", "vf-delete");
  hapus.type = "button";
  const th = el("span", "vf-delete-text");
  th.append(el("strong", "", "Hapus wadah"), el("small", "", "Hapus permanen, termasuk semua bahan di dalamnya"));
  hapus.append(el("span", "vf-delete-icon", "🗑️"), th);
  hapus.addEventListener("click", hapusWadah);

  kotak.append(undo, hapus);
  kartu.append(kotak);
  return kartu;
}

function tombolFoto() {
  const b = el("button", "vf-photo");
  b.type = "button";
  b.append(el("span", "", "📷"), el("span", "", "Foto Sampah untuk Wadah Lain"));
  b.addEventListener("click", fotoUntukWadahLain);
  return b;
}

function kartuMatang() {
  const kartu = el("section", "vf-card vf-hero vf-proses");
  kartu.append(el("span", "vf-pill vf-pill-matang", "Matang"));
  kartu.append(el("div", "vf-hero-icon", IKON_HERO[w.nama_resep] ?? "🌱"));
  kartu.append(el("p", "vf-matang-title", "Sudah Matang!"));
  kartu.append(el("p", "vf-hero-sub", "Siap dipanen hari ini!"));
  return kartu;
}

function tombolPanen() {
  const b = el("button", "vf-harvest", "Tandai Sudah Dipanen");
  b.type = "button";
  b.addEventListener("click", tandaiDipanen);
  return b;
}

// Sukses → ke halaman Wadah, tab "Sudah Dipanen"
async function tandaiDipanen() {
  if (sibuk) return;
  await jalankan(async () => {
    await api.tandaiSudahDipanen(w.id);
    w = null;
    S.workflowReturnScreen = "Wadah";
    closeWasteFlow("Wadah ditandai sudah dipanen");
    document.querySelector('[data-status-filter="harvested"]')?.click(); // ponytail: pakai handler tab yang ada (state + aria + render)
    hooks.updateWadahCards?.();
  });
}

function gambar() {
  if (!w) return;
  const gulir = vesselDetailContent.scrollTop;
  vesselDetailContent.dataset.tipe = TIPE[w.nama_resep] ?? "kompos";
  document.querySelector("#vessel-detail-heading").textContent = w.nama;
  if (modeMatang()) {
    vesselDetailContent.replaceChildren(
      ...[kartuMatang(), kartuResep(), kartuSampahBaca(), kartuBahanLain(), kartuLangkah(), kartuHapus()].filter(Boolean)
    );
    vesselDetailActions.replaceChildren(tombolPanen());
  } else if (modeFermentasi()) {
    vesselDetailContent.replaceChildren(
      ...[kartuProses(), kartuResep(), kartuSampahBaca(), kartuBahanLain(), kartuLangkah(), kartuAksi()].filter(Boolean)
    );
    vesselDetailActions.replaceChildren(tombolFoto());
  } else {
    vesselDetailContent.replaceChildren(
      ...[kartuStatus(), kartuResep(), kartuSampah(), kartuChecklist(), kartuAlat(), kartuLangkah(), kartuHapus()].filter(Boolean)
    );
    vesselDetailActions.replaceChildren(tombolMulai());
  }
  vesselDetailContent.scrollTop = gulir;
}

async function bukaDetail(id) {
  try {
    const [wadah, daftar] = await Promise.all([api.wadah(id), api.itemWadah(id)]);
    if (wadah.status === "sudah_dipanen") return;   // tidak ada detail & tidak ada pop up
    if (wadah.status !== "sedang_mengisi" && wadah.status !== "sedang_fermentasi") {
      showToast("Detail wadah untuk status ini belum tersedia");
      return;
    }
    w = wadah;
    items = daftar;
    editMode = false;
    sibuk = false;
    S.selectedVessel = w;
    S.workflowReturnScreen = phone.dataset.screen === "wadah" ? "Wadah" : (phone.dataset.screen === "home" ? "Beranda" : S.workflowReturnScreen);
    gambar();
    setWorkflowScreen("vessel-detail");
    vesselDetailContent.scrollTop = 0;
  } catch (e) {
    showToast(e.message || "Gagal memuat wadah, coba lagi.");
  }
}

export function initVesselDetail() {
  hooks.openVessel = bukaDetail;
}