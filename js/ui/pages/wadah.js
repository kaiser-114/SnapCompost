// Semua Wadah: filter, urutan, total

import { wadahCards, wadahEmpty, brandCount } from "../core/dom.js";
import { S } from "../core/ui-state.js";
import { hooks } from "../core/hooks.js";
import { store, langganan, muatData } from "../core/store.js";
import { kartuHalamanWadah } from "../components/vessel-card.js";
import * as C from "../../logic/core.js";
import * as W from "../../logic/wadah.js";

// nilai atribut HTML → argumen W.filterDanUrut
const STATUS = { active: "aktif", harvested: "dipanen" };
const JENIS = { all: "semua", Kompos: "kompos", "Eco Enzim": "eco_enzyme" };
// data-sort di index.html sudah memakai nilai yang sama dengan argumen W.filterDanUrut
const URUT = new Set(["progress_tinggi", "progress_rendah", "terbaru", "terlama"]);

export function renderWadah() {
  try {
    const hariIni = C.hariIniWIB();
    const status = STATUS[S.wadahStatusFilter];
    const urut = URUT.has(S.wadahSort) ? S.wadahSort : "progress_tinggi";   // nilai lama ("progress") → default
    const daftar = W.filterDanUrut(store.wadah, { status, jenis: JENIS[S.wadahTypeFilter], urut }, hariIni);
    wadahCards.replaceChildren(...daftar.map((w) => kartuHalamanWadah(w, hariIni)));
    wadahEmpty.hidden = daftar.length > 0;
    wadahEmpty.textContent = !store.dimuat ? (store.galat || "Memuat wadah…") : "Tidak ada wadah untuk filter ini.";
    // Badge kanan atas: jumlah wadah pada tab terpilih (Masih Aktif = mengisi/fermentasi/matang; Sudah Dipanen = dipanen),
    // TIDAK ikut filter jenis (Kompos/Eco Enzim) maupun urutan.
    // ponytail: memanggil filterDanUrut sekali lagi (urut + render ikut dihitung); cukup untuk puluhan wadah.
    const jumlah = W.filterDanUrut(store.wadah, { status, jenis: "semua", urut }, hariIni).length;
    brandCount.textContent = `${jumlah} wadah`;
  } catch (e) {
    console.error("Gagal menggambar halaman Wadah:", e);
  }
}

export function initWadah() {
  hooks.updateWadahCards = muatData;
  langganan(renderWadah);

  document.querySelectorAll("[data-status-filter]").forEach((tab) => {
    tab.addEventListener("click", () => {
      S.wadahStatusFilter = tab.dataset.statusFilter;
      document.querySelectorAll("[data-status-filter]").forEach((item) => {
        item.setAttribute("aria-selected", String(item === tab));
      });
      renderWadah();
    });
  });

  document.querySelectorAll("[data-type-filter]").forEach((filter) => {
    filter.addEventListener("click", () => {
      S.wadahTypeFilter = filter.dataset.typeFilter;
      document.querySelectorAll("[data-type-filter]").forEach((item) => {
        item.setAttribute("aria-pressed", String(item === filter));
      });
      renderWadah();
    });
  });

  document.querySelectorAll(".wadah-sort").forEach((sortButton) => {
    sortButton.addEventListener("click", () => {
      S.wadahSort = sortButton.dataset.sort;
      document.querySelectorAll(".wadah-sort").forEach((item) => {
        item.setAttribute("aria-pressed", String(item === sortButton));
      });
      renderWadah();
    });
  });

  renderWadah();
}