// Hasil deteksi (hook window.detectCompostWaste di sini)

function renderDetectionResults() {
  detectionList.replaceChildren();
  detectionSummary.textContent = detectedItems.length
    ? (typeof window.detectCompostWaste === "function"
      ? `AI mendeteksi ${detectedItems.length} jenis sampah dari foto kamu:`
      : `Contoh hasil deteksi (${detectedItems.length} jenis sampah):`)
    : "Belum ada sampah yang terdeteksi dari foto kamu.";
  detectedItems.forEach((item) => {
    const card = document.createElement("article");
    card.className = "detection-card";
    const art = document.createElement("span");
    art.className = "waste-art";
    art.textContent = item.emoji || "♻️";
    art.setAttribute("aria-hidden", "true");
    const info = document.createElement("div");
    info.className = "waste-card-info";
    const name = document.createElement("span");
    name.className = "waste-name";
    name.textContent = item.name;
    const bar = document.createElement("div");
    bar.className = "waste-confidence";
    const fill = document.createElement("span");
    fill.style.width = `${Math.max(0, Math.min(100, Number(item.confidence) || 0))}%`;
    bar.append(fill);
    info.append(name, bar);
    const percentage = document.createElement("span");
    percentage.className = "waste-percent";
    percentage.textContent = `${Number(item.confidence) || 0}%`;
    card.append(art, info, percentage);
    detectionList.append(card);
  });
  document.querySelector("#to-confirm").disabled = detectedItems.length === 0;
  const correctionButton = document.querySelector("#detection-correction");
  correctionButton.hidden = detectedItems.length === 0;
  correctionButton.textContent = "Ada yang salah / tidak terdeteksi";
  setWorkflowScreen("results");
}

// Define window.detectCompostWaste(file) to return [{ name, confidence, emoji?, category? }]; [] means no detections.
async function processCapturedPhoto(file) {
  const requestId = ++detectionRequestId;
  detectedItems = [];
  clearWorkflowError();
  setWorkflowScreen("results");
  detectionSummary.textContent = "Memeriksa foto…";
  detectionList.replaceChildren();
  try {
    if (typeof window.detectCompostWaste === "function") {
      const results = await window.detectCompostWaste(file);
      if (requestId !== detectionRequestId || workflowView.hidden) return;
      detectedItems = Array.isArray(results)
        ? results.filter((item) => item && typeof item.name === "string" && item.name.trim())
          .map((item) => {
            const confidence = Number(item.confidence) || 0;
            return {
              name: item.name.trim(),
              confidence: confidence > 0 && confidence <= 1 ? confidence * 100 : confidence,
              emoji: typeof item.emoji === "string" ? item.emoji : "♻️",
              category: typeof item.category === "string" ? item.category : "Kompos"
            };
          })
        : [];
    } else {
      await new Promise((resolve) => window.setTimeout(resolve, 400));
      if (requestId !== detectionRequestId || workflowView.hidden) return;
      detectedItems = demoDetections.map((item) => ({ ...item }));
    }
  } catch (error) {
    if (requestId !== detectionRequestId || workflowView.hidden) return;
    renderDetectionResults();
    document.querySelector("#detection-correction").hidden = false;
    document.querySelector("#detection-correction").textContent = "Masukkan sampah secara manual";
    showWorkflowError("Deteksi gagal dijalankan. Periksa koneksi layanan AI atau masukkan sampah secara manual.");
    return;
  }

  if (detectedItems.length === 0) {
    setWorkflowScreen("no-detection");
    return;
  }
  renderDetectionResults();
}

function initDetection() {
  document.querySelector("#to-confirm").addEventListener("click", () => {
    if (detectedItems.length) renderConfirmation();
    else setWorkflowScreen("no-detection");
  });

  document.querySelector("#detection-correction").addEventListener("click", () => showManual("results"));

  document.querySelector("#retry-camera").addEventListener("click", () => {
    detectedItems = [];
    confirmedItems = [];
    selectedManualItems = [];
    revokeCapturedPhoto();
    setWorkflowScreen("camera");
    startCamera();
  });
  document.querySelector("#manual-from-empty").addEventListener("click", () => showManual("no-detection"));
}
