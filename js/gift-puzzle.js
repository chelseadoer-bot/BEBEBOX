/** 선물 퍼즐(레지스트리) — 지인이 한 조각씩 채워주는 9조각 판.
 *
 * 부모가 갖고 싶은 고가 상품을 퍼즐로 만들면, 친구가 공유 링크로 들어와
 * [광고 보기]/[앱 가입하기]/[축하 메시지 쓰기] 같은 간단한 액션으로 한 조각을 채운다.
 * 9조각이 다 채워지면 부모에게 브랜드 20% 할인 쿠폰이 지급된다(state.coupons).
 *
 * 데이터는 state.giftPuzzles 에 저장되고 family-data 로 가족 단위 동기화된다.
 */
const GIFT_PUZZLE_TOTAL = 9;
let _gfCurrent = null; // 현재 채우기 모달에 열린 퍼즐 id

function ensureGiftPuzzleMeta(p) {
  if (!p) return p;
  p.total = p.total || GIFT_PUZZLE_TOTAL;
  if (!Array.isArray(p.pieces)) p.pieces = [];
  if (!p.createdAt) p.createdAt = Date.now();
  return p;
}
function getGiftPuzzle(id) {
  return (typeof state !== "undefined" ? state.giftPuzzles || [] : []).find((p) => p.id === id);
}

/* --------------------------------------------------- 부모: 만들기/공유 */
function renderGiftPuzzles() {
  const wrap = document.getElementById("gift-puzzle-list");
  if (!wrap) return;
  const list = (state.giftPuzzles || []).slice().sort((a, b) => b.createdAt - a.createdAt);
  if (!list.length) {
    wrap.innerHTML = `<p class="gp-empty">아직 만든 선물 퍼즐이 없어요.<br/>갖고 싶은 선물을 퍼즐로 만들고 친구에게 한 조각씩 부탁해 보세요!</p>`;
    return;
  }
  wrap.innerHTML = list.map((p) => {
    const filled = p.pieces.length;
    const done = filled >= p.total;
    const grid = Array.from({ length: p.total }, (_, i) => `<span class="gp-cell${i < filled ? " on" : ""}"></span>`).join("");
    const thumb = p.image ? `<img class="gp-thumb" src="${esc(p.image)}" alt=""/>` : `<div class="gp-thumb gp-thumb--ph">🎁</div>`;
    const sub = `${esc(p.brand || "")}${p.brand && p.price ? " · " : ""}${p.price ? fmtPrice(p.price) : ""}`;
    return `<div class="gift-puzzle-card">
      <div class="gp-top">${thumb}<div class="gp-info"><div class="gp-name">${esc(p.productName)}</div><div class="gp-brand">${sub}</div></div></div>
      <div class="gp-grid">${grid}</div>
      <div class="gp-progress">${filled}/${p.total} 조각${done ? " · 완성! 🎉" : ""}</div>
      ${done
        ? `<div class="gp-reward">🎟️ ${esc(p.brand || p.productName)} 20% 할인 쿠폰이 쿠폰함에 지급됐어요</div>`
        : `<button type="button" class="gp-share" data-gp-share="${p.id}">🔗 친구에게 한 조각 부탁하기</button>`}
    </div>`;
  }).join("");
  wrap.querySelectorAll("[data-gp-share]").forEach((b) => (b.onclick = () => shareGiftPuzzle(b.dataset.gpShare)));
}

function giftPuzzleShareUrl(id) {
  const u = new URL(window.location.href.split("#")[0]);
  u.searchParams.set("guest", "1");
  u.searchParams.set("giftpuzzle", id);
  const fam = typeof getInviteCode === "function" ? getInviteCode() : null;
  if (fam) u.searchParams.set("family", fam);
  return u.toString();
}
async function shareGiftPuzzle(id) {
  const p = getGiftPuzzle(id);
  if (!p) return;
  const url = giftPuzzleShareUrl(id);
  const text = `${babyName()} 선물 퍼즐 — "${p.productName}" 한 조각만 채워주라! 🧩`;
  try {
    if (navigator.share) {
      await navigator.share({ title: "선물 퍼즐", text, url });
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      showToast("공유 링크를 복사했어요");
    } else {
      prompt("링크를 복사해서 친구에게 보내세요", url);
    }
  } catch (e) {
    if (e.name !== "AbortError") showToast("공유가 취소되었어요");
  }
}

