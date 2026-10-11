# SnapCompost

SnapCompost adalah prototipe aplikasi untuk membantu pengguna mengelola wadah kompos, memeriksa perkembangan proses, dan mengikuti alur pengolahan sampah organik.

## Cara menjalankan

Jalankan server lokal dari folder proyek:

```bash
python -m http.server 8000
```

Buka `http://localhost:8000/Dasboard.html` di browser. Server lokal diperlukan agar modul JavaScript dan berkas data/model dapat dimuat.

## Struktur dan fungsi file

### Antarmuka

- **`Dasboard.html`** — halaman utama, berisi HTML, CSS, dan JavaScript antarmuka. Menampilkan beranda, daftar/detail wadah, notifikasi, serta alur kamera dan input manual. Prototipe UI ini menyimpan wadah lokal di `localStorage`.

### Modul JavaScript

- **`js/core.js`** — aturan inti pengolahan kompos dan pemindaian.
  - Memuat dan memvalidasi referensi melalui `muatReferensi`, lalu menyediakan akses data melalui `ref` dan `dataSampah`.
  - Menentukan kecocokan bahan dan resep melalui `dapatkanStatus`, `penentuanResep`, `daftarKondisiUntukLabel`, dan `perlakuan`.
  - Memvalidasi jumlah dan menghitung kebutuhan bahan melalui `konversiKeGram`, `validasiInputJumlah`, `hitungBahanCoklat`, dan `hitungBahanPendukung`. Checklist memakai `sudahDituang`, `sisaDituang`, `hitungChecklistBaru`, `checklistLengkap`, dan `teksBahan`.
  - Menghitung tanggal, status, dan kemajuan fermentasi melalui `hariIniWIB`, `selisihHari`, `tambahHari`, `hitungJadwal`, `jadwalMenyimpang`, `statusEfektif`, dan `progress`.
  - Memberi saran nama sampah melalui `cariSaran`. `buatSesiScan` mengelola kandidat hasil deteksi, pilihan pengguna, dan input manual.
  - Menjadi dependensi aturan bagi `wadah.js`, `alokasi.js`, dan `notifikasi.js`.

- **`js/wadah.js`** — mengubah data wadah menjadi informasi yang siap ditampilkan dan menyiapkan rencana tindakan.
  - `dashboard`, `kartuWadah`, `teksKanan`, `teksTotalSampah`, dan `teksTotalKg` membentuk ringkasan serta label wadah.
  - `daftarHomepage` dan `filterDanUrut` memilih, menyaring, serta mengurutkan wadah.
  - `detailWadah` menyusun data detail, item, checklist, langkah, dan tombol yang sesuai dengan status wadah.
  - `rencanaCentang`, `rencanaMulaiFermentasi`, `rencanaHapusItem`, dan `rencanaUbahJumlah` memvalidasi tindakan dan membentuk payload untuk API.
  - Mengimpor aturan dari `core.js`; hasilnya dapat digunakan UI atau lapisan `integrasi.js`.

- **`js/alokasi.js`** — mengatur pembagian bahan baru ke wadah yang tersedia.
  - `kandidatWadah` dan `buatSesiAlokasi` menentukan wadah tujuan serta melacak jumlah yang dialokasikan.
  - `rencanaTambahKeWadah` dan `rencanaWadahBaru` menghitung item dan checklist untuk wadah.
  - `susunRencana` dan `payloadKonfirmasi` membentuk serta memvalidasi rencana lengkap.
  - `kirimAlokasi` mengirim konfirmasi melalui API dan menjaga agar pengulangan setelah gangguan jaringan tidak menggandakan transaksi; `batalkanPending` membuang percobaan yang belum pasti setelah data dimuat ulang.
  - Menggunakan aturan dari `core.js`; `kirimAlokasi` memanggil `konfirmasiAlokasi` dari `api.js`.

- **`js/api.js`** — satu-satunya modul yang berkomunikasi dengan Supabase. `buatApi(klien)` menghasilkan operasi `daftarWadah`, `wadah`, `itemWadah`, `profil`, `daftarNotifikasi`, dan `hapusNotifikasi` untuk membaca data. Operasi `konfirmasiAlokasi`, `ubahJumlahItem`, `hapusItem`, `mulaiFermentasi`, `gantiNama`, `hapusWadah`, `centangChecklist`, `daftarkanPerangkat`, `lepasPerangkat`, `batalkanFermentasi`, dan `tandaiSudahDipanen` menulis atau mengubah data. Modul ini mengharapkan tabel/view, kebijakan akses, dan RPC Supabase tersedia di backend; fungsi internalnya memeriksa koneksi dan mengubah error backend menjadi pesan yang dapat ditampilkan UI.

