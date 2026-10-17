// Konfirmasi sampah

function renderConfirmation() {
  confirmList.replaceChildren();
  detectedItems.forEach((item, index) => {
    const label = document.createElement("label");
    label.className = "confirm-card";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "confirm-check";
    checkbox.checked = item.confirmed !== false;
    checkbox.dataset.confirmIndex = String(index);
    checkbox.setAttribute("aria-label", `Pilih ${item.name}`);
    const art = document.createElement("span");
    art.className = "waste-art";
    art.textContent = item.emoji || "♻️";
    art.setAttribute("aria-hidden", "true");
    const info = document.createElement("span");
    info.className = "waste-card-info";
    const name = document.createElement("span");
    name.className = "waste-name";
    name.textContent = item.name;
    const category = document.createElement("span");
    category.className = "notification-description";
    category.textContent = item.category || "Kompos";
    info.append(name, category);
    label.append(checkbox, art, info);
    confirmList.append(label);
  });
  confirmCount.textContent = `${detectedItems.length} sampah siap diproses:`;
  updateConfirmSelection();
  setWorkflowScreen("confirm");
}

function updateConfirmSelection() {
  const checkboxes = [...confirmList.querySelectorAll(".confirm-check")];
  const selected = checkboxes.filter((item) => item.checked).length;
  checkboxes.forEach((checkbox) => {
    const item = detectedItems[Number(checkbox.dataset.confirmIndex)];
    if (item) item.confirmed = checkbox.checked;
  });
  confirmAdd.disabled = selected === 0;
  confirmAdd.textContent = `Tambahkan ${selected} sampah terpilih`;
  document.querySelector("#toggle-all-confirm").textContent = selected === checkboxes.length
    ? "Batalkan semua"
    : "Pilih semua";
}

function beginWasteReview() {
  confirmedItems = [...confirmList.querySelectorAll(".confirm-check:checked")]
    .map((checkbox) => {
      const sourceIndex = Number(checkbox.dataset.confirmIndex);
      const item = detectedItems[sourceIndex];
      return item ? { ...item, sourceIndex, processable: null } : null;
    })
    .filter(Boolean);
  if (!confirmedItems.length) {
    showToast("Pilih setidaknya satu sampah untuk dilanjutkan");
    return;
  }
  reviewIndex = 0;
  reviewTotal = confirmedItems.length;
  reviewShowingRejection = false;
  renderWasteReview();
}

function initConfirm() {
  document.querySelector("#confirm-correction").addEventListener("click", () => showManual("confirm"));
  confirmAdd.addEventListener("click", beginWasteReview);

  document.querySelector("#toggle-all-confirm").addEventListener("click", () => {
    const checkboxes = [...confirmList.querySelectorAll(".confirm-check")];
    const checkAll = checkboxes.some((checkbox) => !checkbox.checked);
    checkboxes.forEach((checkbox) => { checkbox.checked = checkAll; });
    updateConfirmSelection();
  });
  confirmList.addEventListener("change", updateConfirmSelection);
}
