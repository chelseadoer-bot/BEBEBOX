#!/usr/bin/env python3
"""BEBEBOX 로컬 백엔드 서버.

표준 라이브러리만 사용한다. 데이터는 SQLite(data/bebebox.db),
사진 파일은 uploads/ 에 저장한다. 외부 클라우드/계정이 필요 없다.

API
  GET    /api/config                  서버 설정(스토리지 종류, 카카오 사용 여부)
  GET    /api/photos?family=CODE      가족 사진 목록
  POST   /api/photos/upload           사진 업로드(multipart: file, family_id)
  DELETE /api/photos/<id>?family=CODE 사진 삭제
  GET    /api/family-data?family=CODE 가족 앱 상태(JSON)
  PUT    /api/family-data?family=CODE 가족 앱 상태 저장(JSON)
  GET    /api/kidikidi/search?q=...   키디키디 상품 검색 프록시
  GET    /api/auth/me                 로그인 사용자
  GET    /auth/kakao/login            카카오 로그인 시작
  GET    /auth/kakao/callback         카카오 콜백
  POST   /api/auth/logout             로그아웃
"""
import html
import json
import mimetypes
import os
import re
import time
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

import db
import kakao_auth as ka
import ai_backend

ROOT = os.path.dirname(os.path.abspath(__file__))
# 배포 시 영구 디스크 경로를 환경변수로 지정할 수 있다(없으면 로컬 uploads/).
UPLOAD_DIR = os.environ.get("BEBEBOX_UPLOAD_DIR") or os.path.join(ROOT, "uploads")
MAX_UPLOAD_BYTES = 15 * 1024 * 1024
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
EXT_BY_TYPE = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
DEFAULT_FAMILY = "BEBEBOX"

SEARCH = "https://kidikidi.elandmall.co.kr/v1/search/item/api"
IMG = "https://item.elandrs.com/"
ITEM = "https://kidikidi.elandmall.co.kr/i/item?itemNo="


def load_dotenv(path):
    if not os.path.isfile(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k, v = k.strip(), v.strip().strip('"').strip("'")
            if k and k not in os.environ:
                os.environ[k] = v


load_dotenv(os.path.join(ROOT, ".env"))
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
ADMIN_KEY = os.environ.get("BEBEBOX_ADMIN_KEY", "bebebox")


def ensure_dirs():
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)


def norm_family(value):
    v = (value or DEFAULT_FAMILY).strip().upper()
    return v or DEFAULT_FAMILY


def server_port():
    return int(os.environ.get("PORT", "8080"))


def _log_kakao(msg):
    line = "[%s] %s\n" % (time.strftime("%Y-%m-%d %H:%M:%S"), msg)
    try:
        with open(os.path.join(ROOT, "data", "kakao_debug.log"), "a", encoding="utf-8") as f:
            f.write(line)
    except OSError:
        pass
    print("KAKAO:", msg, flush=True)


# ------------------------------------------------------------- photos
def public_photo(photo):
    """프론트로 보낼 사진 객체(내부 storedFile 필드는 제외)."""
    return {
        "id": photo["id"],
        "family_id": photo["family_id"],
        "src": photo["src"],
        "createdAt": photo["createdAt"],
        "ageMonth": photo.get("ageMonth", 9),
        "likes": photo.get("likes", 0),
        "liked": photo.get("liked", False),
        "comments": photo.get("comments", []),
        "caption": photo.get("caption", ""),
    }


def save_photo(data, ctype, filename, family_id):
    fam = norm_family(family_id)
    if ctype not in ALLOWED_TYPES:
        raise ValueError("invalid_type")
    photo_id = "p" + str(int(time.time() * 1000))
    stored = photo_id + safe_ext(filename, ctype)
    ensure_dirs()
    with open(os.path.join(UPLOAD_DIR, stored), "wb") as f:
        f.write(data)
    photo = {
        "id": photo_id,
        "family_id": fam,
        "src": "/uploads/" + stored,
        "storedFile": stored,
        "createdAt": db.now_ms(),
        "ageMonth": 9,
        "likes": 0,
        "liked": False,
        "comments": [],
        "caption": "",
    }
    db.insert_photo(photo)
    return public_photo(photo)


