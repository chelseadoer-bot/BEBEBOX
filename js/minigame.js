const MINIGAME = { duration: 10 };

let gameTimer = null;
let gameScore = 0;
let gameRunning = false;
let gameResultUnlocked = false;

function openMinigameModal() {
  $("#game-minigame-modal")?.classList.remove("hidden");
  renderMinigameScreen();
}

function closeMinigameModal() {
  clearInterval(gameTimer);
  gameRunning = false;
  $("#game-minigame-modal")?.classList.add("hidden");
}

function renderMinigameScreen() {
  const screen = document.getElementById("game-play-screen");
  const result = document.getElementById("game-result-screen");
  if (!screen || !result) return;
  screen.classList.remove("hidden");
  result.classList.add("hidden");
  gameScore = 0;
  gameRunning = false;
  clearInterval(gameTimer);
  updateGameUI();
  const btn = document.getElementById("btn-game-start");
  if (btn) btn.disabled = false;
}

function updateGameUI() {
  const scoreEl = document.getElementById("game-score");
  const timeEl = document.getElementById("game-time");
  if (scoreEl) scoreEl.textContent = String(gameScore);
  if (timeEl && !gameRunning) timeEl.textContent = String(MINIGAME.duration);
}

function startMinigame() {
  if (gameRunning) return;
  gameRunning = true;
  gameScore = 0;
  let left = MINIGAME.duration;
  const timeEl = document.getElementById("game-time");
  const btn = document.getElementById("btn-game-start");
  if (btn) btn.disabled = true;
  updateGameUI();
  clearInterval(gameTimer);
  gameTimer = setInterval(() => {
    left -= 1;
    if (timeEl) timeEl.textContent = String(left);
    if (left <= 0) endMinigame();
  }, 1000);
}

function tapMinigame() {
  if (!gameRunning) return;
  gameScore += 1;
  const scoreEl = document.getElementById("game-score");
  if (scoreEl) scoreEl.textContent = String(gameScore);
  const zone = document.getElementById("game-tap-zone");
  if (zone) {
    zone.classList.remove("game-tap-bump");
    void zone.offsetWidth;
    zone.classList.add("game-tap-bump");
  }
}

function endMinigame() {
  clearInterval(gameTimer);
  gameRunning = false;
  const btn = document.getElementById("btn-game-start");
  if (btn) btn.disabled = false;
  const screen = document.getElementById("game-play-screen");
  const result = document.getElementById("game-result-screen");
  if (screen) screen.classList.add("hidden");
  if (result) result.classList.remove("hidden");
  // 결과는 잠긴 상태로 시작 — 포인트(캔디)를 써야 확인 가능
  gameResultUnlocked = false;
  document.getElementById("game-result-locked")?.classList.remove("hidden");
  document.getElementById("game-result-unlocked")?.classList.add("hidden");
  const cost = document.getElementById("game-reveal-cost");
  if (cost) cost.textContent = String(POINT_RULES.gameCost);
}

/** 20캔디를 쓰고 점수(결과)를 공개한다. 포인트 부족 시 안내. */
function revealGameResult() {
  if (gameResultUnlocked) return;
  if (typeof spendPoints !== "function" || !spendPoints(POINT_RULES.gameCost, "game")) {
    if (typeof showToast === "function") {
      showToast(`${POINT_ICON} 캔디가 부족해요 · 기록·공유로 모아보세요`);
    }
    return;
  }
  gameResultUnlocked = true;
  document.getElementById("game-result-locked")?.classList.add("hidden");
  document.getElementById("game-result-unlocked")?.classList.remove("hidden");
  const final = document.getElementById("game-final-score");
  if (final) final.textContent = String(gameScore);
}

async function shareGameResult() {
  const text = `${typeof babyName === "function" ? babyName() : "우리 아기"} 아이그라운드 ${gameScore}점! 같이 해볼래요? 🎮`;
  const url = typeof getShareUrl === "function" ? getShareUrl() : location.href;
  try {
    if (navigator.share) {
      await navigator.share({ title: "아이그라운드", text, url });
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      if (typeof showToast === "function") showToast("결과 링크를 복사했어요");
    }
    if (typeof addPoints === "function") addPoints(POINT_RULES.share, "game");
    closeMinigameModal();
    if (typeof showToast === "function") {
      showToast(`결과를 공유하고 +${POINT_RULES.share}${POINT_LABEL}을 받았어요! ${POINT_ICON}`);
    }
  } catch (e) {
    if (e.name !== "AbortError" && typeof showToast === "function") {
      showToast("공유가 취소되었어요");
    }
  }
}

function bindMinigameEvents() {
  document.getElementById("btn-game-start")?.addEventListener("click", startMinigame);
  document.getElementById("game-tap-zone")?.addEventListener("click", tapMinigame);
  document.getElementById("btn-game-reveal")?.addEventListener("click", revealGameResult);
  document.getElementById("btn-game-share-reward")?.addEventListener("click", shareGameResult);
  document.getElementById("btn-game-retry")?.addEventListener("click", renderMinigameScreen);
  document.getElementById("btn-game-minigame-close")?.addEventListener("click", closeMinigameModal);
  document.getElementById("game-minigame-backdrop")?.addEventListener("click", closeMinigameModal);
}

window.openMinigameModal = openMinigameModal;
