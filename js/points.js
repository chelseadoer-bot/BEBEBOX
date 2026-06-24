/** 베베박스 통합 리워드 — 포인트(캔디 🍬) 경제
 *
 * 하나의 재화(캔디)로 행동→보상→소비→교환 루프를 묶는다.
 *   모으기: 아이 기록 +10, 사진첩 공유 +30, 오늘의 미션(퍼즐 9칸) 완성 보너스 +100
 *   쓰기:   AI 놀이터·게임 결과 보기 -20
 *   교환:   1,000캔디 → 키디 1,000원 장바구니 쿠폰
 *
 * 포인트(state.points)와 쿠폰(state.coupons)은 가족 코드 단위로 서버에 동기화돼
 * 재배포·재접속에도 보존된다. (family-data.js 의 pack/applyFamilyState 참고)
 */
const POINT_RULES = {
  photo: 20, // 아이 기록하기
  share: 30, // 사진첩/공유 링크 공유하기
  giftReceived: 50, // 선물을 받으면(준 사람 기록)
  likeUnit: 200, // 좋아요(하트) 이만큼 모일 때마다
  likeReward: 10, // 좋아요 단위 보상
  missionBonus: 100, // 오늘의 미션(퍼즐 9칸) 완성 보너스
  gameCost: 20, // AI 놀이터·게임 결과 보기(차감)
  couponCost: 100, // 쿠폰 1장 교환 비용(캔디)
  couponAmount: 3000, // 교환되는 키디 상품권 금액(원)
};
const POINT_ICON = "🍬";
const POINT_LABEL = "캔디";

function getPoints() {
  if (typeof state === "undefined") return 0;
  return Math.max(0, Math.floor(state.points || 0));
}

function _commitPoints(value) {
  if (typeof state === "undefined") return;
  state.points = Math.max(0, Math.floor(value));
  if (typeof save === "function") save();
  if (typeof onPointsChanged === "function") onPointsChanged();
}

/** 포인트 적립. 적립 후 잔액을 반환한다. */
function addPoints(amount, reason) {
  amount = Math.floor(amount || 0);
  if (!amount) return getPoints();
  _commitPoints(getPoints() + amount);
  if (amount > 0 && typeof onPointsEarned === "function") onPointsEarned(amount, reason);
  return getPoints();
}

/** 잔액이 충분하면 차감하고 true, 부족하면 그대로 두고 false. */
function spendPoints(amount, reason) {
  amount = Math.floor(amount || 0);
  if (getPoints() < amount) return false;
  _commitPoints(getPoints() - amount);
  if (typeof onPointsSpent === "function") onPointsSpent(amount, reason);
  return true;
}

function formatPoints(n) {
  return (n == null ? getPoints() : Math.max(0, Math.floor(n))).toLocaleString("ko-KR");
}

/* ----------------------------------------------------------- 쿠폰 교환 */
function getCoupons() {
  if (typeof state === "undefined" || !Array.isArray(state.coupons)) return [];
  return state.coupons;
}

function canExchangeCoupon() {
  return getPoints() >= POINT_RULES.couponCost;
}

/** 1,000캔디를 차감하고 1,000원 쿠폰을 발급한다. 포인트 부족 시 null. */
function exchangeCoupon() {
  if (!canExchangeCoupon()) return null;
  if (!spendPoints(POINT_RULES.couponCost, "coupon")) return null;
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);
  const coupon = {
    id: "cp" + Date.now(),
    amount: POINT_RULES.couponAmount,
    label: "키디키디 상품권",
    code: "BEBE" + Math.random().toString(36).slice(2, 8).toUpperCase(),
    expires: expires.toISOString().slice(0, 10),
    createdAt: Date.now(),
  };
  if (typeof state !== "undefined") {
    if (!Array.isArray(state.coupons)) state.coupons = [];
    state.coupons.unshift(coupon);
    if (typeof save === "function") save();
  }
  return coupon;
}