- **`js/notifikasi.js`** — mengelola data notifikasi yang digunakan oleh UI.
  - `teksBadge` membatasi teks jumlah pada badge.
  - `bacaParameterNotifikasi` membaca dan memvalidasi ID pada URL.
  - `buatPusatNotifikasi(api)` menyediakan pemuatan daftar, langganan perubahan, dan tindakan membuka/menandai notifikasi melalui `api.js`.

- **`js/deteksi.js`** — menjalankan deteksi sampah dari foto menggunakan ONNX Runtime Web.
  - `parseLabels` dan `periksaLabel` membaca serta mencocokkan label model dengan data referensi.
  - `rgbaKeFloat` dan fungsi internal pemrosesan gambar mengubah foto menjadi tensor.
  - `ekstrakDeteksi` membaca keluaran model; `buatDetektor` memuat model dan menyediakan fungsi deteksi foto.
  - Bergantung pada `assets/models/best.onnx`, `assets/labels/labels.txt`, dan objek runtime ONNX yang diberikan saat inisialisasi.

- **`js/integrasi.js`** — lapisan penghubung/service yang mengimpor `core.js`, `alokasi.js`, `deteksi.js`, `notifikasi.js`, `wadah.js`, dan `api.js`.
  - `buatIntegrasiSnapCompost` memuat data referensi, membuat API dan pusat notifikasi, lalu menyediakan fungsi deteksi.
  - Mengembalikan layanan, termasuk `muatBeranda` dan `muatDetailWadah`, agar entry point UI dapat meminta data siap pakai.
  - Memerlukan klien Supabase; deteksi foto juga memerlukan ONNX Runtime.

### Data, model, dan konfigurasi

- **`data/data-referensi-snapcompost.json`** — sumber nama/label sampah, resep, syarat bahan, rasio, langkah, alat, dan jadwal. Dibaca serta divalidasi oleh `core.js`.
- **`assets/models/best.onnx`** — model yang digunakan oleh `deteksi.js`.
- **`assets/labels/labels.txt`** — daftar label yang harus sesuai dengan model dan nama sampah pada JSON referensi.
- **`js/supabase-config.example.js`** — contoh bentuk konfigurasi URL proyek dan publishable/anon key. Salin menjadi `js/supabase-config.js` untuk nilai lokal; file tersebut dikecualikan oleh `.gitignore`. Jangan pernah menaruh service-role key di browser.
- **`.gitignore`** — mencegah konfigurasi Supabase lokal masuk ke Git.
- **`.vscode/mcp.json`** — konfigurasi workspace VS Code; bukan bagian runtime aplikasi.

## Hubungan modul dan alur aplikasi

```text
Dasboard.html ──> tampilan prototipe (termasuk logika UI di dalam halaman)

Entry point UI yang akan dibuat
        │
        └──> integrasi.js
              ├──> core.js <── data-referensi-snapcompost.json
              ├──> wadah.js
              ├──> alokasi.js ──> api.js ──> Supabase
              ├──> notifikasi.js ───────────> api.js
              └──> deteksi.js <── model ONNX + labels.txt
```

Pada alur deteksi, foto diproses oleh `deteksi.js`, lalu hasilnya dapat dikonfirmasi menggunakan sesi scan di `core.js`. Pada alur input manual, saran nama, validasi jumlah, pemilihan resep, dan perhitungan bahan juga menggunakan `core.js`. Data wadah dan tindakan selanjutnya dipetakan oleh `wadah.js` atau `alokasi.js`; perubahan yang disimpan dikirim lewat `api.js`.

## Status integrasi saat ini

`Dasboard.html` masih merupakan prototipe mandiri: JavaScript UI berada di dalam halaman dan penyimpanan wadahnya menggunakan `localStorage`. Modul-modul di folder `js/` menyediakan aturan dan template layanan, tetapi **belum dipanggil langsung oleh dashboard**. Belum ada entry point browser yang membuat klien Supabase/ONNX, dan repositori ini belum menyertakan skema, migrasi, kebijakan akses, atau fungsi RPC backend. Karena itu, konfigurasi Supabase saja belum membuat data dashboard tersambung ke server.

Sebelum integrasi penuh diaktifkan, siapkan backend yang memenuhi kontrak di `js/api.js`, konfigurasi klien memakai publishable/anon key, lalu buat entry point yang menghubungkan layanan `integrasi.js` ke elemen UI. Runtime ONNX juga perlu disediakan bila fitur deteksi foto hendak memakai model lokal.
