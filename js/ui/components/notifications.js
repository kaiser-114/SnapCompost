// Panel notifikasi

import { notificationButton, notificationLayer, notificationCloseButton } from "../core/dom.js";
import { showToast } from "../core/ui.js";

export function closeNotifications({ restoreFocus = true } = {}) {
  notificationLayer.hidden = true;
  notificationButton.setAttribute("aria-expanded", "false");
  if (restoreFocus) notificationButton.focus();
}

export function initNotifications() {
  notificationButton.addEventListener("click", () => {
    notificationLayer.hidden = false;
    notificationButton.setAttribute("aria-expanded", "true");
    notificationCloseButton.focus();
  });

  notificationLayer.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-notifications]")) {
      closeNotifications();
      return;
    }

    const viewButton = event.target.closest("[data-notification-name]");
    if (!viewButton) return;
    const name = viewButton.dataset.notificationName;
    closeNotifications();
    showToast(`${name} siap dipanen!`);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !notificationLayer.hidden) {
      closeNotifications();
    }
  });
}
