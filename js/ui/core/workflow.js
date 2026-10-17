// Kerangka alur foto sampah (layar, error, tutup)

import { phone, workflowView, workflowError } from "./dom.js";
import { S } from "./ui-state.js";
import { showToast } from "./ui.js";
import { hooks } from "./hooks.js";
import { showScreen } from "./navigation.js";
import { stopCamera, revokeCapturedPhoto } from "../pages/camera.js";

export function setWorkflowScreen(screen) {
  workflowView.hidden = false;
  phone.dataset.workflow = screen;
  workflowView.querySelectorAll("[data-workflow-screen]").forEach((panel) => {
    panel.hidden = panel.dataset.workflowScreen !== screen;
  });
}

export function showWorkflowError(message) {
  workflowError.textContent = message;
  workflowError.hidden = false;
}

export function clearWorkflowError() {
  workflowError.textContent = "";
  workflowError.hidden = true;
}

export function closeWasteFlow(message = "") {
  stopCamera();
  hooks.tutupAlur?.(); // spec §2.3: menutup alur (back, Esc, selesai) membuang sesi scan
  S.detectionRequestId += 1;
  workflowView.hidden = true;
  phone.removeAttribute("data-workflow");
  revokeCapturedPhoto();
  clearWorkflowError();
  showScreen(S.workflowReturnScreen);
  document.querySelectorAll(".nav-item").forEach((item) => {
    const active = item.dataset.tab === S.workflowReturnScreen;
    item.classList.toggle("active", active);
    item.setAttribute("aria-pressed", String(active));
  });
  if (message) showToast(message);
}

export function initWorkflow() {
  workflowView.addEventListener("click", (event) => {
    const backButton = event.target.closest("[data-workflow-back]");
    if (!backButton) return;
    const targetScreen = backButton.dataset.workflowBack;
    if (targetScreen) {
      if (targetScreen === "vessel-close") {
        closeWasteFlow();
      } else {
        setWorkflowScreen(targetScreen === "manual-return" ? S.manualReturnScreen : targetScreen);
      }
    } else {
      closeWasteFlow();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !workflowView.hidden) {
      closeWasteFlow();
    }
  });
}