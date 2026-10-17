// js/ui/pages/profile.js — Halaman "Profil Anda" (hanya tampilan).
// Data dari akun Google (nama, email, foto) hanya dibaca; tidak ada yang bisa diubah di sini.
// Tombol Keluar (#logout) ditangani main.js. Dipasang main.js lewat initProfil(user) setelah sesi terbukti ada.

import { phone } from "../core/dom.js";

const layar = document.querySelector("#profile-view");
const tombolBack = document.querySelector("#profile-back");
const tombolAvatar = document.querySelector("#user-avatar");
const foto = document.querySelector("#profile-img");
const inisial = document.querySelector("#profile-initial");
const elNama = document.querySelector("#profile-name");
const elEmail = document.querySelector("#profile-email");

let kembaliKe = "home";   // nilai data-screen sebelum Profil dibuka

function bukaProfil() {
  if (!layar.hidden) return;
  kembaliKe = phone.dataset.screen || "home";
  layar.hidden = false;
  layar.scrollTop = 0;
  phone.dataset.screen = "profil";
  history.pushState({ profil: true }, "");     // tombol back HP/browser menutup Profil, bukan keluar dari app
  tombolBack.focus();
}

function tutupProfil() {
  if (layar.hidden) return;
  layar.hidden = true;
  phone.dataset.screen = kembaliKe;
  tombolAvatar?.focus();
}

export function initProfil(user) {
  const meta = user?.user_metadata ?? {};
  const nama = String(meta.full_name || meta.name || "").trim();
  const email = String(user?.email || meta.email || "").trim();
  const url = String(meta.avatar_url || meta.picture || "").replace(/=s\d+-c$/, "=s256-c");  // foto lebih tajam untuk lingkaran besar

  elNama.textContent = nama || "-";
  elEmail.textContent = email || "-";
  inisial.textContent = ((nama || email).charAt(0) || "?").toUpperCase();   // fallback di bawah foto
  foto.alt = nama ? `Foto profil ${nama}` : "Foto profil";
  foto.onload = () => { foto.hidden = false; };
  foto.onerror = () => { foto.hidden = true; };
  foto.hidden = true;
  if (url) foto.src = url; else foto.removeAttribute("src");

  tombolAvatar?.addEventListener("click", bukaProfil);
  tombolBack.addEventListener("click", () => {
    if (history.state?.profil) history.back(); else tutupProfil();   // history.back() memicu popstate → tutupProfil
  });
  window.addEventListener("popstate", tutupProfil);
}
