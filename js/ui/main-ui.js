// js/ui/main-ui.js  (dulu main.js wadahku, diubah jadi fungsi)
// Modul yang belum dikonversi ke ES module DIKOMENTARI, baik import maupun pemanggilannya
// (satu import ke file tanpa `export` sudah cukup untuk menggagalkan seluruh file ini).
// Buka komentarnya satu per satu setiap kali sebuah halaman selesai dikonversi.
import { initVesselCards } from './components/vessel-card.js';
import { initNotifications } from './components/notifications.js';
import { initNavigation } from './core/navigation.js';
import { initWorkflow } from './core/workflow.js';
import { initHome } from './pages/home.js';
import { initWadah } from './pages/wadah.js';
import { initCamera } from './pages/camera.js';
import { startVesselTicker } from './services/vessel-ticker.js';
import { initScan } from "./pages/scan.js";
import { detektor, siapkanDetektor, progresModel } from "../app/bootstrap.js";
// import { initDetection } from './pages/detection.js';
// import { initManual } from './pages/manual.js';
import { initReview } from './pages/review.js';
import { initQuantity } from './pages/quantity.js';
import { initAlokasi } from './pages/alokasi.js'; // pilih jenis olahan → buat wadah baru; menggantikan recipe.js lama
import { initVesselDetail } from './pages/vessel-detail.js';

export function mulaiUI() {
  initVesselCards();
  initNotifications();
  initNavigation();
  initWorkflow();
  initHome();
  initWadah();
  initCamera();
  startVesselTicker();
  initScan({ getDetektor: () => detektor, siapkanDetektor, progresModel });
  // initDetection();
  // initManual();
  initReview();
  initQuantity();
  initAlokasi();
  initVesselDetail();
}