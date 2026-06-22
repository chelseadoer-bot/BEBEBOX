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
    inviteCode: typeof getInviteCode === "function" ? getInviteCode() : null,
  };
}

function applyFamilyState(data) {
  if (!data || typeof state === "undefined") return false;
  if (data.friends) state.friends = data.friends;
  if (data.inbox) state.inbox = data.inbox;
  if (data.profile) {
    state.profile = { ...state.profile, ...data.profile };
    if (data.profile.currentAge != null) {
      state.currentAgeTab = String(data.profile.currentAge);
    }
  }
  if (data.wishlist) state.wishlist = data.wishlist;
  if (data.owned) state.owned = data.owned;
  if (data.hidden) state.hidden = data.hidden;
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
    applyFamilyState(row.data);
    if (typeof saveLocalCache === "function") saveLocalCache();
    return true;
  } catch {
    return false;
  }
}

async function pushFamilyDataToServerNow() {
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