def remove_photo(photo_id, family_id=None):
    fam = norm_family(family_id) if family_id else None
    stored = db.delete_photo(photo_id, fam)
    if stored is None:
        return False
    if stored:
        path = os.path.join(UPLOAD_DIR, stored)
        if os.path.isfile(path):
            try:
                os.remove(path)
            except OSError:
                pass
    return True


def safe_ext(filename, content_type):
    ext = os.path.splitext(filename or "")[1].lower()
    if ext in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        return ".jpg" if ext == ".jpeg" else ext
    return EXT_BY_TYPE.get(content_type, ".jpg")


# ----------------------------------------------------------- http utils
def json_response(handler, status, payload, cookies=None):
    body = json.dumps(payload, ensure_ascii=False).encode()
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    if cookies:
        for c in cookies:
            handler.send_header("Set-Cookie", c)
    handler.end_headers()
    handler.wfile.write(body)


def redirect_response(handler, url, cookies=None):
    handler.send_response(302)
    handler.send_header("Location", url)
    if cookies:
        for c in cookies:
            handler.send_header("Set-Cookie", c)
    handler.end_headers()


def session_cookie(token):
    return "bebebox_session=%s; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax" % token


def clear_session_cookie():
    return "bebebox_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax"


def current_session(handler):
    cookies = ka.parse_cookies(handler.headers.get("Cookie"))
    token = cookies.get("bebebox_session")
    return db.get_session(token), token


def read_json_body(handler):
    try:
        length = int(handler.headers.get("Content-Length", "0"))
    except ValueError:
        length = 0
    if length <= 0:
        return {}
    return json.loads(handler.rfile.read(length).decode("utf-8"))


def parse_multipart(handler):
    content_type = handler.headers.get("Content-Type", "")
    if "boundary=" not in content_type:
        return None, None, None, DEFAULT_FAMILY
    boundary = content_type.split("boundary=", 1)[1].strip().strip('"').encode()
    try:
        length = int(handler.headers.get("Content-Length", "0"))
    except ValueError:
        return None, None, None, DEFAULT_FAMILY
    body = handler.rfile.read(length)
    delimiter = b"--" + boundary
    file_data, file_ctype, file_name = None, None, None
    family_id = DEFAULT_FAMILY
    for part in body.split(delimiter):
        if b"Content-Disposition" not in part:
            continue
        header_end = part.find(b"\r\n\r\n")
        if header_end == -1:
            header_end = part.find(b"\n\n")
            header_sep = 2
        else:
            header_sep = 4
        if header_end == -1:
            continue
        headers = part[:header_end].decode("utf-8", errors="ignore")
        data = part[header_end + header_sep:]
        if data.endswith(b"\r\n"):
            data = data[:-2]
        elif data.endswith(b"\n"):
            data = data[:-1]
        name_m = re.search(r'name="([^"]+)"', headers)
        field_name = name_m.group(1) if name_m else ""
        if field_name == "family_id":
            family_id = data.decode("utf-8", errors="ignore").strip().upper() or DEFAULT_FAMILY
            continue
        if field_name != "file":
            continue
        file_data = data
        file_ctype = "application/octet-stream"
        for line in headers.splitlines():
            if line.lower().startswith("content-type:"):
                file_ctype = line.split(":", 1)[1].strip()
        file_name = "photo.jpg"
        fn = re.search(r'filename="([^"]*)"', headers)
        if fn:
            file_name = fn.group(1)
        if len(file_data) > MAX_UPLOAD_BYTES:
            raise ValueError("file_too_large")
    return file_data, file_ctype, file_name, family_id


