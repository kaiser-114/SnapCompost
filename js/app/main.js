// js/app/main.js  (satu-satunya entri, dimuat index.html)
// Urutan: login → UI → boot. Tanpa sesi, hanya layar login yang tampil. Penyebab kegagalan ditampilkan di layar.
// Layar pembuka (#splash di index.html) dilaporkan lewat sp(persen, teks) di tiap tahap yang selesai.

const sp = (p, t) => window.__splash?.set(p, t);
const tutupSplash = () => window.__splash?.selesai();

const masalah = [];

// ponytail: bila modul gagal diunduh (cache usang setelah deploy / jaringan putus), muat ulang halaman SATU kali.
// Mengulang import() yang sama tidak membantu: browser menyimpan hasil gagalnya. Batas: sekali per sesi tab; flag dihapus setelah app siap.
const KUNCI_ULANG = "sudah-reload-modul";
async function muat(impor) {
  try { return await impor(); }
  catch (e) {
    let sudah = false;
    try { sudah = !!sessionStorage.getItem(KUNCI_ULANG); sessionStorage.setItem(KUNCI_ULANG, "1"); } catch {}
    if (sudah) throw e;
    location.reload();
    return new Promise(() => {});   // tahan alur sampai halaman dimuat ulang; tidak menampilkan galat sesaat
  }
}

function catat(tahap, e) {
  console.error(`${tahap} gagal:`, e);
  masalah.push(`${tahap}: ${e?.message ?? e}`);
}

function tampilkanMasalah() {
  tutupSplash();                  // jangan biarkan layar pembuka menutupi kotak galat
  if (!masalah.length) return;
  const kotak = document.createElement("div");
  kotak.id = "app-masalah";
  kotak.setAttribute("role", "alert");
  kotak.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:99999;max-height:40vh;overflow:auto;padding:10px 12px;"
    + "background:#fff3f0;color:#8a1c0f;border-top:2px solid #d9503f;font:12px/1.4 system-ui,sans-serif;white-space:pre-wrap";
  kotak.textContent = "Aplikasi belum siap:\n- " + masalah.join("\n- ");
  document.body.append(kotak);
}

async function start() {
  let supabase, auth, b;
  try {
    sp(15, "Menyiapkan koneksi…");
    ({ supabase } = await muat(() => import("./supabase.js")));           // ringan: hanya klien Supabase
    sp(40, "Menghubungkan ke server…");
    auth = await muat(() => import("./auth.js"));
    sp(60, "Memeriksa sesi…");
    if (!await auth.pastikanLogin(supabase)) { sp(100, "Siap"); tutupSplash(); return; }   // belum login: layar login aktif
    sp(75, "Memuat aplikasi…");
    b = await muat(() => import("./bootstrap.js"));                       // onnxruntime dan modul berat baru dimuat setelah login
    sp(90, "Menyiapkan tampilan…");
  } catch (e) { catat("Login", e); tampilkanMasalah(); return; }

  // Sesi dicabut saat aplikasi terbuka (akun dihapus, token tidak bisa diperbarui): kembali ke layar login
  supabase.auth.onAuthStateChange(ev => { if (ev === "SIGNED_OUT") location.reload(); });

  try {
    document.getElementById("app").dataset.screen = "home";   // index.html mulai dari "login" (kosong); Beranda tampil setelah login terbukti
    await b.muatReferensi();    
    const { mulaiUI } = await muat(() => import("../ui/main-ui.js"));
    mulaiUI();                    // pasang UI
  } catch (e) { catat("Memasang UI", e); }

  // Foto profil Google di header (sebelah lonceng). Gagal di sini tidak boleh menghentikan app.
  try {
    const { setAvatarUser } = await muat(() => import("../ui/components/user-avatar.js"));
    const { data: { session } } = await supabase.auth.getSession();   // dibaca dari penyimpanan lokal, tanpa jaringan
    setAvatarUser(session?.user ?? null);
    window.dispatchEvent(new CustomEvent("pengguna-siap", { detail: session?.user ?? null }));   // sapaan Beranda
    const { initProfil } = await muat(() => import("../ui/pages/profile.js"));
    initProfil(session?.user ?? null);          // halaman Profil Anda (dibuka lewat foto profil)
  } catch (e) { console.warn("Foto profil gagal dipasang:", e); }

  try { sessionStorage.removeItem(KUNCI_ULANG); } catch {}
  sp(100, "Siap"); tutupSplash();

  // Modul dialog dimuat lebih awal (di latar belakang) supaya pop up langsung muncul saat Keluar ditekan
  const muatDialog = import("../ui/components/confirm-dialog.js");
  muatDialog.catch(() => {});        // galat ditangani saat tombol ditekan

  document.getElementById("logout")?.addEventListener("click", async (e) => {
    const tombol = e.currentTarget;
    const loading = document.getElementById("logout-loading");
    const teksLoading = loading.querySelector("p");
    if (tombol.disabled) return;
    tombol.disabled = true;

    // Bila modul dialog belum siap (jaringan lambat), tampilkan loading; tidak muncul bila siap dalam 150 ms
    const timer = setTimeout(() => { teksLoading.textContent = "Memuat…"; loading.hidden = false; }, 150);
    let konfirmasi;
    try { ({ konfirmasi } = await muatDialog); }
    catch (err) { console.error("Dialog gagal dimuat:", err); konfirmasi = async (o) => window.confirm(o.judul); }
    clearTimeout(timer);
    loading.hidden = true;

    const yakin = await konfirmasi({
      judul: "Keluar dari akun?",
      pesan: "Kamu perlu masuk lagi dengan Google untuk memakai aplikasi.",
      ya: "Keluar", batal: "Batal", bahaya: true,
    });
    if (!yakin) { tombol.disabled = false; return; }

    teksLoading.textContent = "Sedang keluar…";
    loading.hidden = false;          // tetap tampil sampai halaman dimuat ulang
    try {
      // maksimal 4 detik; bila keluar() menggantung atau gagal, lanjut ke langkah pengaman
      await Promise.race([auth.keluar(supabase, b.api), new Promise((r) => setTimeout(r, 4000))]);
    } catch (err) { console.error("Keluar gagal:", err); }
    try { await supabase.auth.signOut({ scope: "local" }); } catch (err) { console.warn("signOut lokal gagal:", err); }
    location.reload();               // tanpa sesi → layar login
  });

  try {
    await b.boot();               // referensi → api → pusat → detektor
  } catch (e) { catat("Boot", e); }

  import("./push-sambung.js").then(m => m.sambungkanPush(b.api)).catch(e => console.warn("Push gagal disambung:", e));

  tampilkanMasalah();
}

start();
window.addEventListener("unhandledrejection", (e) => { catat("Error tak tertangkap", e.reason); tampilkanMasalah(); });