let _gcImage = "";
function openGiftCreate() {
  if (typeof ensureInviteCode === "function") ensureInviteCode(true);
  ["gc-name", "gc-brand", "gc-price"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  _gcImage = "";
  const pv = document.getElementById("gc-image-preview");
  if (pv) { pv.style.display = "none"; pv.src = ""; }
  document.getElementById("gift-create-modal")?.classList.remove("hidden");
}
async function gcPickImage(file) {
  if (!file || !file.type.startsWith("image/")) return;
  if (typeof uploadPhotoToServer !== "function") return;
  showToast("이미지 올리는 중...");
  try {
    const up = await uploadPhotoToServer(file);
    if (up?.src) {
      _gcImage = up.src;
      const pv = document.getElementById("gc-image-preview");
      if (pv) { pv.src = up.src; pv.style.display = ""; }
    }
  } catch (_) {}
}
function submitGiftCreate() {
  const name = document.getElementById("gc-name").value.trim();
  if (!name) { showToast("선물 이름을 입력해 주세요"); return; }
  const brand = document.getElementById("gc-brand").value.trim();
  const price = parseInt(document.getElementById("gc-price").value, 10) || 0;
  const p = ensureGiftPuzzleMeta({ id: "gp" + Date.now(), productName: name, brand, price, image: _gcImage, total: GIFT_PUZZLE_TOTAL, pieces: [], createdAt: Date.now(), rewardClaimed: false });
  state.giftPuzzles.unshift(p);
  save();
  document.getElementById("gift-create-modal")?.classList.add("hidden");
  renderGiftPuzzles();
  showToast("선물 퍼즐을 만들었어요! 친구에게 공유해 보세요 🧩");
}

/* --------------------------------------------------- 지인: 채우기 */
function openGiftPuzzleFill(id) {
  const p = getGiftPuzzle(id);
  if (!p) { showToast("선물 퍼즐을 찾을 수 없어요"); return; }
  _gfCurrent = id;
  renderGiftFill(p);
  document.getElementById("gift-fill-modal")?.classList.remove("hidden");
}
function closeGiftFill() {
  document.getElementById("gift-fill-modal")?.classList.add("hidden");
  _gfCurrent = null;
}
function renderGiftFill(p) {
  const filled = p.pieces.length;
  const done = filled >= p.total;
  document.getElementById("gf-baby").textContent = `${babyName()}에게 선물을`;
  document.getElementById("gf-name").textContent = p.productName;
  document.getElementById("gf-brand").textContent = `${p.brand || ""}${p.brand && p.price ? " · " : ""}${p.price ? fmtPrice(p.price) : ""}`;
  const thumb = document.getElementById("gf-thumb");
  if (p.image) { thumb.src = p.image; thumb.style.display = ""; } else { thumb.style.display = "none"; }
  document.getElementById("gf-grid").innerHTML = Array.from({ length: p.total }, (_, i) => `<span class="gp-cell${i < filled ? " on" : ""}"></span>`).join("");
  document.getElementById("gf-progress").textContent = `${filled} / ${p.total} 조각`;
  document.getElementById("gf-actions").classList.toggle("hidden", done);
  document.getElementById("gf-done").classList.toggle("hidden", !done);
  document.getElementById("gf-msg-wrap").classList.add("hidden");
}
function fillGiftPiece(id, piece) {
  const p = getGiftPuzzle(id);
  if (!p) return false;
  if (p.pieces.length >= p.total) return false;
  p.pieces.push({ ...piece, at: Date.now() });
  maybeRewardGiftPuzzle(p);
  save();
  return true;
}
function maybeRewardGiftPuzzle(p) {
  if (p.pieces.length >= p.total && !p.rewardClaimed) {
    p.rewardClaimed = true;
    const expires = new Date();
    expires.setDate(expires.getDate() + 30);
    if (!Array.isArray(state.coupons)) state.coupons = [];
    state.coupons.unshift({
      id: "cp" + Date.now(),
      percent: 20,
      label: `${p.brand || p.productName} 20% 할인`,
      code: "GIFT" + Math.random().toString(36).slice(2, 7).toUpperCase(),
      expires: expires.toISOString().slice(0, 10),
      createdAt: Date.now(),
      product: p.productName,
    });
  }
}
let _gfBusy = false;
function gfAction(id, type) {
  const p = getGiftPuzzle(id);
  if (!p || _gfBusy) return;
  if (p.pieces.length >= p.total) { renderGiftFill(p); return; }
  if (type === "message") {
    document.getElementById("gf-msg-wrap").classList.remove("hidden");
    document.getElementById("gf-msg-input")?.focus();
    return;
  }
  if (type === "ad") {
    _gfBusy = true;
    const btn = document.getElementById("gf-ad");
    const orig = btn.textContent;
    let n = 3;
    btn.disabled = true;
    btn.textContent = `광고 시청 중... ${n}`;
    const t = setInterval(() => {
      n--;
      if (n > 0) { btn.textContent = `광고 시청 중... ${n}`; }
      else {
        clearInterval(t);
        btn.disabled = false;
        btn.textContent = orig;
        _gfBusy = false;
        commitGiftPiece(id, "광고 보기", "");
      }
    }, 1000);
    return;
  }
  if (type === "signup") commitGiftPiece(id, "앱 가입하기", "");
}
function submitGiftMessage(id) {
  const el = document.getElementById("gf-msg-input");
  const v = (el?.value || "").trim();
  if (!v) { showToast("축하 메시지를 입력해 주세요"); return; }
  if (el) el.value = "";
  commitGiftPiece(id, "축하 메시지", v);
}
function commitGiftPiece(id, action, message) {
  const by = (typeof getStoredKakaoUser === "function" && getStoredKakaoUser()?.nickname) || "익명의 지인";
  if (!fillGiftPiece(id, { by, action, message })) { showToast("이미 다 채워졌어요"); return; }
  const p = getGiftPuzzle(id);
  renderGiftFill(p);
  if (typeof renderGiftPuzzles === "function") renderGiftPuzzles();
  showToast(`${action}로 한 조각을 채웠어요! 🧩`);
}

function bindGiftPuzzleEvents() {
  document.getElementById("btn-new-gift-puzzle")?.addEventListener("click", openGiftCreate);
  document.getElementById("gc-backdrop")?.addEventListener("click", () => document.getElementById("gift-create-modal").classList.add("hidden"));
  document.getElementById("btn-gc-cancel")?.addEventListener("click", () => document.getElementById("gift-create-modal").classList.add("hidden"));
  document.getElementById("btn-gc-submit")?.addEventListener("click", submitGiftCreate);
  document.getElementById("btn-gc-image")?.addEventListener("click", () => document.getElementById("gc-image-input").click());
  document.getElementById("gc-image-input")?.addEventListener("change", (e) => { gcPickImage(e.target.files[0]); e.target.value = ""; });
  document.getElementById("gf-backdrop")?.addEventListener("click", closeGiftFill);
  document.getElementById("btn-gf-close")?.addEventListener("click", closeGiftFill);
  document.getElementById("gf-ad")?.addEventListener("click", () => gfAction(_gfCurrent, "ad"));
  document.getElementById("gf-signup")?.addEventListener("click", () => gfAction(_gfCurrent, "signup"));
  document.getElementById("gf-message")?.addEventListener("click", () => gfAction(_gfCurrent, "message"));
  document.getElementById("btn-gf-msg-send")?.addEventListener("click", () => submitGiftMessage(_gfCurrent));
}