def map_items(items):
    out = []
    for it in items:
        path = it.get("representImagePath") or ""
        if not path and it.get("image"):
            path = (it["image"][0] or {}).get("imagePath") or ""
        no = str(it.get("itemNo") or "")
        out.append({
            "id": "kd-" + no, "itemNo": no,
            "brand": it.get("brandName") or "키디키디",
            "name": it.get("itemName") or "",
            "price": it.get("finalDcPrice") or it.get("sellprice") or 0,
            "image": (IMG + path + "?w=&h=500&q=100") if path else "",
            "url": ITEM + no,
            "rating": it.get("reviewScoreDecimalpoint") or it.get("reviewScore"),
            "reviews": it.get("reviewCount") or 0,
            "source": "kidikidi", "custom": False,
        })
    return out


class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def log_message(self, *a):
        pass

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    # ------------------------------------------------------------ GET
    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path.startswith("/uploads/"):
            return self._serve_upload(path)
        # 라우팅: 부모 앱(/home, /)과 지인 공유 웹(/share/:id) 분리
        if path == "/" or path == "/home" or path == "/index.html":
            return self._serve_html("index.html")
        if path == "/share" or path.startswith("/share/"):
            rest = path[len("/share"):].strip("/")
            baby_id = norm_family(urllib.parse.unquote(rest.split("/")[0])) if rest else DEFAULT_FAMILY
            return self._serve_share(baby_id)
        if path == "/api/config":
            return json_response(self, 200, {
                "storage": "sqlite",
                "kakaoEnabled": ka.is_configured(),
            })
        if path == "/ai-health" or path == "/api/ai-health":
            return self._serve_ai_health()
        if path == "/api/family-data":
            family = norm_family(self._query("family"))
            row = db.get_family_data(family)
            if not row:
                return json_response(self, 404, {"error": "not_found", "family": family})
            return json_response(self, 200, row)
        if path == "/api/photos":
            family = norm_family(self._query("family"))
            return json_response(self, 200, {
                "photos": [public_photo(p) for p in db.list_photos(family)],
                "family": family,
            })
        if path == "/api/journey":
            family = norm_family(self._query("family"))
            return json_response(self, 200, db.journey_summary(family))
        if path == "/api/banner":
            cfg = db.get_config("game_banner", {}) or {}
            items = cfg.get("items")
            if not isinstance(items, list):
                # 구버전(단일 배너) 호환 → 리스트로 변환
                if cfg.get("title") or cfg.get("image") or cfg.get("icon"):
                    items = [{
                        "title": cfg.get("title", ""), "subtitle": cfg.get("subtitle", ""),
                        "image": cfg.get("image", ""), "icon": cfg.get("icon", ""),
                        "link": cfg.get("link", ""),
                    }]
                else:
                    items = []
            enabled = bool(cfg.get("enabled")) and len(items) > 0
            return json_response(self, 200, {"enabled": enabled, "items": items})
        if path == "/api/coupons":
            family = norm_family(self._query("family"))
            return json_response(self, 200, {"status": db.family_coupon_status(family)})
        if path == "/admin":
            return self._serve_html("admin.html")
        if path.startswith("/api/admin/"):
            if (self._query("key") or "") != ADMIN_KEY:
                return json_response(self, 401, {"error": "unauthorized"})
            if path == "/api/admin/stats":
                return json_response(self, 200, db.global_stats())
            if path == "/api/admin/members":
                return json_response(self, 200, {"members": db.list_members(self._query("q"))})
            if path == "/api/admin/member":
                return json_response(self, 200, db.member_detail(norm_family(self._query("family"))))
            if path == "/api/admin/coupons":
                return json_response(self, 200, {"coupons": db.coupon_queue()})
            return json_response(self, 404, {"error": "not_found"})
        if path == "/api/auth/me":
            session, _ = current_session(self)
            user = ka.public_user(session)
            if not user:
                return json_response(self, 401, {"error": "not_authenticated"})
            return json_response(self, 200, user)
        if path == "/auth/kakao/login":
            if not ka.is_configured():
                return redirect_response(self, "/?kakao_error=config")
            return redirect_response(self, ka.auth_url(server_port()))
        if path == "/auth/kakao/callback":
            return self._kakao_callback()
        if path == "/api/kidikidi/search":
            return self._kidikidi_search()
        # AI 그라운드 미니앱: /apps/<slug>/api/* 및 /apps/<slug>/storage/*
        m = re.match(r"^/apps/([^/]+)/(api|storage)(?:/(.*))?$", path)
        if m:
            slug, kind, rest = m.group(1), m.group(2), (m.group(3) or "")
            if kind == "storage":
                fp = ai_backend.storage_path(slug, urllib.parse.unquote(rest))
                if not fp:
                    return self.send_error(404)
                ctype = mimetypes.guess_type(fp)[0] or "application/octet-stream"
                with open(fp, "rb") as f:
                    data = f.read()
                self.send_response(200)
                self.send_header("Content-Type", ctype)
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Cache-Control", "public, max-age=86400")
                self.end_headers()
                return self.wfile.write(data)
            q = {k: v[0] for k, v in
                 urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).items()}
            status, payload = ai_backend.handle("GET", slug, rest, q, None)
            return json_response(self, status, payload)
        return super().do_GET()

    # ----------------------------------------------------------- POST
    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/api/auth/logout":
            _, token = current_session(self)
            db.delete_session(token)
            return json_response(self, 200, {"ok": True}, [clear_session_cookie()])
        if path == "/api/track":
            try:
                body = read_json_body(self)
            except json.JSONDecodeError:
                return json_response(self, 400, {"error": "invalid_json"})
            etype = (body.get("type") or "").strip()
            if not etype:
                return json_response(self, 400, {"error": "missing_type"})
            db.insert_event(
                norm_family(body.get("family")),
                etype,
                actor=body.get("actor"),
                name=(body.get("name") or None),
                item_id=(body.get("item_id") or None),
                meta=body.get("meta") if isinstance(body.get("meta"), dict) else None,
                user_id=(body.get("user_id") or None),
            )
            return json_response(self, 200, {"ok": True})
        if path == "/api/family/delete":
            fam = norm_family(self._query("family"))
            stored = db.delete_family(fam)
            for s in stored:
                try:
                    fp = os.path.join(UPLOAD_DIR, s)
                    if os.path.isfile(fp):
                        os.remove(fp)
                except OSError:
                    pass
            return json_response(self, 200, {"ok": True, "family": fam})
        if path == "/api/admin/coupon/fulfill":
            if (self._query("key") or "") != ADMIN_KEY:
                return json_response(self, 401, {"error": "unauthorized"})
            try:
                body = read_json_body(self)
            except json.JSONDecodeError:
                return json_response(self, 400, {"error": "invalid_json"})
            ok = db.set_coupon_fulfilled(
                norm_family(body.get("family")),
                (body.get("coupon_id") or "").strip(),
                bool(body.get("fulfilled", True)),
                (body.get("note") or "").strip(),
            )
            return json_response(self, 200 if ok else 400, {"ok": ok})
        if path == "/api/admin/banner":
            if (self._query("key") or "") != ADMIN_KEY:
                return json_response(self, 401, {"error": "unauthorized"})
            try:
                body = read_json_body(self)
            except json.JSONDecodeError:
                return json_response(self, 400, {"error": "invalid_json"})
            raw = body.get("items")
            if not isinstance(raw, list):
                # 구버전 단일 배너 본문 호환
                raw = [body] if (body.get("title") or body.get("image") or body.get("icon")) else []
            items = []
            for it in raw[:12]:
                if not isinstance(it, dict):
                    continue
                title = (it.get("title") or "").strip()
                image = (it.get("image") or "").strip()
                icon = (it.get("icon") or "").strip()
                if not (title or image or icon):
                    continue
                items.append({
                    "title": title[:40], "subtitle": (it.get("subtitle") or "").strip()[:60],
                    "image": image, "icon": icon[:8], "link": (it.get("link") or "").strip(),
                })
            enabled = bool(body.get("enabled", True)) and len(items) > 0
            db.set_config("game_banner", {"enabled": enabled, "items": items})
            return json_response(self, 200, {"ok": True, "count": len(items)})
        # AI 그라운드 미니앱 실행: POST /apps/<slug>/api/run
        m = re.match(r"^/apps/([^/]+)/api/(.*)$", path)
        if m:
            slug, rest = m.group(1), m.group(2)
            try:
                body = read_json_body(self)
            except json.JSONDecodeError:
                return json_response(self, 400, {"ok": False, "error": "invalid_json"})
            status, payload = ai_backend.handle("POST", slug, rest, {}, body)
            return json_response(self, status, payload)
        if path != "/api/photos/upload":
            return json_response(self, 404, {"error": "not_found"})
        try:
            data, ctype, filename, family_id = parse_multipart(self)
        except ValueError as e:
            return json_response(self, 413, {"error": str(e)})
        if not data:
            return json_response(self, 400, {"error": "missing_file"})
        try:
            photo = save_photo(data, ctype, filename, family_id)
        except ValueError as e:
            return json_response(self, 400, {"error": str(e)})
        return json_response(self, 200, photo)

    # ------------------------------------------------------------ PUT
    def do_PUT(self):
        path = urllib.parse.urlparse(self.path).path
        if path != "/api/family-data":
            return json_response(self, 404, {"error": "not_found"})
        family = norm_family(self._query("family"))
        try:
            data = read_json_body(self)
        except json.JSONDecodeError:
            return json_response(self, 400, {"error": "invalid_json"})
        if not data:
            return json_response(self, 400, {"error": "empty_body"})
        row = db.upsert_family_data(family, data)
        return json_response(self, 200, row)

    # --------------------------------------------------------- DELETE
    def do_DELETE(self):
        m = re.match(r"^/api/photos/([^/?#]+)", urllib.parse.urlparse(self.path).path)
        if not m:
            return json_response(self, 404, {"error": "not_found"})
        photo_id = urllib.parse.unquote(m.group(1))
        family = self._query("family")
        if not remove_photo(photo_id, family):
            return json_response(self, 404, {"error": "not_found"})
        return json_response(self, 200, {"ok": True, "id": photo_id})

    def _serve_html(self, filename, replacements=None):
        full = os.path.join(ROOT, filename)
        if not os.path.isfile(full):
            return self.send_error(404)
        with open(full, encoding="utf-8") as f:
            page = f.read()
        if replacements:
            for k, v in replacements.items():
                page = page.replace(k, v)
        body = page.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def _serve_ai_health(self):
        """AI(제미나이) 키/모델 실시간 진단 페이지. 게임 결과가 안 뜰 때 원인 확인용."""
        import urllib.request
        import urllib.error
        key = (os.environ.get("GEMINI_API_KEY")
               or os.environ.get("GOOGLE_API_KEY")
               or os.environ.get("GEMINI_KEY") or "").strip()
        text_model = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash-lite")

        def probe(model):
            url = ("https://generativelanguage.googleapis.com/v1beta/models/"
                   + urllib.parse.quote(model) + ":generateContent?key="
                   + urllib.parse.quote(key))
            payload = json.dumps({"contents": [{"role": "user",
                     "parts": [{"text": "ping"}]}]}).encode("utf-8")
            req = urllib.request.Request(url, data=payload,
                  headers={"Content-Type": "application/json"}, method="POST")
            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    return True, r.status, ""
            except urllib.error.HTTPError as e:
                b = e.read().decode("utf-8", "ignore")
                try:
                    m = json.loads(b).get("error", {}).get("message", b)
                except Exception:
                    m = b
                return False, e.code, m
            except Exception as e:
                return False, 0, str(e)

        # 진단
        if not key:
            verdict = ("❌ 키가 설정되지 않았어요",
                       "Render 환경변수 <b>GEMINI_API_KEY</b> 가 비어 있습니다. "
                       "Render → Environment 에서 키를 넣고 다시 배포해 주세요.")
            ok = False
            detail = ""
        else:
            ok, code, msg = probe(text_model)
            used = text_model
            # 모델 혼잡(503)이면 대체 모델로 한 번 더 시도(게임도 자동 폴백함)
            low = (msg or "").lower()
            if not ok and (code == 503 or "overloaded" in low or "high demand" in low
                           or "unavailable" in low) and text_model != "gemini-2.5-flash":
                ok2, code2, msg2 = probe("gemini-2.5-flash")
                if ok2:
                    ok, code, msg, used = ok2, code2, msg2, "gemini-2.5-flash"
            detail = "모델: %s · 응답코드: %s<br>%s" % (used, code,
                     (msg or "정상").replace("<", "&lt;"))
            low = (msg or "").lower()
            if ok:
                verdict = ("✅ AI 키 정상 작동",
                           "키와 모델이 정상입니다. 게임에서 결과를 만들어 보세요. "
                           "(혼잡할 때는 자동으로 다른 모델로 바꿔 시도해요.)")
            elif code == 400 and ("api key not valid" in low or "api_key_invalid" in low):
                verdict = ("❌ 키가 잘못됐어요",
                           "키 값이 유효하지 않습니다. Google AI Studio에서 새 키를 "
                           "발급받아 Render의 <b>GEMINI_KEY</b>를 교체해 주세요.")
            elif code == 429:
                verdict = ("⚠️ 사용량 한도 초과",
                           "무료 사용량(분당/일일 한도)을 초과했어요. 잠시 후 다시 "
                           "시도하거나, Google에서 결제를 연결하면 한도가 늘어납니다.")
            elif code == 503 or "overloaded" in low or "high demand" in low or "unavailable" in low:
                verdict = ("⚠️ 모델이 잠시 혼잡해요 (키는 정상!)",
                           "키는 정상인데 지금 구글 AI 모델이 일시적으로 붐벼요. "
                           "잠시 후 게임에서 다시 시도하면 대부분 됩니다. 게임은 "
                           "자동으로 여유 있는 모델로 바꿔 재시도해요.")
            elif code == 404:
                verdict = ("❌ 모델 이름 문제",
                           "모델 '%s' 을(를) 찾을 수 없어요. GEMINI_MODEL 환경변수를 "
                           "비우거나 'gemini-2.5-flash' 로 설정해 주세요." % used)
            elif code == 403:
                verdict = ("❌ 권한/지역 차단",
                           "키 권한 또는 지역 제한 문제일 수 있어요. AI Studio에서 키 "
                           "권한과 사용 지역을 확인해 주세요.")
            else:
                verdict = ("❌ AI 호출 실패",
                           "아래 상세 오류를 확인해 주세요.")

        # 이미지 생성 모델도 점검 (컨셉 스튜디오/그림 결과가 안 뜰 때 원인 확인)
        if key:
            img_model = os.environ.get("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")
            iurl = ("https://generativelanguage.googleapis.com/v1beta/models/"
                    + urllib.parse.quote(img_model) + ":generateContent?key=" + urllib.parse.quote(key))
            ipayload = json.dumps({
                "contents": [{"role": "user", "parts": [{"text": "a tiny simple red dot"}]}],
                "generationConfig": {"responseModalities": ["IMAGE", "TEXT"]},
            }).encode("utf-8")
            ireq = urllib.request.Request(iurl, data=ipayload,
                   headers={"Content-Type": "application/json"}, method="POST")
            iok = False
            try:
                with urllib.request.urlopen(ireq, timeout=60) as r:
                    jr = json.loads(r.read().decode("utf-8", "ignore"))
                    c0 = (jr.get("candidates") or [{}])[0]
                    parts = (c0.get("content", {}) or {}).get("parts") or []
                    iok = any((p.get("inlineData") or p.get("inline_data")) for p in parts)
                    istat = ("✅ 이미지 생성 정상" if iok
                             else "⚠️ 이미지 파트 없음 (사유=%s)" % (c0.get("finishReason") or "unknown"))
            except urllib.error.HTTPError as e:
                b = e.read().decode("utf-8", "ignore")
                try:
                    im = json.loads(b).get("error", {}).get("message", b)
                except Exception:
                    im = b
                istat = "❌ 이미지 모델 오류 %s: %s" % (e.code, (im or "")[:240])
            except Exception as e:
                istat = "❌ 이미지 모델 호출 실패: %s" % e
            detail = (detail or "") + "<br><br><b>🖼️ 이미지 모델</b> (%s)<br>%s" % (
                img_model, istat.replace("<", "&lt;"))
            if ok and not iok:
                verdict = ("⚠️ 텍스트는 정상, 이미지 생성이 막혀요",
                           "작명·기질 같은 텍스트 AI는 되는데 <b>컨셉 스튜디오·그림 결과</b>가 이 이유로 안 떠요. "
                           "아래 이미지 모델 오류를 확인하세요. (무료 키는 이미지 생성이 제한될 수 있어요 — "
                           "Google AI Studio에서 이미지 생성 지원 키/결제 연결이 필요할 수 있어요.)")

        masked = (key[:6] + "…" + key[-4:]) if len(key) > 12 else ("(" + str(len(key)) + "자)" if key else "(없음)")
        html = (
            "<!doctype html><html lang='ko'><head><meta charset='utf-8'>"
            "<meta name='viewport' content='width=device-width,initial-scale=1'>"
            "<title>AI 상태 점검</title><style>"
            "body{font-family:-apple-system,'Pretendard',sans-serif;background:#F0F7FF;"
            "margin:0;padding:24px;color:#1E293B;}"
            ".card{max-width:480px;margin:0 auto;background:#fff;border:1px solid #DBEAFE;"
            "border-radius:18px;padding:24px;box-shadow:0 4px 20px rgba(30,58,95,.06);}"
            "h1{font-size:20px;margin:0 0 6px;}h2{font-size:17px;margin:16px 0 8px;}"
            ".v{font-size:18px;font-weight:800;margin:10px 0;}"
            ".p{font-size:14px;line-height:1.7;color:#475569;}"
            ".k{font-size:13px;color:#64748B;margin-top:14px;}"
            ".d{font-size:12px;color:#94A3B8;background:#F8FAFC;border-radius:10px;"
            "padding:12px;margin-top:12px;word-break:break-all;line-height:1.6;}"
            "</style></head><body><div class='card'>"
            "<h1>🩺 AI 상태 점검</h1>"
            "<div class='v'>" + verdict[0] + "</div>"
            "<div class='p'>" + verdict[1] + "</div>"
            "<div class='k'>키: <b>" + masked + "</b></div>"
            "<div class='d'>" + (detail or "") + "</div>"
            "</div></body></html>"
        )
        body = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def _origin(self):
        proto = self.headers.get("X-Forwarded-Proto") or "http"
        host = self.headers.get("Host") or ("localhost:%d" % server_port())
        return "%s://%s" % (proto, host)

    def _serve_share(self, baby_id):
        """지인용 공유 페이지. 링크 미리보기(OG)를 가족 데이터로 채워 넣는다."""
        row = db.get_family_data(baby_id)
        data = (row or {}).get("data") or {}
        profile = data.get("profile") or {}
        baby = profile.get("babyName") or (profile.get("name") or "").replace("의 일기", "") or "우리 아기"
        img = profile.get("shareImage") or ""
        if not img:
            for p in (data.get("posts") or []):
                photos = p.get("photos") or []
                if photos:
                    img = photos[0]
                    break
        if not img:
            img = profile.get("avatar") or "/public/photos/ai-01.jpg"
        origin = self._origin()
        og_img = (origin + img) if img.startswith("/") else img
        repl = {
            "{{OG_TITLE}}": html.escape("%s의 베베박스" % baby),
            "{{OG_DESC}}": html.escape("우리 아이에게 선물하고 키디키디 쿠폰도 받아가세요 🎁"),
            "{{OG_IMAGE}}": html.escape(og_img),
            "{{BABY_ID}}": html.escape(baby_id),
        }
        return self._serve_html("share.html", repl)

    def _serve_upload(self, path):
        rel = urllib.parse.unquote(path[len("/uploads/"):])
        safe = os.path.normpath(rel).replace("\\", "/")
        if not safe or safe.startswith("..") or os.path.isabs(safe):
            return self.send_error(404)
        full = os.path.join(UPLOAD_DIR, safe)
        if not os.path.isfile(full):
            return self.send_error(404)
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        with open(full, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "public, max-age=86400")
        self.end_headers()
        self.wfile.write(data)

    # ------------------------------------------------------- helpers
    def _query(self, key, default=None):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        return (q.get(key) or [default])[0]

    def _kakao_callback(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        if (q.get("error") or [None])[0]:
            return redirect_response(self, "/?kakao_error=" + urllib.parse.quote(q["error"][0]))
        code = (q.get("code") or [""])[0]
        if not code:
            return redirect_response(self, "/?kakao_error=no_code")
        try:
            token_data = ka.exchange_code(code, server_port())
            access = token_data.get("access_token")
            if not access:
                _log_kakao("no access_token in response: %r" % token_data)
                d = urllib.parse.quote(json.dumps(token_data, ensure_ascii=False)[:400])
                return redirect_response(self, "/?kakao_error=token&kakao_detail=" + d)
            user = ka.parse_user(ka.fetch_user(access))
            token, _ = db.create_session(user)
            return redirect_response(self, "/?kakao_login=1", [session_cookie(token)])
        except Exception as e:
            _log_kakao("callback error: %s" % e)
            d = urllib.parse.quote(str(e)[:400])
            return redirect_response(self, "/?kakao_error=server&kakao_detail=" + d)

    def _kidikidi_search(self):
        p = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        q = (p.get("q") or [""])[0].strip()
        try:
            lim = max(1, min(12, int((p.get("limit") or ["4"])[0])))
        except ValueError:
            lim = 4
        if not q:
            return json_response(self, 400, {"error": "missing q"})
        url = SEARCH + "?q=" + urllib.parse.quote(q)
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://kidikidi.elandmall.co.kr/",
        })
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                data = json.loads(r.read().decode())
        except Exception as e:
            return json_response(self, 502, {"error": "kidikidi_unreachable", "detail": str(e)})
        d = data.get("data") or {}
        items, total = [], 0
        for key in ("srchOutCome", "item"):
            blk = d.get(key)
            if not isinstance(blk, dict):
                continue
            item_blk = blk.get("item") if isinstance(blk.get("item"), dict) else blk
            lst = (item_blk or {}).get("list") or []
            if lst:
                items, total = lst, (item_blk or {}).get("total") or len(lst)
                break
        return json_response(self, 200, {
            "keyword": q,
            "total": total or len(items),
            "products": map_items(items[:lim]),
        })


class Server(ThreadingHTTPServer):
    # Windows에서 SO_REUSEADDR는 이미 점유된 포트에도 중복 bind 를 허용한다.
    # 끄면 두 번째 인스턴스가 정상적으로 'address in use' 로 실패해 stale 서버가 쌓이지 않는다.
    allow_reuse_address = False
    daemon_threads = True


if __name__ == "__main__":
    ensure_dirs()
    db.init_db()
    migrated = db.import_legacy_photos_json(os.path.join(ROOT, "data", "photos.json"))
    if migrated:
        print("Imported %d photos from legacy photos.json" % migrated)

    port = server_port()
    try:
        httpd = Server(("", port), H)
    except OSError:
        print("port %d in use - another server.py may be running. Close it first." % port)
        raise SystemExit(1)

    print("BEBEBOX: http://localhost:%d" % port)
    print("Backend: SQLite (data/bebebox.db) + uploads/")
    print("Kidikidi proxy: /api/kidikidi/search")
    if ka.is_configured():
        print("Kakao login: enabled (%s)" % ka.redirect_uri(port))
    else:
        print("Kakao login: off (set KAKAO_REST_API_KEY in .env)")
    httpd.serve_forever()
