// Beranda: sapaan, dampak, ringkasan, daftar wadah aktif, menu urutan

import { homeGreeting, impactCopy, homeStats, vesselsList, sortToggle, sortMenu } from "../core/dom.js";
import { S } from "../core/ui-state.js";
import { hooks } from "../core/hooks.js";
import { store, langganan, muatData } from "../core/store.js";
import { kartuBeranda } from "../components/vessel-card.js";
import * as C from "../../logic/core.js";
import * as W from "../../logic/wadah.js";
import { pusat } from "../components/notification-center.js";

// Urutan opsi di index.html → argumen W.daftarHomepage
const URUT = ["progress_tinggi", "progress_rendah", "terbaru", "terlama"];

function pesanKosong(teks) {
  const p = document.createElement("p");
  p.className = "wadah-empty";
  p.textContent = teks;
  return p;
}

// <span class="stat {kelas}">LABEL <b>nilai</b></span>
function pil(kelas, label, nilai) {
  const s = document.createElement("span");
  s.className = `stat ${kelas}`;
  const b = document.createElement("b");
  b.textContent = nilai;
  s.append(label, b);
  return s;
}

// Nama akun Google; diisi main.js lewat event "pengguna-siap" setelah sesi terbaca
let namaGoogle = "";

// Nama depan untuk sapaan. Bila kata pertama hanya singkatan "Muhammad", pakai kata kedua.
const SINGKATAN_MUHAMMAD = /^(m|md|muh|muhd|moh|muhamad|muhammad|mohamad|mohammad)\.?$/i;
function namaPanggilan(nama) {
  const kata = String(nama || "").trim().split(/\s+/).filter(Boolean);
  if (!kata.length) return "";
  return (SINGKATAN_MUHAMMAD.test(kata[0]) && kata[1]) ? kata[1] : kata[0];
}

export function renderHome() {
  try {
    const hariIni = C.hariIniWIB();

    const profil = store.profil;
    const nama = String(profil?.nama ?? profil?.full_name ?? profil?.name ?? "").trim() || namaGoogle;
    const depan = namaPanggilan(nama);
    homeGreeting.textContent = depan ? `Selamat datang, ${depan}!` : "Selamat datang!";

    const gram = profil?.total_gram_dimanfaatkan ?? 0;
    const tebal = document.createElement("strong");
    if (gram > 0) {
      tebal.textContent = "Pertahankan!";
      impactCopy.replaceChildren(
        `Kamu sudah memanfaatkan ${W.teksTotalSampah(gram)}`,
        document.createElement("br"), "sampah organik", tebal
      );
    } else {
      tebal.textContent = "Yuk, Mulai!";
      impactCopy.replaceChildren(
        "Kamu belum memanfaatkan",
        document.createElement("br"), "sampah organik", tebal
      );
    }

    const d = W.dashboard(store.wadah, hariIni);
    homeStats.replaceChildren(
      pil("total", "TOTAL WADAH AKTIF ANDA", d.totalAktif),
      pil("mengisi", "MENGISI", d.mengisi ?? 0),
      pil("proses", "PROSES", d.proses),
      pil("matang", "MATANG", d.matang)
    );

    const daftar = W.daftarHomepage(store.wadah, hariIni, S.homeSort);
    if (daftar.length) {
      vesselsList.replaceChildren(...daftar.map((w) => kartuBeranda(w, hariIni)));
    } else {
      vesselsList.replaceChildren(pesanKosong(
        !store.dimuat ? (store.galat || "Memuat wadah…") : "Belum ada wadah aktif. Ketuk Foto untuk memulai."));
    }
  } catch (e) {
    console.error("Gagal menggambar Beranda:", e);
  }
}

export function initHome() {
  hooks.updateHome = muatData;
  window.addEventListener("pengguna-siap", (e) => {
    const meta = e.detail?.user_metadata ?? {};
    namaGoogle = String(meta.full_name || meta.name || "").trim();
    renderHome();
  });
  langganan(renderHome);
  langganan(() => pusat.sinkron());
  // Saat backend notifikasi siap: pusat.init({ ambil: api.daftarNotifikasi, hapus: api.hapusNotifikasi })
  pusat.init();

  sortToggle.addEventListener("click", () => {
    const isOpen = sortToggle.getAttribute("aria-expanded") === "true";
    sortToggle.setAttribute("aria-expanded", String(!isOpen));
    sortMenu.classList.toggle("open", !isOpen);
  });

  sortMenu.addEventListener("click", (event) => {
    const option = event.target.closest('[role="option"]');
    if (!option) return;
    const semua = [...sortMenu.querySelectorAll('[role="option"]')];
    semua.forEach((item) => {
      item.setAttribute("aria-selected", String(item === option));
    });
    S.homeSort = URUT[semua.indexOf(option)] ?? S.homeSort;
    sortToggle.querySelector("span").textContent = option.textContent;
    sortToggle.setAttribute("aria-expanded", "false");
    sortMenu.classList.remove("open");
    renderHome();
  });

  renderHome();
  muatData();
}