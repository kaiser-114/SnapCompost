// js/ui/pages/alokasi.js — setelah Perlakuan Khusus (§2.1):
//   [Tambah ke wadah yang ada, bila ada kandidat] → [sisa? pilih jenis olahan → Beri Nama Wadah] → satu RPC konfirmasi_alokasi.
// Logika murni ada di logic/alokasi.js (sesi.atur, susunRencana, kirimAlokasi); file ini hanya menggambar dan meneruskan.
// ponytail: payload wadah_baru tidak membawa nama (§7.1: server menamai otomatis). Nama dari kolom diterapkan SETELAH sukses lewat api.gantiNama;
// bila gagal, wadah tetap ada dan namanya bisa diganti di detail wadah. Upgrade: kirim nama di payload RPC.
// ponytail: gagal memuat daftar wadah / isi wadah = alur jatuh ke "semua jadi wadah baru" tanpa pesan. Upgrade: tampilkan pesan + tombol coba lagi.
import * as C from "../../logic/core.js";
import { buatSesiAlokasi, susunRencana, kirimAlokasi } from "../../logic/alokasi.js";
import { api } from "../../app/bootstrap.js";
import { recipeList, recipeError } from "../core/dom.js";
import { hooks } from "../core/hooks.js";
import { setWorkflowScreen, closeWasteFlow } from "../core/workflow.js";

const IKON = { kompos: "🌱", kompos_kering: "🍂", eco_enzyme: "💧" };
const $ = (s) => document.querySelector(s);

let sesi = null;        // sesi alokasi; satu per batch. Retry memakai payload yang sama (kontrak §2.1)
let batch = [];         // batch asli dari layar jumlah
let sisaBatch = [];     // bahan yang belum dialokasikan → jadi wadah baru
let itemLamaPer = {};   // { id_wadah: item_wadah[] } untuk wadah kandidat
let pilihan = "";

const el = (tag, cls, teks) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (teks != null) n.textContent = teks;
  return n;
};
const baris = (kiri, kanan, cls) => {
  const li = el("li", cls);
  li.append(el("span", null, kiri), el("b", null, kanan));
  return li;
};
const labelSampah = (nama) => C.ref().peta.get(nama)?.label_tampilan ?? nama;
const labelResep = (nama) => C.ref().resep.find((r) => r.nama === nama)?.label_tampilan ?? nama;
const pasang = (node, pesan) => { node.textContent = pesan; node.hidden = !pesan; };
const galat = (p) => pasang(recipeError, p);
const galatSimpan = (p) => pasang($("#vessel-error"), p);
const galatAlokasi = (p) => pasang($("#alokasi-error"), p);

// ---------- Layar 1: tambah ke wadah yang ada ----------
function segarkanSisa() {
  const sisa = sesi.batchSisa().length;
  batch.forEach((e) => {
    const s = sesi.satuanInput(e.id_entri);
    $(`#sisa-${CSS.escape(e.id_entri)}`).textContent = `${sesi.sisaTampil(e.id_entri)} ${s.satuan}`;
  });
  $("#alokasi-lanjut").textContent = sisa ? "Lanjutkan" : "Simpan";
}

function tampilAlokasi() {
  $("#alokasi-bahan").replaceChildren(...batch.map((e) => {
    const li = baris(labelSampah(e.nama_sampah), "");
    li.lastChild.id = `sisa-${e.id_entri}`;
    return li;
  }));
  $("#alokasi-wadah").replaceChildren(...sesi.kandidat.map(({ wadah: w, id_entri_cocok }) => {
    const kartu = el("section", "vessel-card");
    kartu.dataset.resep = w.nama_resep;
    const kepala = el("header", "vessel-alat-head");
    kepala.append(el("span", null, IKON[w.nama_resep] ?? "🌱"), el("h3", "vessel-heading", w.nama), el("small", null, labelResep(w.nama_resep)));
    const isi = el("ul", "vessel-rows vessel-card-body");
    isi.append(...id_entri_cocok.map((idE) => {
      const e = batch.find((x) => x.id_entri === idE);
      const s = sesi.satuanInput(idE);
      const input = el("input");
      input.type = "text";
      input.inputMode = "numeric";
      input.placeholder = "0";
      input.setAttribute("aria-label", `${labelSampah(e.nama_sampah)} untuk ${w.nama} (${s.satuan})`);
      input.addEventListener("change", () => {
        const r = sesi.atur(w.id, idE, input.value);
        if (!r.ok) { input.value = sesi.jumlahTampil(w.id, idE) || ""; return galatAlokasi(r.pesan); }
        input.value = sesi.jumlahTampil(w.id, idE) || "";
        galatAlokasi("");
        segarkanSisa();
      });
      const li = el("li");
      li.append(el("span", null, labelSampah(e.nama_sampah)), input, el("small", null, s.satuan));
      return li;
    }));
    kartu.append(kepala, isi);
    return kartu;
  }));
  galatAlokasi("");
  $("#alokasi-lanjut").disabled = false;
  segarkanSisa();
  setWorkflowScreen("alokasi");
}

