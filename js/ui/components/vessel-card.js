// Kartu wadah di Beranda & Wadah.
// Data dari server (VIEW wadah_status_efektif) → kartu. Dibangun dengan DOM + textContent
// (nama wadah berasal dari user). Konvensi DOM mengikuti versi sebelumnya:
// data-vessel-id, .vessel-status-pill, ikon emoji.

import * as W from "../../logic/wadah.js";
import { hooks } from "../core/hooks.js";

const PILL = {
  sedang_mengisi: "MENGISI",
  sedang_fermentasi: "FERMENTASI",
  matang: "MATANG",
  sudah_dipanen: "DIPANEN",
};
const emoji = (namaResep) => (namaResep === "eco_enzyme" ? "🍊" : "🌿"); // kompos & kompos_kering = 🌿
const CHEVRON = `<svg class="chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m7 4 6 6-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const JAM = `<svg viewBox="0 0 12 12" fill="none" aria-hidden="true"><circle cx="6" cy="6" r="4.75" stroke="currentColor" stroke-width="1.3"/><path d="M6 3.4V6l1.8 1.1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const IKON_SVG = {
  eco: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3s6 6.2 6 10.5a6 6 0 0 1-12 0C6 9.2 12 3 12 3z"/></svg>`,
  kompos: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21v-9"/><path d="M12 13c0-3.6-2.6-5.6-6.5-5.6 0 3.6 2.6 5.6 6.5 5.6z"/><path d="M12 11c0-3 2.2-5 6.5-5 0 3-2.2 5-6.5 5z"/></svg>`,
};

function el(tag, kelas = "", teks) {
  const e = document.createElement(tag);
  if (kelas) e.className = kelas;
  if (teks != null) e.textContent = teks;
  return e;
}

function chevron() {
  const t = document.createElement("template");
  t.innerHTML = CHEVRON;
  return t.content.firstElementChild;
}

const jenis = (w) => (w.nama_resep === "eco_enzyme" ? "eco" : "kompos");

// baru = gaya Beranda (ikon SVG berwarna); tanpa baru = emoji (halaman Wadah)
function ikon(w, baru = false) {
  const s = baru
    ? el("span", `vessel-icon ${jenis(w)}`)
    : el("span", "vessel-icon", emoji(w.nama_resep));
  if (baru) s.innerHTML = IKON_SVG[jenis(w)];
  s.setAttribute("aria-hidden", "true");
  return s;
}

function info(k, w, baru = false) {
  const baris = el("div", "vessel-name-line");
  baris.append(el("span", "vessel-name", k.nama));
  // Beranda: pill status hanya untuk MATANG (halaman Wadah juga DIPANEN)
  if (!baru || k.status === "matang" || k.status === "sudah_dipanen") baris.append(el("span", "vessel-status-pill", PILL[k.status] ?? ""));
  const kotak = el("div", "vessel-info");
  kotak.append(baris);
  if (k.resep) kotak.append(el("span", baru ? `type-pill ${jenis(w)}` : "type-pill", k.resep));
  return kotak;
}

function bar(w, k) {
  const track = el("div", "progress-track");
  track.setAttribute("aria-label", `Progres ${k.persen}%`);
  const isi = el("div", w.nama_resep === "eco_enzyme" ? "progress-fill" : "progress-fill green");
  isi.style.width = `${k.persen}%`;
  track.append(isi);
  return track;
}

function dasar(kelas, w) {
  const a = el("article", kelas);
  a.dataset.vesselId = w.id;
  a.setAttribute("role", "button");
  a.tabIndex = 0;
  return a;
}

// Label kanan kaki kartu. `kelasSiap` = kelas untuk status siap dipanen / sudah dipanen.
function kananKaki(k, kelasSiap) {
  if (k.status === "sudah_dipanen") return el("span", kelasSiap, "Sudah dipanen");
  return el("span", k.status === "matang" ? kelasSiap : "", k.teksKanan);
}

// Kartu Beranda: bar saja, tanpa angka persen
export function kartuBeranda(w, hariIni) {
  const k = W.kartuWadah(w, hariIni);
  const a = dasar("vessel-card", w);
  const atas = el("div", "vessel-top");
  atas.append(ikon(w, true), info(k, w, true), chevron());
  a.append(atas);
  const kaki = el("div", "vessel-foot");
  if (k.persen === null) {
    kaki.append(el("span", "waiting-label", k.teksKanan));
  } else {
    a.append(bar(w, k));
    kaki.append(el("span", "", k.teksHari), kananKaki(k, "ready"));
  }
  a.append(kaki);
  return a;
}

// Kartu halaman Wadah: bar + angka persen. Kelas: jenis (eco/kompos) untuk warna, ready = matang,
// harvested = sudah dipanen (pudar), waiting = masih mengisi (tanpa bar).
export function kartuHalamanWadah(w, hariIni) {
  const k = W.kartuWadah(w, hariIni);
  const kelas = ["wadah-card", jenis(w)];
  if (k.status === "matang") kelas.push("ready");
  if (k.status === "sudah_dipanen") kelas.push("harvested");
  if (k.persen === null) kelas.push("waiting");
  const a = dasar(kelas.join(" "), w);
  if (k.status === "sudah_dipanen") {      // wadah sudah dipanen: hanya tampilan, tidak bisa dibuka
    delete a.dataset.vesselId;             // listener klik/keyboard memakai closest("[data-vessel-id]")
    a.removeAttribute("role");
    a.removeAttribute("tabindex");
  }
  const atas = el("div", "wadah-card-top");
  atas.append(ikon(w, true), info(k, w, true));
  if (k.persen !== null) atas.append(el("span", "wadah-percent", `${k.persen}%`));
  a.append(atas);
  const kaki = el("div", "wadah-card-foot");
  if (k.persen === null) {
    kaki.append(el("span", "waiting-label", k.teksKanan));
  } else {
    a.append(bar(w, k));
    kaki.append(el("span", "", k.teksHari));
    if (k.status === "matang" || k.status === "sudah_dipanen") {
      const selesai = el("span", "wadah-done");
      const t = document.createElement("template");
      t.innerHTML = JAM;
      selesai.append(t.content.firstElementChild, "Sudah matang");
      kaki.append(selesai);
    } else {
      kaki.append(el("span", "wadah-remaining", k.teksKanan));
    }
  }
  a.append(kaki);
  return a;
}

// Dipasang sekali; kartu dibuat ulang tiap render, jadi memakai delegasi.
export function initVesselCards() {
  const buka = (event) => {
    const kartu = event.target.closest("[data-vessel-id]");
    if (!kartu) return;
    if (event.type === "keydown") {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
    }
    hooks.openVessel(kartu.dataset.vesselId);
  };
  document.querySelectorAll("main .vessels, #wadah-cards").forEach((daftar) => {
    daftar.addEventListener("click", buka);
    daftar.addEventListener("keydown", buka);
  });
}