const PUZZLE_TOTAL = 9;
const PUZZLE_STORAGE = "photoShare_puzzle_mission";
const COUPON_STORAGE = "photoShare_coupons";

function loadPuzzleMission() {
  try {
    const raw = localStorage.getItem(PUZZLE_STORAGE);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { pieces: 0 };
}

function savePuzzleMission(data) {
  localStorage.setItem(PUZZLE_STORAGE, JSON.stringify(data));
}

function loadCoupons() {
  try {
    const raw = localStorage.getItem(COUPON_STORAGE);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return [];
}

function saveCoupons(list) {
  localStorage.setItem(COUPON_STORAGE, JSON.stringify(list));
}

function addPuzzlePieces(count, source) {
  const data = loadPuzzleMission();
  const before = data.pieces;
  if (count > 0 && !data.image) {
    data.image = pickRandomDiaryPhoto();
  }
  data.pieces = Math.min(PUZZLE_TOTAL, data.pieces + count);
  savePuzzleMission(data);
  const gained = data.pieces - before;
  if (gained > 0 && typeof onPuzzlePiecesChanged === "function") {
    onPuzzlePiecesChanged(gained, source, data.pieces);
  }
  return gained;
}

function canClaimPuzzleCoupon() {
  return loadPuzzleMission().pieces >= PUZZLE_TOTAL;
}

function claimPuzzleCoupon() {
  if (!canClaimPuzzleCoupon()) return null;
  const coupons = loadCoupons();
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);
  const coupon = {
    id: "cp" + Date.now(),
    amount: 1000,
    label: "장바구니 쿠폰",
    code: "BEBE" + Math.random().toString(36).slice(2, 8).toUpperCase(),
    expires: expires.toISOString().slice(0, 10),
    createdAt: Date.now(),
  };
  coupons.unshift(coupon);
  saveCoupons(coupons);
  savePuzzleMission({ pieces: 0, image: null });
  if (typeof onPuzzlePiecesChanged === "function") onPuzzlePiecesChanged(0, "reset", 0);
  return coupon;
}

function getDiaryPhotoSources() {
  if (typeof state === "undefined" || !Array.isArray(state.photos)) return [];
  return state.photos.map((p) => p.src).filter(Boolean);
}

function pickRandomDiaryPhoto() {
  const sources = getDiaryPhotoSources();
  if (!sources.length) {
    return (typeof state !== "undefined" && state.profile?.avatar) || "public/photos/ai-01.jpg";
  }
  return sources[Math.floor(Math.random() * sources.length)];
}

function ensurePuzzleImage(data) {
  if (data.pieces <= 0) return data.image || null;
  if (!data.image) {
    data.image = pickRandomDiaryPhoto();
    savePuzzleMission(data);
  }
  return data.image;
}

function puzzleMissionImage() {
  const data = loadPuzzleMission();
  return ensurePuzzleImage(data) || pickRandomDiaryPhoto();
}

function puzzlePieceBgStyle(col, row, cols, rows, image) {
  const x = cols <= 1 ? 0 : (col / (cols - 1)) * 100;
  const y = rows <= 1 ? 0 : (row / (rows - 1)) * 100;
  return `background-image:url("${image}");background-size:${cols * 100}% ${rows * 100}%;background-position:${x}% ${y}%;background-repeat:no-repeat;`;
}

function puzzlePieceImgStyle(col, row, cols, rows) {
  return `left:${-col * 100}%;top:${-row * 100}%;width:${cols * 100}%;height:${rows * 100}%;`;
}

function migratePuzzleMissionImage() {
  const data = loadPuzzleMission();
  if (data.pieces > 0 && !data.image) {
    data.image = pickRandomDiaryPhoto();
    savePuzzleMission(data);
  }
}
