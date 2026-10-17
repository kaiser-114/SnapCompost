// State UI bersama.
// Di ES module, variabel hasil import tidak boleh diberi nilai baru (`x = 1` -> error).
// Karena itu semua variabel yang diubah dari lebih dari satu file disimpan sebagai
// properti objek S: `S.cameraStream = stream` boleh dilakukan dari file mana pun.

export const S = {
  // Alur & navigasi
  workflowReturnScreen: "Beranda",
  manualReturnScreen: "results",

  // Kamera & foto
  cameraStream: null,
  cameraFacingMode: "environment",
  cameraRequestId: 0,
  flashEnabled: false,
  capturedPhotoUrl: null,
  detectionRequestId: 0,

  // Deteksi, konfirmasi, input manual
  detectedItems: [],
  confirmedItems: [],
  selectedManualItems: [],
  manualIsBulk: false, // ada di state.js; ikut dipindah agar aman saat layar manual ditulis ulang

  // Cek kondisi & jumlah
  reviewIndex: 0,
  reviewTotal: 0,
  reviewShowingRejection: false,
  quantityItems: [],
  quantityIndex: 0,

  // Resep & wadah
  recipeChoice: "",
  selectedVessel: null,

  // Filter halaman Wadah
  wadahStatusFilter: "active",
  wadahTypeFilter: "all",
  wadahSort: "progress", // progress | newest | oldest

  // Urutan daftar di Beranda
  homeSort: "progress_tinggi", // progress_tinggi | progress_rendah | terbaru | terlama
};
