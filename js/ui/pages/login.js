// js/ui/pages/login.js — Layar login (hanya tampilan). Logika masuk sebenarnya diisi lewat hooks.masukDenganGoogle.
// Tidak ada pengetahuan tentang Supabase/Firebase di sini: bootstrap yang memutuskan kapan layar ini tampil/hilang.

import { phone } from "../core/dom.js";
import { hooks } from "../core/hooks.js";
import { showScreen } from "../core/navigation.js";

const tombol = document.querySelector("#login-google");
const labelTombol = document.querySelector("#login-google-label");
const galat = document.querySelector("#login-error");
const layar = document.querySelector("#login-view");

export function setSibukLogin(sibuk) {
  tombol.disabled = sibuk;
  labelTombol.textContent = sibuk ? "Memproses…" : "Masuk dengan Google";
}

export function tampilGalatLogin(pesan = "") {
  galat.textContent = pesan;
  galat.hidden = !pesan;
}

export function tampilkanLogin(pesan = "") {
  layar.hidden = false;
  phone.dataset.screen = "login";
  setSibukLogin(false);
  tampilGalatLogin(pesan);
}

// Dipanggil setelah sesi login terbukti ada.
export function sembunyikanLogin() {
  layar.hidden = true;
  showScreen("Beranda");
}

export function initLogin() {
  tombol.addEventListener("click", async () => {
    if (tombol.disabled) return;                       // dobel ketuk: dua signInWithOAuth saling menimpa code_verifier PKCE → login gagal
    tampilGalatLogin("");
    setSibukLogin(true);
    try {
      await hooks.masukDenganGoogle();                 // sukses = browser sedang dialihkan ke Google; tombol tetap terkunci
    } catch (error) {
      console.error("Login gagal:", error);
      tampilGalatLogin(error?.message || "Gagal masuk. Coba lagi.");
      setSibukLogin(false);                            // hanya saat gagal (dulu di finally)
    }
  });
  // ponytail: di TWA, Google dibuka di tab terpisah; bila user menutupnya, halaman ini tetap "Memproses…". Buka kunci saat app kembali tampil.
  document.addEventListener("visibilitychange", () => { if (!document.hidden && layar.hidden === false) setSibukLogin(false); });
}