// js/ui/components/confirm-dialog.js — dialog konfirmasi di dalam aplikasi (pengganti window.confirm).
// Pakai: if (await konfirmasi({ judul, pesan, ya: "Keluar", batal: "Batal", bahaya: true })) { ... }

export function konfirmasi({ judul = "Konfirmasi", pesan = "", ya = "Ya", batal = "Batal", bahaya = false } = {}) {
  const layer = document.querySelector("#confirm-layer");
  if (!layer) return Promise.resolve(window.confirm(pesan || judul));   // jaring pengaman bila markup tidak ada

  const elJudul = layer.querySelector("#confirm-title");
  const elPesan = layer.querySelector("#confirm-message");
  const tombolYa = layer.querySelector("#confirm-yes");
  const tombolBatal = layer.querySelector("#confirm-cancel");
  const fokusSebelumnya = document.activeElement;

  elJudul.textContent = judul;
  elPesan.textContent = pesan;
  elPesan.hidden = !pesan;
  tombolYa.textContent = ya;
  tombolBatal.textContent = batal;
  tombolYa.classList.toggle("danger", bahaya);
  layer.hidden = false;
  tombolBatal.focus();

  return new Promise((selesai) => {
    const tutup = (hasil) => {
      layer.hidden = true;
      layer.removeEventListener("click", klikLayer);
      document.removeEventListener("keydown", tombolKeyboard, true);
      fokusSebelumnya?.focus?.();
      selesai(hasil);
    };
    const klikLayer = (e) => {
      if (e.target === tombolYa) tutup(true);
      else if (e.target === tombolBatal || e.target.hasAttribute("data-confirm-backdrop")) tutup(false);
    };
    const tombolKeyboard = (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); tutup(false); }
    };
    layer.addEventListener("click", klikLayer);
    document.addEventListener("keydown", tombolKeyboard, true);
  });
}
