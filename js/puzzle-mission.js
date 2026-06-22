/** 퍼즐 = '오늘의 미션 달성판'.
 * 기록·공유로 9칸을 채우면 대량 포인트 보너스를 한 번 지급한다(하루 1회).
 * 날짜가 바뀌면 판이 새로 시작된다. 쿠폰 교환은 포인트 기반(points.js)으로 이동했다.
 */
const PUZZLE_TOTAL = 9;
const PUZZLE_STORAGE = "photoShare_puzzle_mission";

function _puzzleToday() {
  return new Date().toISOString().slice(0, 10);
}

function loadPuzzleMission() {
  let data = null;
  try {
    data = JSON.parse(localStorage.getItem(PUZZLE_STORAGE) || "null");
  } catch (_) {}
  if (!data || typeof data !== "object") data = { pieces: 0 };
  // 날짜가 바뀌면 '오늘의 미션' 판을 새로 시작한다.
  if (data.date !== _puzzleToday()) {
    data = { pieces: 0, date: _puzzleToday(), image: null, bonusClaimed: false };
    savePuzzleMission(data);
  }
  return data;
}

function savePuzzleMission(data) {
  if (!data.date) data.date = _puzzleToday();
  localStorage.setItem(PUZZLE_STORAGE, JSON.stringify(data));
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

  // 9칸을 처음 다 채운 순간 → 대량 포인트 보너스(오늘 1회)
  let bonus = 0;
  if (data.pieces >= PUZZLE_TOTAL && !data.bonusClaimed) {
    data.bonusClaimed = true;
    savePuzzleMission(data);
    if (typeof addPoints === "function") {
      bonus = POINT_RULES.missionBonus;
      addPoints(bonus, "mission");
    }
  }
  if ((gained > 0 || bonus > 0) && typeof onPuzzlePiecesChanged === "function") {
    onPuzzlePiecesChanged(gained, source, data.pieces, bonus);
  }
  return gained;
}

// 기록(글)에 올린 사진들을 '오래된 순(=먼저 기록한 순)'으로 모은다.
function getDiaryPhotoSources() {
  if (typeof state === "undefined" || !Array.isArray(state.posts)) return [];
  return [...state.posts]
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    .flatMap((p) => p.photos || [])
    .filter(Boolean);
}

// 퍼즐 이미지는 '첫 번째로 기록한 사진'을 사용한다.
function pickRandomDiaryPhoto() {
  const sources = getDiaryPhotoSources();
  if (!sources.length) {
    return (typeof state !== "undefined" && state.profile?.avatar) || "public/photos/ai-01.jpg";
  }
  return sources[0];
}

function ensurePuzzleImage(data) {
  return pickRandomDiaryPhoto();
}

function puzzleMissionImage() {
  return pickRandomDiaryPhoto();
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
