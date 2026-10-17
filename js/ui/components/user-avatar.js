// Foto profil di header. Hanya tampilan: main.js memanggil setAvatarUser(user) saat sesi ada.

const wadah = document.querySelector("#user-avatar");
const inisial = document.querySelector("#user-avatar-initial");
const img = document.querySelector("#user-avatar-img");

export function setAvatarUser(user) {
  if (!wadah) return;
  if (!user) {
    wadah.hidden = true;
    img.hidden = true;
    img.removeAttribute("src");
    return;
  }

  const meta = user.user_metadata ?? {};
  const nama = String(meta.full_name || meta.name || user.email || "").trim();
  const url = meta.avatar_url || meta.picture || "";

  wadah.hidden = false;
  wadah.title = nama;
  inisial.textContent = (nama.charAt(0) || "?").toUpperCase(); // fallback di bawah foto
  img.alt = nama ? `Foto profil ${nama}` : "Foto profil";

  img.onload = () => { img.hidden = false; };
  img.onerror = () => { img.hidden = true; };                  // gagal dimuat → tampil inisial
  img.hidden = true;
  if (url) img.src = url; else img.removeAttribute("src");
}