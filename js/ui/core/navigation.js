// Navigasi bawah & pergantian layar utama

import { phone, homeView, wadahView, notificationButton, brandName, brandCount, workflowView } from "./dom.js";
import { showToast } from "./ui.js";
import { hooks } from "./hooks.js";
import { closeWasteFlow } from "./workflow.js";
import { openCamera } from "../pages/camera.js";

export function showScreen(screen) {
  const isWadah = screen === "Wadah";
  phone.dataset.screen = isWadah ? "wadah" : "home";
  homeView.hidden = isWadah;
  wadahView.hidden = !isWadah;
  notificationButton.hidden = isWadah;
  brandName.textContent = isWadah ? "Semua Wadah" : "SnapCompost";
  brandCount.hidden = !isWadah;

  if (isWadah) hooks.updateWadahCards();
  else hooks.updateHome();
}

export function initNavigation() {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach((navItem) => {
        const active = navItem === item;
        navItem.classList.toggle("active", active);
        navItem.setAttribute("aria-pressed", String(active));
      });
      if (item.dataset.tab === "Wadah" || item.dataset.tab === "Beranda") {
        if (!workflowView.hidden) closeWasteFlow();
        showScreen(item.dataset.tab);
      } else if (item.dataset.tab === "Foto") {
        openCamera();
      } else {
        showToast(`${item.dataset.tab} dipilih`);
      }
    });
  });
}