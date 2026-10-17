// js/app/auth.js — gerbang login Supabase Auth (Google). Layar login = ui/pages/login.js; di sini hanya logikanya.
// Alur redirect: setelah login halaman dimuat ulang dengan sesi, jadi tidak perlu onAuthStateChange / sembunyikanLogin.
// ponytail: keluar() juga reload, bukan berpindah layar manual.

// Hasil: sesi bila sudah login; bila belum, tampilkan layar login dan kembalikan null (UI/boot JANGAN dijalankan).
export async function pastikanLogin(supabase) {
  const { data, error } = await supabase.auth.getSession();
  if (data?.session) {
    const { error: e } = await supabase.auth.getUser();            // tanya server: akun masih ada?
    if (![401, 403, 404].includes(e?.status)) return data.session; // sukses, atau gagal karena jaringan: jangan paksa keluar
    await supabase.auth.signOut({ scope: 'local' });               // akun sudah dihapus/dicabut → buang sesi lokal
  }

  const { tampilkanLogin, initLogin } = await import('../ui/pages/login.js');
  const { hooks } = await import('../ui/core/hooks.js');

  hooks.masukDenganGoogle = async () => {
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + location.pathname },   // harus terdaftar di Supabase → Redirect URLs
    });
    if (e) throw new Error('Gagal masuk: ' + e.message);               // login.js menampilkannya di #login-error
  };

  // Galat dari Google/Supabase kembali lewat URL (mis. user menekan "Batal")
  const url = new URLSearchParams(location.hash.slice(1) || location.search);
  initLogin();
  tampilkanLogin(error?.message || url.get('error_description') || '');
  return null;
}

// Urutan penting: lepas token SEBELUM signOut (RPC butuh sesi). Gagal di langkah mana pun tidak boleh menahan logout.
export async function keluar(supabase, api) {
  try { const { lepasNotifikasi } = await import('./firebase.js'); await lepasNotifikasi(api); }
  catch (e) { console.error('Lepas token gagal:', e); }
  await supabase.auth.signOut();
  location.reload();
}
