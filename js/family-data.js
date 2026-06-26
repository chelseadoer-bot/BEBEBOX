/** 가족 데이터 클라우드 동기화 (위시리스트·펀딩·프로필 등) */
const FAMILY_DATA_VERSION = 1;
let _pushTimer = null;

function packFamilyState() {
  if (typeof state === "undefined") return null;
  return {
    version: FAMILY_DATA_VERSION,
    friends: state.friends,
    inbox: state.inbox,
    profile: state.profile,
    wishlist: state.wishlist,
    owned: state.owned,
    hidden: state.hidden,
    published: state.published,
    giftedBy: state.giftedBy,
    giftedMsg: state.giftedMsg,
    guestbook: state.guestbook,
    itemProducts: state.itemProducts,
    funding: state.funding,
    fundingGauge: state.fundingGauge,
    gaugePuzzles: state.gaugePuzzles,
    collectQuests: state.collectQuests,
    contributors: state.contributors,
    journeyGifts: state.journeyGifts,
    journeyMemories: state.journeyMemories,
    parentQuestPhotos: state.parentQuestPhotos,
    points: state.points,
    coupons: state.coupons,
    posts: state.posts,
    giftPuzzles: state.giftPuzzles,
    likeAwarded: state.likeAwarded,
    inviteCode: typeof getInviteCode === "function" ? getInviteCode() : null,
  };
}

function applyFamilyState(data) {
  if (!data || typeof state === "undefined") return false;
  if (data.friends) state.friends = data.friends;
  if (data.inbox) state.inbox = data.inbox;
  if (data.profile) {
    state.profile = { ...state.profile, ...data.profile };
    // 피드는 기본 '전체'로 둔다. (예전엔 currentAge 숫자를 그대로 넣어
    // 연령칩 id('m9' 등)와 어긋나 모든 글이 필터링돼 안 보였음)
    state.currentAgeTab = "all";
  }
  if (data.wishlist) state.wishlist = data.wishlist;
  if (data.owned) state.owned = data.owned;
  if (data.hidden) state.hidden = data.hidden;
  if (data.published) state.published = data.published;
  if (data.giftedBy) state.giftedBy = data.giftedBy;
  if (data.giftedMsg) state.giftedMsg = data.giftedMsg;
  if (Array.isArray(data.guestbook)) state.guestbook = data.guestbook;
  if (data.itemProducts) state.itemProducts = data.itemProducts;
  if (data.funding) state.funding = data.funding;
  if (data.fundingGauge) state.fundingGauge = data.fundingGauge;
  if (data.gaugePuzzles) state.gaugePuzzles = data.gaugePuzzles;
  if (data.collectQuests) state.collectQuests = data.collectQuests;
  if (data.contributors) state.contributors = data.contributors;
  if (data.journeyGifts) state.journeyGifts = data.journeyGifts;
  if (data.journeyMemories) state.journeyMemories = data.journeyMemories;
  if (data.parentQuestPhotos) state.parentQuestPhotos = data.parentQuestPhotos;
  if (typeof data.points === "number") state.points = data.points;
  if (Array.isArray(data.coupons)) state.coupons = data.coupons;
  if (Array.isArray(data.posts)) state.posts = data.posts;
  if (Array.isArray(data.giftPuzzles)) state.giftPuzzles = data.giftPuzzles;
  if (typeof data.likeAwarded === "number") state.likeAwarded = data.likeAwarded;
  if (data.inviteCode && typeof ensureInviteCode === "function") {
    localStorage.setItem("photoShare_invite_code", data.inviteCode);
    if (state.profile) state.profile.inviteCode = data.inviteCode;
  }
  return true;
}

async function fetchFamilyDataFromServer() {
  const family = encodeURIComponent(
    typeof getFamilyId === "function" ? getFamilyId() : "BEBEBOX"
  );
  const res = await fetch(`/api/family-data?family=${family}`);
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return res.json();
}

async function syncFamilyDataFromServer() {
  try {
    const row = await fetchFamilyDataFromServer();
    if (!row?.data || !Object.keys(row.data).length) return false;
    // 아직 서버에 반영 안 된 로컬 글이 동기화로 사라지지 않게 보존
    const localPosts = Array.isArray(state.posts) ? state.posts.slice() : [];
    applyFamilyState(row.data);
    if (Array.isArray(state.posts)) {
      const ids = new Set(state.posts.map((p) => p && p.id));
      localPosts.forEach((p) => { if (p && !ids.has(p.id)) state.posts.push(p); });
      state.posts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
    state._synced = true;
    if (typeof saveLocalCache === "function") saveLocalCache();
    return true;
  } catch {
    return false;
  }
}

async function pushFamilyDataToServerNow() {
  // 게스트(지인)는 가족 데이터를 먼저 받아온 뒤에만 되돌려 쓴다.
  // (동기화 전 빈 상태를 push 하면 부모의 글·프로필이 지워질 수 있음)
  const guest = typeof isGuest === "function" && isGuest();
  if (guest && !state._synced) return false;
  const payload = packFamilyState();
  if (!payload) return false;
  const family = encodeURIComponent(
    typeof getFamilyId === "function" ? getFamilyId() : "BEBEBOX"
  );
  const res = await fetch(`/api/family-data?family=${family}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.ok;
}

function schedulePushFamilyData() {
  clearTimeout(_pushTimer);
  _pushTimer = setTimeout(() => {
    pushFamilyDataToServerNow().catch(() => {});
  }, 600);
}
