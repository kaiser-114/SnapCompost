// Pembaruan wadah: progres dihitung per hari kalender WIB dan status "matang" ditentukan server,
// jadi data dimuat ulang saat tanggal WIB berganti dan saat tab kembali terlihat.
// (Pembaruan layar detail wadah ikut ditulis ulang bersama layar detail.)

import { muatData } from "../core/store.js";
import * as C from "../../logic/core.js";

export function startVesselTicker() {
  let tanggal = C.hariIniWIB();
  window.setInterval(() => {
    const sekarang = C.hariIniWIB();
    if (sekarang === tanggal) return;
    tanggal = sekarang;
    muatData();
  }, 60000);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) muatData();
  });
}