function lanjutAlokasi() {
  let r;
  try { r = susunRencana(sesi, itemLamaPer, null); } catch (e) { return galatAlokasi(e.message); }
  if (r.sisaTidakBisaDiproses) {
    const rinci = r.penghalang.filter((p) => p.bahan.length).map((p) => `${p.label} tidak menerima ${p.bahan.join(", ")}`).join("; ");
    return galatAlokasi(`Sisa bahan tidak cocok untuk satu resep pun (${rinci}). Alokasikan ulang ke wadah di atas atau kembali dan ubah bahan.`);
  }
  if (!r.batchSisa.length) return kirimLalu(null, "", $("#alokasi-lanjut"), galatAlokasi);   // semua habis dialokasikan: tidak ada wadah baru
  sisaBatch = r.batchSisa;
  tampilResep(r.opsiResep);
}

// ---------- Layar 2: pilih jenis olahan (untuk sisa bahan) ----------
function pilih(nama) {
  pilihan = nama;
  galat("");
  recipeList.querySelectorAll(".recipe-card").forEach((k) => {
    const dipilih = k.dataset.recipe === nama;
    k.setAttribute("aria-pressed", String(dipilih));
    k.querySelector("input").checked = dipilih;
  });
}

function tampilResep(opsi) {   // opsi = nama resep yang cocok untuk sisaBatch; urutan JSON, pertama = default (§2)
  recipeList.replaceChildren(...opsi.map((nama) => {
    const r = C.ref().resep.find((x) => x.nama === nama);
    const kartu = el("button", "recipe-card");
    kartu.type = "button";
    kartu.dataset.recipe = nama;
    const info = el("span", "recipe-card-info");
    info.append(el("strong", null, r.label_tampilan ?? nama), el("span", null, r.deskripsi ?? ""));
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "recipe-choice";
    radio.tabIndex = -1;
    kartu.append(el("span", "recipe-card-icon", IKON[nama] ?? "🌱"), info, radio);
    kartu.addEventListener("click", () => pilih(nama));
    return kartu;
  }));
  $("#recipe-continue").disabled = false;
  // tombol kembali: ke layar alokasi bila ada, kalau tidak ke ringkasan jumlah (dibaca saat diklik oleh workflow.js)
  $('[data-workflow-screen="type-select"] [data-workflow-back]').dataset.workflowBack = sesi.kandidat.length ? "alokasi" : "quantity-confirm";
  galat(opsi.length ? "" : "Bahan ini tidak cocok untuk resep mana pun. Kembali dan ubah bahan.");
  pilih(opsi[0] ?? "");
  setWorkflowScreen("type-select");
}

