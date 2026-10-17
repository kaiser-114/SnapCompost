const IKON_SAMPAH = {
  apel: "🍎",
  bayam: "🥬",
  brokoli: "🥦",
  buncis: "🫛",
  cabai: "🌶️",
  "cangkang telur": "🥚",
  "daun bawang": "🧅",
  jagung: "🌽",
  jahe: "🫚",
  "kacang panjang": "🫛",
  kangkung: "🥬",
  kelengkeng: "🍇",
  "kembang kol": "🥦",
  kencur: "🫚",
  kentang: "🥔",
  kubis: "🥬",
  "kulit bawang": "🧅",
  "kulit jeruk": "🍊",
  "kulit lemon": "🍋",
  "kulit mangga": "🥭",
  "kulit melon": "🍈",
  "kulit pepaya": "🥭",
  "kulit pisang": "🍌",
  "kulit rambutan": "🍒",
  "kulit semangka": "🍉",
  kunyit: "🫚",
  lengkuas: "🫚",
  nanas: "🍍",
  "nasi putih": "🍚",
  paprika: "🫑",
  "sawi pakcoy": "🥬",
  seledri: "🌿",
  stroberi: "🍓",
  terong: "🍆",
  timun: "🥒",
  tomat: "🍅",
  wortel: "🥕"
};

export function ikonSampah(nama) {
  const kunci = String(nama ?? "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[_-]/g, " ")
    .replace(/\s+/g, " ").trim();
  return IKON_SAMPAH[kunci] ?? "🌱";
}
