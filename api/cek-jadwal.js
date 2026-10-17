// api/cek-jadwal.js — dipanggil Vercel Cron (GET) sekali sehari. Rancangan: catatan-notifikasi-2.md §2.
// Urutan per wadah: KLAIM (update bersyarat) → catat ke tabel notifikasi → cek ulang → kirim FCM (data-only) terakhir.
import { createClient } from '@supabase/supabase-js';
import admin from 'firebase-admin';
import { hariIniWIB, tambahHari, selisihHari } from '../js/logic/core.js';   // SESUAIKAN path ke core.js bila letaknya berbeda

const LANGKAH_PANTAU = { kompos: 4, kompos_kering: 4, eco_enzyme: 5 };   // samakan dengan langkah_resep di JSON
const teksPantau = r => LANGKAH_PANTAU[r]
  ? `Waktunya pemantauan berkala, lihat langkah resep ke-${LANGKAH_PANTAU[r]}`
  : 'Waktunya pemantauan berkala, lihat langkah resep';
const FCM_OPSI = { webpush: { headers: { Urgency: 'high', TTL: '86400' } } };   // data-only + prioritas tinggi (Doze)
// Cocokkan sebagian kode (bukan persis): firebase-admin v14 merombak penanganan error, bentuk kode bisa berbeda dari v13.
const TOKEN_MATI = ['registration-token-not-registered', 'invalid-registration-token'];
const tokenMati = e => TOKEN_MATI.some(k => String(e?.code ?? '').includes(k) || String(e?.errorInfo?.code ?? '').includes(k));

let supabase;
function siapkan() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FIREBASE_SERVICE_ACCOUNT } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !FIREBASE_SERVICE_ACCOUNT) throw new Error('Env var belum lengkap');
  supabase ??= createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  if (!admin.apps.length) {
    const akun = JSON.parse(Buffer.from(FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf8'));
    admin.initializeApp({ credential: admin.credential.cert(akun) });
  }
}

// Kirim ke semua perangkat milik user. Semua nilai data WAJIB string. Token yang ditolak FCM dihapus.
async function kirimFCM(idUser, data, opsi) {
  const { data: baris, error } = await supabase.from('perangkat_user').select('fcm_token').eq('id_user', idUser);
  if (error) throw error;
  const tokens = (baris ?? []).map(b => b.fcm_token);
  if (!tokens.length) return;
  const pesan = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v ?? '')]));
  const hasil = await admin.messaging().sendEachForMulticast({ tokens, data: pesan, ...opsi });
  const mati = tokens.filter((_, i) => !hasil.responses[i].success && tokenMati(hasil.responses[i].error));
  if (mati.length) await supabase.from('perangkat_user').delete().in('fcm_token', mati);
}

// Pulihkan klaim pemantauan. Bersyarat pada nilai yang baru kita tulis dan status masih fermentasi (jangan menimpa wadah yang sudah berubah).
async function pulihkanPantau(w, berikutnya) {
  let q = supabase.from('wadah').update({ tanggal_pemantauan_berikutnya: w.tanggal_pemantauan_berikutnya })
    .eq('id', w.id).eq('status', 'sedang_fermentasi');
  q = berikutnya === null ? q.is('tanggal_pemantauan_berikutnya', null) : q.eq('tanggal_pemantauan_berikutnya', berikutnya);
  const { error } = await q;
  if (error) console.error('cek-jadwal pulihkan pemantauan', w.id, error);
}

async function masihFermentasi(id) {
  const { data } = await supabase.from('wadah').select('id').eq('id', id).eq('status', 'sedang_fermentasi').maybeSingle();
  return !!data;
}

