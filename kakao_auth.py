"""Kakao OAuth 로그인 (세션 저장은 db.py 가 담당)."""
import json
import os
import urllib.parse
import urllib.request

KAKAO_AUTH_URL = "https://kauth.kakao.com/oauth/authorize"
KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token"
KAKAO_USER_URL = "https://kapi.kakao.com/v2/user/me"


def redirect_uri(port):
    custom = os.environ.get("KAKAO_REDIRECT_URI", "").strip()
    if custom:
        return custom
    return "http://localhost:%d/auth/kakao/callback" % port


def is_configured():
    return bool(os.environ.get("KAKAO_REST_API_KEY", "").strip())


def auth_url(port):
    key = os.environ.get("KAKAO_REST_API_KEY", "").strip()
    q = urllib.parse.urlencode({
        "client_id": key,
        "redirect_uri": redirect_uri(port),
        "response_type": "code",
    })
    return KAKAO_AUTH_URL + "?" + q


def _form_post(url, fields):
    import urllib.error
    data = urllib.parse.urlencode(fields).encode()
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        # 카카오가 4xx로 돌려준 에러 본문을 그대로 노출해 원인 파악을 돕는다.
        body = e.read().decode("utf-8", errors="ignore")
        raise RuntimeError("kakao_token_error %s: %s" % (e.code, body))


def exchange_code(code, port):
    fields = {
        "grant_type": "authorization_code",
        "client_id": os.environ.get("KAKAO_REST_API_KEY", "").strip(),
        "redirect_uri": redirect_uri(port),
        "code": code,
    }
    secret = os.environ.get("KAKAO_CLIENT_SECRET", "").strip()
    if secret:
        fields["client_secret"] = secret
    return _form_post(KAKAO_TOKEN_URL, fields)


def fetch_user(access_token):
    req = urllib.request.Request(
        KAKAO_USER_URL,
        headers={
            "Authorization": "Bearer " + access_token,
            "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
        },
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode())


def parse_user(raw):
    account = raw.get("kakao_account") or {}
    profile = account.get("profile") or raw.get("properties") or {}
    return {
        "kakaoId": raw.get("id"),
        "nickname": profile.get("nickname") or "카카오 사용자",
        "profileImage": profile.get("profile_image_url") or profile.get("thumbnail_image_url") or "",
        "email": account.get("email") or "",
    }


def parse_cookies(header):
    out = {}
    for part in (header or "").split(";"):
        part = part.strip()
        if "=" in part:
            k, v = part.split("=", 1)
            out[k.strip()] = v.strip()
    return out


def public_user(session):
    if not session:
        return None
    return {
        "provider": "kakao",
        "kakaoId": session.get("kakaoId"),
        "nickname": session.get("nickname"),
        "profileImage": session.get("profileImage"),
        "email": session.get("email"),
    }
