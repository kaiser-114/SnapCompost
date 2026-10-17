// Pusat notifikasi (lonceng): isi panel + jumlah lencana.
// Sumber data:
//  - tanpa backend notifikasi: diturunkan dari wadah berstatus matang (store.wadah)
//  - dengan backend: initPusat({ ambil, hapus }) → baris tabel `notifikasi`
//    (id, id_wadah, jenis 'matang' | 'pemantauan', isi), sesuai catatan-notifikasi-2.md

import { hooks } from "../core/hooks.js";
import { store } from "../core/store.js";
import * as C from "../../logic/core.js";
import * as W from "../../logic/wadah.js";

const IKON = {
  eco: `<svg viewBox="0 0 24 24" fill="none"><path d="M12.2 2.7c-2.5 3.2-4.5 5.7-4.5 8.4a4.5 4.5 0 0 0 9 0c0-2.7-2-5.2-4.5-8.4Z" fill="#8bd0e6" stroke="#53a9c5" stroke-width="1.2"/><path d="M12.2 9.6c-1.2 1.6-1.9 2.6-1.9 3.7a1.9 1.9 0 0 0 3.8 0c0-1.1-.7-2.1-1.9-3.7Z" fill="#fff" opacity=".85"/></svg>`,
  kompos: `<svg viewBox="0 0 24 24" fill="none"><path d="M18.7 4.1C11.1 4 5.7 6.4 4.5 10.8c-.7 2.7 1.1 5 3.8 4.7 4-.4 8.3-4.8 10.4-11.4Z" fill="#a8d99a" stroke="#79b875" stroke-width="1.1" stroke-linejoin="round"/><path d="M3.5 19c1.8-4.8 5-7.9 9.7-10" stroke="#73ab6c" stroke-width="1.2" stroke-linecap="round"/></svg>`,
};

let daftar = [];
let opsi = {};

const $ = (s) => document.querySelector(s);

function el(tag, kelas = "", teks) {
  const e = document.createElement(tag);
  if (kelas) e.className = kelas;
  if (teks != null) e.textContent = teks;
  return e;
}

// Tanpa backend: wadah matang = notifikasi "Siap dipanen!"
function turunan() {
  const hariIni = C.hariIniWIB();
  return (store.wadah ?? [])
    .filter((w) => W.kartuWadah(w, hariIni).status === "matang")
    .map((w) => ({ id: `matang-${w.id}`, id_wadah: w.id, jenis: "matang", isi: "Siap dipanen!", lokal: true }));
}

function butir(n, hariIni) {
  const w = (store.wadah ?? []).find((x) => String(x.id) === String(n.id_wadah));
  const k = w ? W.kartuWadah(w, hariIni) : null;
  const nama = k?.nama ?? "Wadah";

  const a = el("article", "notification-item");
  const ik = el("span", "notification-vessel-icon");
  ik.setAttribute("aria-hidden", "true");
  ik.innerHTML = IKON[w?.nama_resep === "eco_enzyme" ? "eco" : "kompos"];

  const isi = el("div", "notification-copy");
  const desk = el("p", "notification-description");
  desk.append(k?.resep ? `${k.resep} · ` : "", n.jenis === "matang" ? el("strong", "", n.isi) : n.isi);
  isi.append(el("span", "notification-name", nama), desk);

  const lihat = el("button", "notification-view", "Lihat");
  lihat.type = "button";
  lihat.dataset.notificationName = nama;
  lihat.dataset.idNotifikasi = n.id;
  lihat.dataset.idWadah = n.id_wadah;

  a.append(ik, isi, lihat);
  return a;
}

function render() {
  const hariIni = C.hariIniWIB();
  const list = $(".notification-list");
  if (list) {
    list.replaceChildren(...(daftar.length
      ? daftar.map((n) => butir(n, hariIni))
      : [el("p", "notification-empty", "Belum ada notifikasi.")]));
  }
  const jml = daftar.length;
  const lencana = $(".notification-dot");
  if (lencana) {
    lencana.textContent = jml > 9 ? "9+" : String(jml);
    lencana.hidden = jml === 0;
  }
  $(".notification")?.setAttribute(
    "aria-label", jml > 0 ? `Buka notifikasi, ${jml} belum dibuka` : "Buka notifikasi");
}

function tutupPanel() {
  const layer = $("#notification-layer");
  if (layer) layer.hidden = true;
  $(".notification")?.setAttribute("aria-expanded", "false");
}

// Dipanggil tombol "Lihat", dan nanti oleh pesan service worker ('buka_notifikasi') / ?buka_wadah=
async function buka(idNotifikasi, idWadah) {
  tutupPanel();
  const n = daftar.find((x) => String(x.id) === String(idNotifikasi));
  if (n && !n.lokal && opsi.hapus) {
    try { await opsi.hapus(n.id); } catch (e) { console.error("Gagal menghapus notifikasi:", e); }
  }
  if (n && !n.lokal) { daftar = daftar.filter((x) => x !== n); render(); }
  hooks.openVessel(idWadah ?? n?.id_wadah);
}

function sinkron() {
  if (!opsi.ambil) { daftar = turunan(); render(); }
}

async function muat() {
  if (!opsi.ambil) return sinkron();
  try {
    daftar = (await opsi.ambil()) ?? [];
    render();
  } catch (e) {
    console.error("Gagal memuat notifikasi:", e);
  }
}

function init(o = {}) {
  opsi = o;
  $(".notification-list")?.addEventListener("click", (event) => {
    const tombol = event.target.closest(".notification-view");
    if (!tombol) return;
    event.stopPropagation(); // cegah penangan lama (data-notification-name), bila ada
    buka(tombol.dataset.idNotifikasi, tombol.dataset.idWadah);
  });
  sinkron();
  return muat();
}

export const pusat = { init, sinkron, muat, muatAman: muat, buka, jumlah: () => daftar.length };
