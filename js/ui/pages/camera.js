// Kamera & pilih foto

import {
  phone, workflowView, notificationLayer, notificationButton,
  cameraVideo, cameraImagePreview, cameraPlaceholder, cameraError,
  cameraCapture, cameraFlash, cameraSwitch, photoInput
} from "../core/dom.js";
import { S } from "../core/ui-state.js";
import { hooks } from "../core/hooks.js";
import { setWorkflowScreen, clearWorkflowError } from "../core/workflow.js";

export function stopCamera() {
  S.cameraRequestId += 1;
  if (S.cameraStream) {
    S.cameraStream.getTracks().forEach((track) => track.stop());
    S.cameraStream = null;
  }
  cameraVideo.srcObject = null;
  cameraCapture.disabled = true;
  cameraSwitch.disabled = true;
  cameraFlash.disabled = true;
  S.flashEnabled = false;
  cameraFlash.setAttribute("aria-label", "Nyalakan lampu flash");
}

export function showCameraError(message) {
  cameraPlaceholder.querySelector("strong").textContent = "Kamera belum aktif";
  cameraError.textContent = message;
  cameraError.hidden = false;
  cameraPlaceholder.hidden = false;
  cameraVideo.hidden = true;
  cameraCapture.disabled = true;
  cameraSwitch.disabled = true;
  cameraFlash.disabled = true;
}

export async function startCamera() {
  stopCamera();
  const requestId = ++S.cameraRequestId;
  cameraError.hidden = true;
  cameraPlaceholder.hidden = false;
  cameraPlaceholder.querySelector("strong").textContent = "Mengaktifkan kamera…";
  cameraVideo.hidden = true;

  if (!navigator.mediaDevices?.getUserMedia) {
    showCameraError("Browser tidak dapat membuka kamera di alamat ini. Gunakan foto dari perangkat, atau buka halaman melalui HTTPS/localhost.");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: S.cameraFacingMode },
        width: { ideal: 1280 },
        height: { ideal: 960 }
      }
    });
    if (requestId !== S.cameraRequestId || workflowView.hidden) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    S.cameraStream = stream;
    cameraVideo.srcObject = S.cameraStream;
    cameraVideo.hidden = false;
    cameraPlaceholder.hidden = true;
    cameraCapture.disabled = false;
    cameraSwitch.disabled = false;
    const track = S.cameraStream.getVideoTracks()[0];
    const capabilities = track.getCapabilities?.();
    cameraFlash.disabled = !capabilities?.torch;
    await cameraVideo.play();
  } catch (error) {
    if (requestId !== S.cameraRequestId) return;
    const message = error.name === "NotAllowedError" || error.name === "PermissionDeniedError"
      ? "Izin kamera ditolak. Izinkan akses kamera di pengaturan browser, atau pilih foto dari perangkat."
      : error.name === "NotFoundError" || error.name === "DevicesNotFoundError"
        ? "Kamera tidak ditemukan. Pilih foto dari perangkat untuk melanjutkan."
        : error.name === "NotReadableError" || error.name === "TrackStartError"
          ? "Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut atau pilih foto dari perangkat."
          : "Kamera tidak dapat dibuka. Periksa izin kamera atau pilih foto dari perangkat.";
    stopCamera();
    showCameraError(message);
  }
}

export function setCameraImage(file) {
  if (S.capturedPhotoUrl) URL.revokeObjectURL(S.capturedPhotoUrl);
  S.capturedPhotoUrl = URL.createObjectURL(file);
  cameraImagePreview.src = S.capturedPhotoUrl;
  cameraImagePreview.hidden = false;
  cameraVideo.hidden = true;
  cameraPlaceholder.hidden = true;
  stopCamera();
}

export function revokeCapturedPhoto() {
  if (S.capturedPhotoUrl) {
    URL.revokeObjectURL(S.capturedPhotoUrl);
    S.capturedPhotoUrl = null;
  }
  cameraImagePreview.removeAttribute("src");
  cameraImagePreview.hidden = true;
}

export async function openCamera() {
  S.workflowReturnScreen = phone.dataset.screen === "wadah" ? "Wadah" : "Beranda";
  phone.dataset.workflow = "camera";
  notificationLayer.hidden = true;
  notificationButton.setAttribute("aria-expanded", "false");
  S.selectedManualItems = [];
  S.detectedItems = [];
  revokeCapturedPhoto();
  clearWorkflowError();
  setWorkflowScreen("camera");
  await startCamera();
}

export function initCamera() {
  cameraCapture.addEventListener("click", () => {
    if (!S.cameraStream || !cameraVideo.videoWidth || !cameraVideo.videoHeight) {
      showCameraError("Kamera belum siap. Tunggu sebentar, atau pilih foto dari perangkat.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = cameraVideo.videoWidth;
    canvas.height = cameraVideo.videoHeight;
    canvas.getContext("2d").drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        showCameraError("Foto tidak dapat diproses. Silakan coba lagi.");
        return;
      }
      const file = new File([blob], `sampah-${Date.now()}.jpg`, { type: "image/jpeg" });
      setCameraImage(file);
      hooks.processCapturedPhoto(file);
    }, "image/jpeg", .9);
  });

  cameraSwitch.addEventListener("click", async () => {
    S.cameraFacingMode = S.cameraFacingMode === "environment" ? "user" : "environment";
    await startCamera();
  });

  cameraFlash.addEventListener("click", async () => {
    const track = S.cameraStream?.getVideoTracks()[0];
    if (!track) return;
    S.flashEnabled = !S.flashEnabled;
    try {
      await track.applyConstraints({ advanced: [{ torch: S.flashEnabled }] });
      cameraFlash.setAttribute("aria-label", S.flashEnabled ? "Matikan lampu flash" : "Nyalakan lampu flash");
    } catch (error) {
      S.flashEnabled = false;
      cameraError.textContent = "Lampu flash tidak dapat digunakan pada kamera ini.";
      cameraError.hidden = false;
    }
  });

  document.querySelector("#choose-photo").addEventListener("click", () => photoInput.click());
  photoInput.addEventListener("change", () => {
    const file = photoInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showCameraError("Pilih file gambar untuk melanjutkan.");
      photoInput.value = "";
      return;
    }
    setCameraImage(file);
    hooks.processCapturedPhoto(file);
    photoInput.value = "";
  });
}
