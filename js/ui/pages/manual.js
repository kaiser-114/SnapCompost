// Input manual

function showManual(returnScreen) {
  manualReturnScreen = returnScreen;
  manualInput.value = "";
  selectedManualItems = [];
  renderManualPicks();
  renderManualSuggestions("");
  updateManualButton();
  document.querySelector("#not-found-back").textContent = returnScreen === "confirm"
    ? "Kembali ke Konfirmasi"
    : returnScreen === "no-detection"
      ? "Kembali"
      : "Kembali ke Hasil Deteksi";
  setWorkflowScreen("manual");
  manualInput.focus();
}

function renderManualSuggestions(query) {
  const normalizedQuery = query.trim().toLocaleLowerCase("id");
  const suggestions = normalizedQuery
    ? compostSuggestions.filter((item) => item.name.toLocaleLowerCase("id").includes(normalizedQuery)).slice(0, 5)
    : compostSuggestions.slice(0, 4);
  manualSuggestions.replaceChildren();
  suggestions.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "manual-suggestion";
    button.role = "option";
    button.dataset.wasteName = item.name;
    button.dataset.category = item.category;
    button.dataset.emoji = item.emoji;
    const icon = document.createElement("span");
    icon.textContent = "♧";
    icon.setAttribute("aria-hidden", "true");
    const name = document.createElement("span");
    name.textContent = item.name;
    button.append(icon, name);
    manualSuggestions.append(button);
  });
  manualSuggestions.hidden = suggestions.length === 0;
  manualInput.setAttribute("aria-expanded", String(suggestions.length > 0));
}

function renderManualPicks() {
  manualPicked.replaceChildren();
  selectedManualItems.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "manual-picked-item";
    const text = document.createElement("span");
    text.textContent = `${item.emoji} ${item.name} · ${item.category}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.setAttribute("aria-label", `Hapus ${item.name}`);
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      selectedManualItems.splice(index, 1);
      renderManualPicks();
      updateManualButton();
    });
    row.append(text, remove);
    manualPicked.append(row);
  });
}

// Teks & status tombol hijau ditentukan dari 3 hal:
// isi kolom pencarian, apakah isinya persis salah satu saran, dan jumlah sampah terpilih.
function updateManualButton() {
  const query = manualInput.value.trim();
  const hasPicks = selectedManualItems.length > 0;
  const isExactMatch = query !== "" && compostSuggestions.some(
    (item) => item.name.toLocaleLowerCase("id") === query.toLocaleLowerCase("id"));

  let label;
  if (isExactMatch) {
    label = "Tambahkan ke list sampah terpilih";      // saran sudah diklik
  } else if (query) {
    label = "Cari dan tambahkan ke list terpilih";    // sedang mengetik
  } else if (hasPicks) {
    label = `Tambahkan ${selectedManualItems.length} sampah terpilih`;
  } else {
    label = "Cari dan tambahkan ke list terpilih";    // kosong & belum ada pilihan
  }
  manualFindButton.textContent = label;

  const disabled = !query && !hasPicks;               // pudar & tidak bisa ditekan
  manualFindButton.disabled = disabled;
  manualFindButton.setAttribute("aria-disabled", String(disabled));
}

function addManualWaste() {
  const query = manualInput.value.trim();
  if (query) {
    const normalizedQuery = query.toLocaleLowerCase("id");
    const match = compostSuggestions.find((item) => item.name.toLocaleLowerCase("id") === normalizedQuery);
    if (!match) {
      document.querySelector("#not-found-message").textContent =
        `"${query}" belum ada di daftar resep kami. Coba nama lain atau kembali ke hasil deteksi.`;
      setWorkflowScreen("not-found");
      return;
    }
    if (!selectedManualItems.some((item) => item.name === match.name)) {
      selectedManualItems.push({ ...match });
    }
    manualInput.value = "";
    renderManualPicks();
    renderManualSuggestions("");
    updateManualButton();
    return;
  }

  if (selectedManualItems.length) {
    if (manualReturnScreen === "results") {
      const newItems = selectedManualItems.filter((manualItem) =>
        !detectedItems.some((item) => item.name.toLocaleLowerCase("id") === manualItem.name.toLocaleLowerCase("id")));
      detectedItems.push(...newItems.map((item) => ({ ...item, confidence: 100 })));
      renderConfirmation();
      return;
    }
    if (manualReturnScreen === "confirm") {
      const newItems = selectedManualItems.filter((manualItem) =>
        !confirmedItems.some((item) => item.name.toLocaleLowerCase("id") === manualItem.name.toLocaleLowerCase("id")));
      confirmedItems.push(...newItems.map((item) => ({ ...item, processable: null })));
      renderWasteReview();
      return;
    }
    confirmedItems = selectedManualItems.map((item) => ({ ...item, processable: null }));
    renderWasteReview();
    return;
  }

  manualInput.focus();
  showToast("Pilih atau ketik nama sampah terlebih dahulu");
}

function initManual() {
  manualInput.addEventListener("input", () => {
    renderManualSuggestions(manualInput.value);
    updateManualButton();
  });
  manualInput.addEventListener("focus", () => renderManualSuggestions(manualInput.value));
  manualInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const firstSuggestion = manualSuggestions.querySelector(".manual-suggestion");
      const exactSuggestion = [...manualSuggestions.querySelectorAll(".manual-suggestion")]
        .some((suggestion) => suggestion.dataset.wasteName.toLocaleLowerCase("id")
          === manualInput.value.trim().toLocaleLowerCase("id"));
      if (firstSuggestion && manualInput.value.trim() && !exactSuggestion) {
        manualInput.value = firstSuggestion.dataset.wasteName;
        manualSuggestions.hidden = true;
        manualInput.setAttribute("aria-expanded", "false");
        updateManualButton();
      } else {
        addManualWaste();
      }
    }
  });
  manualSuggestions.addEventListener("click", (event) => {
    const suggestion = event.target.closest(".manual-suggestion");
    if (!suggestion) return;
    manualInput.value = suggestion.dataset.wasteName;
    manualSuggestions.hidden = true;
    manualInput.setAttribute("aria-expanded", "false");
    updateManualButton();
    manualInput.focus();
  });
  manualFindButton.addEventListener("click", addManualWaste);
  document.querySelector("#try-another-name").addEventListener("click", () => {
    setWorkflowScreen("manual");
    manualInput.focus();
    manualInput.select();
  });
  document.querySelector("#not-found-back").addEventListener("click", () => {
    setWorkflowScreen(manualReturnScreen);
  });
}