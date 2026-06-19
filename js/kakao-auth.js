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
    return user;
  }
  return null;
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
