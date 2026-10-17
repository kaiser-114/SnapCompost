// State aplikasi & pemuatan wadah dari localStorage

let cameraStream = null;
let cameraFacingMode = "environment";
let flashEnabled = false;
let cameraRequestId = 0;
let detectionRequestId = 0;
let workflowReturnScreen = "Beranda";
let manualReturnScreen = "results";
let capturedPhotoUrl = null;
let detectedItems = [];
let confirmedItems = [];
let quantityItems = [];
let quantityIndex = 0;
let reviewIndex = 0;
let reviewTotal = 0;
let reviewShowingRejection = false;
let recipeChoice = "";
let manualIsBulk = false;
let selectedManualItems = [];
let toastTimeout;
let wadahStatusFilter = "active";
let wadahTypeFilter = "all";
const storageKey = "snapcompost.savedVessels";
let savedVessels = [];
const vesselRecords = new Map();
let selectedVessel = null;

try {
  const storedVessels = JSON.parse(localStorage.getItem(storageKey) || "[]");
  if (Array.isArray(storedVessels)) {
    savedVessels = storedVessels.filter((vessel) => vessel
      && typeof vessel.name === "string"
      && ["Kompos", "Eco Enzim"].includes(vessel.type)
      && Array.isArray(vessel.items)).map((vessel, index) => ({
        ...vessel,
        id: vessel.id || `saved-vessel-${index}`,
        status: ["filling", "fermenting", "mature", "harvested"].includes(vessel.status)
          ? vessel.status
          : "filling",
        durationDays: vessel.durationDays || (vessel.type === "Kompos" ? 30 : 90),
        materials: Array.isArray(vessel.materials) ? vessel.materials : null,
        tools: Array.isArray(vessel.tools) ? vessel.tools : null
      }));
  }
} catch (error) {
  console.error("Wadah tersimpan tidak dapat dibaca dari penyimpanan browser.", error);
}