export default async function handler(req, res) {
  const rahasia = process.env.CRON_SECRET;
  if (!rahasia || req.headers.authorization !== `Bearer ${rahasia}`) return res.status(401).json({ error: 'unauthorized' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

  try { siapkan(); } catch (e) { console.error('cek-jadwal siapkan', e); return res.status(500).json({ error: 'konfigurasi server belum lengkap' }); }

  const hariIni = hariIniWIB();   // tanggal WIB, bukan UTC server
  const ringkas = { hari_ini: hariIni, matang: 0, pemantauan: 0, gagal: 0 };

  // ---------- matang ----------
  const { data: daftarMatang, error: eMatang } = await supabase.from('wadah')
    .select('id, id_user, nama')
    .eq('status', 'sedang_fermentasi').eq('notif_matang_terkirim', false).lte('tanggal_matang', hariIni);
  if (eMatang) { console.error('cek-jadwal daftar matang', eMatang); return res.status(500).json({ error: 'gagal membaca daftar matang' }); }

  for (const w of daftarMatang ?? []) try {
    const { data: klaim } = await supabase.from('wadah').update({ notif_matang_terkirim: true })
      .eq('id', w.id).eq('status', 'sedang_fermentasi').eq('notif_matang_terkirim', false).lte('tanggal_matang', hariIni).select('id');
    if (!klaim?.length) continue;
    const { data: n, error } = await supabase.from('notifikasi')
      .insert({ id_user: w.id_user, id_wadah: w.id, jenis: 'matang', isi: 'Siap dipanen!' }).select('id').single();
    if (error) { await supabase.from('wadah').update({ notif_matang_terkirim: false }).eq('id', w.id); ringkas.gagal++; continue; }   // coba lagi besok
    if (!(await masihFermentasi(w.id))) { await supabase.from('notifikasi').delete().eq('id', n.id); continue; }
    await kirimFCM(w.id_user, { id_notifikasi: n.id, id_wadah: w.id, judul: w.nama ?? 'SnapCompost', isi: 'Siap dipanen!' }, FCM_OPSI);
    ringkas.matang++;
  } catch (e) { ringkas.gagal++; console.error('cek-jadwal matang', w.id, e); }

  // ---------- pemantauan (hanya wadah yang BELUM matang) ----------
  const { data: daftarPantau, error: ePantau } = await supabase.from('wadah')
    .select('id, id_user, nama, nama_resep, tanggal_mulai_fermentasi, tanggal_pemantauan_berikutnya, interval_pemantauan_hari, durasi_pemantauan_aktif_hari')
    .eq('status', 'sedang_fermentasi').lte('tanggal_pemantauan_berikutnya', hariIni).gt('tanggal_matang', hariIni);
  if (ePantau) { console.error('cek-jadwal daftar pemantauan', ePantau); return res.status(500).json({ ...ringkas, error: 'gagal membaca daftar pemantauan' }); }

  for (const w of daftarPantau ?? []) try {
    const tanggalBaru = tambahHari(w.tanggal_pemantauan_berikutnya, w.interval_pemantauan_hari);
    const berikutnya = selisihHari(tanggalBaru, w.tanggal_mulai_fermentasi) >= w.durasi_pemantauan_aktif_hari ? null : tanggalBaru;   // spec §10.2
    // 1. KLAIM: geser tanggal
    const { data: klaim } = await supabase.from('wadah').update({ tanggal_pemantauan_berikutnya: berikutnya })
      .eq('id', w.id).eq('status', 'sedang_fermentasi').gt('tanggal_matang', hariIni)
      .eq('tanggal_pemantauan_berikutnya', w.tanggal_pemantauan_berikutnya).select('id');
    if (!klaim?.length) continue;
    // 2. Catat; gagal → kembalikan tanggal lama
    const isi = teksPantau(w.nama_resep);
    const { data: n, error } = await supabase.from('notifikasi')
      .insert({ id_user: w.id_user, id_wadah: w.id, jenis: 'pemantauan', isi }).select('id').single();
    if (error) { await pulihkanPantau(w, berikutnya); ringkas.gagal++; continue; }
    // 3. Cek ulang, lalu kirim
    if (!(await masihFermentasi(w.id))) { await supabase.from('notifikasi').delete().eq('id', n.id); continue; }
    await kirimFCM(w.id_user, { id_notifikasi: n.id, id_wadah: w.id, judul: w.nama ?? 'SnapCompost', isi }, FCM_OPSI);
    ringkas.pemantauan++;
  } catch (e) { ringkas.gagal++; console.error('cek-jadwal pemantauan', w.id, e); }

  return res.status(200).json(ringkas);
}