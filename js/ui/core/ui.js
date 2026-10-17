// Helper UI umum

import { toast } from "./dom.js";

let toastTimeout; // sebelumnya global di state.js; hanya dipakai di sini

export function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("visible"), 2200);
}
