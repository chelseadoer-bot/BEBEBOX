/** Kakao OAuth (server redirect + session cookie) */
const KAKAO_SESSION_KEY = "photoShare_kakao";

async function fetchAppConfig() {
  const res = await fetch("/api/config", { credentials: "include" });
  if (!res.ok) return { kakaoEnabled: false };
  return res.json();
}

async function fetchKakaoMe() {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

async function startKakaoLogin() {
  const config = await fetchAppConfig();
  if (!config.kakaoEnabled) {
    if (typeof showToast === "function") {
      showToast("카카오 로그인 설정이 필요해요 (.env 확인)");
    }
    if (typeof obLogin === "function") obLogin("kakao");
    return;
  }
  window.location.href = "/auth/kakao/login";
}

async function initKakaoAuth() {
  const params = new URLSearchParams(location.search);
  if (params.get("kakao_login") === "1") {
    params.delete("kakao_login");
    const qs = params.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
  }
  const user = await fetchKakaoMe();
  if (user?.kakaoId) {
    localStorage.setItem(KAKAO_SESSION_KEY, JSON.stringify(user));
    applyKakaoUserToProfile(user);
    await linkKakaoFamily(user);   // 가족코드를 카카오 계정에 묶어 브라우저 간 동일 계정 유지
    return user;
  }
  return null;
}

// 카카오 계정에 '정식' 가족코드를 묶는다. 서버가 이미 매핑된 코드가 있으면 그걸 반환하고,
// 로컬 코드가 다르면 그 정식 코드로 교체 → 이후 syncFamilyDataFromServer 가 해당 계정 로드.
// (share 링크 ?family= / 지인(guest) 상태에선 내 계정에 묶으면 안 되므로 건너뛴다.)
async function linkKakaoFamily(user) {
  if (!user || !user.kakaoId) return;
  try {
    const params = new URLSearchParams(location.search);
    if (params.has("family") || params.has("guest")) return;
    if (typeof isGuest === "function" && isGuest()) return;
  } catch (e) { /* noop */ }
  try {
    const localCode = (typeof getInviteCode === "function" && getInviteCode()) || "";
    const r = await fetch("/api/auth/link", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ familyCode: localCode }),
    });
    if (!r.ok) return;
    const j = await r.json().catch(() => ({}));
    const canonical = String((j && j.familyCode) || "").trim().toUpperCase();
    if (canonical && canonical !== String(localCode || "").toUpperCase()) {
      localStorage.setItem("photoShare_invite_code", canonical);
      if (typeof state !== "undefined" && state && state.profile) state.profile.inviteCode = canonical;
    }
  } catch (e) { /* 실패 시 기존 로컬 코드 유지(안전 폴백) */ }
}

function getStoredKakaoUser() {
  try {
    return JSON.parse(localStorage.getItem(KAKAO_SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function applyKakaoUserToProfile(user) {
  if (!user || typeof state === "undefined") return;
  if (user.profileImage) state.profile.avatar = user.profileImage;
  state.profile.kakaoId = user.kakaoId;
  state.profile.kakaoNickname = user.nickname;
  if (typeof save === "function") save();
}

async function logoutKakao() {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
  localStorage.removeItem(KAKAO_SESSION_KEY);
  localStorage.removeItem("photoShare_onboarded");
  localStorage.removeItem("photoShare_auth");
  window.location.href = "/";
}

window.startKakaoLogin = startKakaoLogin;
window.initKakaoAuth = initKakaoAuth;
window.getStoredKakaoUser = getStoredKakaoUser;
window.logoutKakao = logoutKakao;
