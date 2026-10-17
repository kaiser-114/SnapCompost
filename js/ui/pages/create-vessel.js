// Buat wadah baru

function getRecipeMaterials() {
  const wasteGrams = quantityItems.reduce((sum, item) => sum + getEstimatedGrams(item), 0);
  if (recipeChoice === "Eco Enzim") {
    return [
      { name: "Sampah kulit buah", amount: `${Math.round(wasteGrams)} g` },
      { name: "Gula merah", amount: `${Math.max(1, Math.round(wasteGrams / 3))} g` },
      { name: "Air bersih", amount: `${Math.max(10, Math.round(wasteGrams * 10 / 3))} ml` }
    ];
  }
  return [
    { name: "Sampah organik terpilih", amount: `${Math.round(wasteGrams)} g` },
    { name: "Daun kering / bahan cokelat", amount: "secukupnya" },
    { name: "Tanah atau kompos matang", amount: "secukupnya" },
    { name: "Air bersih", amount: "secukupnya" }
  ];
}

function renderVesselMaterials() {
  materialsList.replaceChildren();
  getRecipeMaterials().forEach((material) => {
    const row = document.createElement("div");
    row.className = "material-row";
    const name = document.createElement("span");
    name.textContent = material.name;
    const amount = document.createElement("span");
    amount.textContent = material.amount;
    row.append(name, amount);
    materialsList.append(row);
  });
  newVesselName.value = `${recipeChoice} ${savedVessels.length + 1}`;
  vesselError.hidden = true;
  setWorkflowScreen("create-vessel");
}

function saveNewVessel() {
  const name = newVesselName.value.trim();
  if (!name) {
    vesselError.textContent = "Masukkan nama wadah terlebih dahulu.";
    vesselError.hidden = false;
    newVesselName.focus();
    return;
  }
  if (savedVessels.some((vessel) => vessel.name.toLocaleLowerCase("id") === name.toLocaleLowerCase("id"))) {
    vesselError.textContent = "Nama wadah sudah digunakan. Pilih nama lain.";
    vesselError.hidden = false;
    newVesselName.focus();
    return;
  }

  const vessel = {
    id: globalThis.crypto?.randomUUID?.() || `vessel-${Date.now()}`,
    name,
    type: recipeChoice,
    items: quantityItems.map((item) => ({
      name: item.name,
      quantity: Number(item.quantity),
      unit: item.quantityMode === "weight" ? "gram" : "buah"
    })),
    recipeName: recipeChoice === "Kompos" ? "Kompos Organik" : "Eco Enzim Buah Segar",
    created: Date.now(),
    status: "filling",
    durationDays: recipeChoice === "Kompos" ? 30 : 90
  };
  ensureVesselPreparation(vessel);
  savedVessels.unshift(vessel);
  try {
    localStorage.setItem(storageKey, JSON.stringify(savedVessels));
  } catch (error) {
    savedVessels.shift();
    vesselError.textContent = "Wadah gagal disimpan di browser. Periksa ruang penyimpanan lalu coba lagi.";
    vesselError.hidden = false;
    console.error("Wadah baru tidak dapat disimpan ke penyimpanan browser.", error);
    return;
  }

  createSavedVesselCards(vessel);
  refreshWadahTotals();
  closeWasteFlow(`Wadah "${name}" berhasil disimpan ke dashboard`);
}

function initCreateVessel() {
  document.querySelector("#save-vessel").addEventListener("click", saveNewVessel);
}