// ---------- Layar 3: Beri Nama Wadah (pratinjau; belum menulis apa pun ke server) ----------
function pratinjau() {
  if (!pilihan) return galat("Pilih jenis olahan terlebih dahulu.");
  const r = C.ref().resep.find((x) => x.nama === pilihan);
  $("#vessel-preview").dataset.resep = pilihan;
  $("#vessel-icon").textContent = IKON[pilihan] ?? "🌱";
  $("#vessel-recipe-name").textContent = r.label_tampilan ?? pilihan;
  $("#vessel-recipe-meta").textContent = `${C.hitungJadwal(pilihan).estimasi_durasi_hari} hari`;   // = base_durasi_hari

  // Hasil akhir + manfaat dari resep (bentuk_akhir, manfaat[]); bagian yang kosong tidak ditampilkan
  const detail = $("#vessel-recipe-detail");
  const bagian = [];
  if (r.bentuk_akhir) bagian.push(el("dt", null, "Hasil akhir"), el("dd", null, r.bentuk_akhir));
  if (r.manfaat?.length) {
    const daftar = el("ul");
    daftar.append(...r.manfaat.map((m) => el("li", null, m)));
    const dd = el("dd");
    dd.append(daftar);
    bagian.push(el("dt", null, "Manfaat & kegunaan"), dd);
  }
  detail.replaceChildren(...bagian);
  detail.hidden = !bagian.length;

  $("#vessel-sampah").replaceChildren(...sisaBatch.map((e) => baris(labelSampah(e.nama_sampah), `${e.berat_gram}g`)));

  const items = sisaBatch.map((e) => ({ nama_sampah: e.nama_sampah, berat: e.berat_gram }));
  const pendukung = Object.entries(C.hitungBahanPendukung(items, pilihan));   // sudah membuang yang bernilai 0
  $("#vessel-support").hidden = !pendukung.length;
  $("#vessel-pendukung").replaceChildren(...pendukung.map(([kunci, jumlah]) => {
    const { teks, satuan } = C.teksBahan(kunci);
    return baris(teks, `${jumlah}${satuan}`, "vessel-dot");
  }));

  const alat = C.ref().alat_modifikasi.filter((a) => a.nama_resep === pilihan);
  $("#vessel-alat-card").hidden = !alat.length;
  $("#vessel-alat-count").textContent = `${alat.length} alat`;
  $("#vessel-alat").replaceChildren(...alat.map((a) => {
    const blok = el("div", "vessel-alat-item");
    const langkah = el("ol");
    langkah.append(...a.spesifikasi.map((t) => el("li", null, t)));
    blok.append(el("strong", null, a.nama_komponen ?? "Alat"), langkah);
    return blok;
  }));

  galatSimpan("");
  $("#save-vessel").disabled = false;
  setWorkflowScreen("create-vessel");
}

// ---------- Kirim (satu RPC). resep = null bila tidak ada wadah baru ----------
async function kirimLalu(resep, nama, tombol, tampilGalat) {
  tombol.disabled = true;
  recipeList.querySelectorAll("button").forEach((k) => { k.disabled = true; }); // retry = payload yang sama persis
  tampilGalat("");
  try {
    await kirimAlokasi(sesi, itemLamaPer, resep, api);
  } catch (e) {
    tampilGalat(e.message);
    tombol.disabled = false;   // tekan lagi = kirim ulang payload yang sama (id stabil, tidak menggandakan item/wadah)
    return;
  }
  let pesan = resep ? "Wadah berhasil dibuat" : "Sampah berhasil ditambahkan";
  if (resep && nama) {
    try { await api.gantiNama(sesi.idTetap(`wadah_baru:${resep}`), nama); }
    catch { pesan = "Wadah dibuat, tetapi nama belum terganti. Ubah dari detail wadah."; }
  }
  closeWasteFlow(pesan);
  hooks.updateHome();
  hooks.updateWadahCards();
}

// ---------- Masuk dari layar jumlah ----------
async function mulai(batchBaru) {
  batch = batchBaru;
  sisaBatch = batchBaru;
  try {
    sesi = buatSesiAlokasi(batch, await api.daftarWadah());
    itemLamaPer = Object.fromEntries(await Promise.all(
      sesi.kandidat.map(async (k) => [k.wadah.id, await api.itemWadah(k.wadah.id)])));
  } catch {
    sesi = buatSesiAlokasi(batch, []);
    itemLamaPer = {};
  }
  if (sesi.kandidat.length) return tampilAlokasi();
  tampilResep(C.penentuanResep(batch));
}

export function initAlokasi() {
  hooks.lanjutDariJumlah = mulai;
  $("#alokasi-lanjut").addEventListener("click", lanjutAlokasi);
  $("#recipe-continue").addEventListener("click", pratinjau);
  $("#save-vessel").addEventListener("click", () =>
    kirimLalu(pilihan, $("#new-vessel-name").value.trim(), $("#save-vessel"), galatSimpan));
}