"""BEBEBOX 로컬 백엔드 데이터 계층 (SQLite, 표준 라이브러리만 사용).

외부 서비스(클라우드 DB) 없이 단일 파일 DB(data/bebebox.db)에 저장한다.
- photos: 사진 메타데이터 (파일은 uploads/ 에 저장)
- family_data: 가족 단위 앱 상태(위시리스트·펀딩·프로필 등) JSON
- sessions: 카카오 로그인 세션
"""
import json
import os
import random
import sqlite3
import time
import uuid

ROOT = os.path.dirname(os.path.abspath(__file__))
# 배포 시 영구 디스크 경로를 환경변수로 지정할 수 있다(없으면 로컬 data/).
DATA_DIR = os.environ.get("BEBEBOX_DATA_DIR") or os.path.join(ROOT, "data")
DB_PATH = os.path.join(DATA_DIR, "bebebox.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS photos (
    id          TEXT PRIMARY KEY,
    family_id   TEXT NOT NULL,
    src         TEXT NOT NULL,
    stored_file TEXT,
    created_at  INTEGER NOT NULL,
    age_month   INTEGER DEFAULT 9,
    likes       INTEGER DEFAULT 0,
    liked       INTEGER DEFAULT 0,
    comments    TEXT DEFAULT '[]',
    caption     TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_photos_family ON photos (family_id, created_at DESC);

CREATE TABLE IF NOT EXISTS family_data (
    family_id  TEXT PRIMARY KEY,
    data       TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user       TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

-- 고객 여정(이벤트) 로그: 모든 핵심 행동이 여기에 쌓인다.
CREATE TABLE IF NOT EXISTS events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id  TEXT NOT NULL,
    user_id    TEXT,            -- 회원/행위자 식별자 (부모=가족코드/카카오, 지인=g:이름)
    actor      TEXT,            -- parent | guest
    name       TEXT,            -- 행위자 이름(지인 등)
    type       TEXT NOT NULL,   -- signup/record/share/gift_click/gift_done/heart/comment/coupon ...
    item_id    TEXT,
    meta       TEXT DEFAULT '{}',
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_family ON events (family_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type ON events (type);

-- 쿠폰 지급(발급) 상태: 운영자가 키디키디 쿠폰을 실제로 발급했는지 체크.
CREATE TABLE IF NOT EXISTS coupon_fulfillment (
    family_id    TEXT NOT NULL,
    coupon_id    TEXT NOT NULL,
    fulfilled    INTEGER DEFAULT 0,
    fulfilled_at INTEGER,
    note         TEXT DEFAULT '',
    PRIMARY KEY (family_id, coupon_id)
);

-- 사이트 전역 설정(운영자 편집): 게임 탭 상단 배너 등.
CREATE TABLE IF NOT EXISTS site_config (
    key        TEXT PRIMARY KEY,
    value      TEXT,
    updated_at INTEGER
);

-- 고객 1:1 문의(비공개): 본인(가족코드) 것만 조회. 운영자가 답변.
CREATE TABLE IF NOT EXISTS inquiries (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id  TEXT NOT NULL,
    category   TEXT DEFAULT '',
    message    TEXT NOT NULL,
    status     TEXT DEFAULT 'open',   -- open | answered
    reply      TEXT DEFAULT '',
    created_at INTEGER NOT NULL,
    replied_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_inquiries_family ON inquiries (family_id, created_at DESC);

-- 카카오 계정 ↔ 가족코드 매핑: 브라우저(카톡 인앱/사파리)가 달라도 같은 카카오 계정이면
-- 같은 가족코드를 쓰게 해 중복 아이디(기록 분리)를 막는다.
CREATE TABLE IF NOT EXISTS kakao_family (
    kakao_id   TEXT PRIMARY KEY,
    family_id  TEXT NOT NULL,
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_kakao_family_fam ON kakao_family (family_id);
"""


def _conn():
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    with _conn() as conn:
        conn.executescript(SCHEMA)
        # 기존 DB 마이그레이션: events.user_id 컬럼이 없으면 추가
        cols = [r["name"] for r in conn.execute("PRAGMA table_info(events)").fetchall()]
        if "user_id" not in cols:
            try:
                conn.execute("ALTER TABLE events ADD COLUMN user_id TEXT")
            except sqlite3.OperationalError:
                pass
        conn.execute("CREATE INDEX IF NOT EXISTS idx_events_user ON events (user_id)")


def now_ms():
    return int(time.time() * 1000)


# ---------------------------------------------------------------- photos
def _row_to_photo(row):
    return {
        "id": row["id"],
        "family_id": row["family_id"],
        "src": row["src"],
        "storedFile": row["stored_file"],
        "createdAt": row["created_at"],
        "ageMonth": row["age_month"],
        "likes": row["likes"],
        "liked": bool(row["liked"]),
        "comments": json.loads(row["comments"] or "[]"),
        "caption": row["caption"] or "",
    }


def list_photos(family_id):
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM photos WHERE family_id = ? ORDER BY created_at DESC",
            (family_id,),
        ).fetchall()
    return [_row_to_photo(r) for r in rows]


def insert_photo(photo):
    with _conn() as conn:
        conn.execute(
            """INSERT INTO photos
               (id, family_id, src, stored_file, created_at, age_month, likes, liked, comments, caption)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                photo["id"],
                photo["family_id"],
                photo["src"],
                photo.get("storedFile"),
                photo.get("createdAt") or now_ms(),
                photo.get("ageMonth") or 9,
                photo.get("likes") or 0,
                1 if photo.get("liked") else 0,
                json.dumps(photo.get("comments") or [], ensure_ascii=False),
                photo.get("caption") or "",
            ),
        )
    return photo


def get_photo(photo_id):
    with _conn() as conn:
        row = conn.execute("SELECT * FROM photos WHERE id = ?", (photo_id,)).fetchone()
    return _row_to_photo(row) if row else None


def delete_photo(photo_id, family_id=None):
    """삭제 성공 시 저장 파일 상대경로를 반환(없으면 ''), 대상 없으면 None."""
    with _conn() as conn:
        row = conn.execute("SELECT * FROM photos WHERE id = ?", (photo_id,)).fetchone()
        if not row:
            return None
        if family_id and row["family_id"] != family_id:
            return None
        stored = row["stored_file"] or ""
        conn.execute("DELETE FROM photos WHERE id = ?", (photo_id,))
    return stored


# ----------------------------------------------------------- family data
def get_family_data(family_id):
    with _conn() as conn:
        row = conn.execute(
            "SELECT family_id, data, updated_at FROM family_data WHERE family_id = ?",
            (family_id,),
        ).fetchone()
    if not row:
        return None
    return {
        "family_id": row["family_id"],
        "data": json.loads(row["data"] or "{}"),
        "updated_at": row["updated_at"],
    }


def upsert_family_data(family_id, data, updated_at=None):
    updated_at = updated_at or now_ms()
    payload = json.dumps(data, ensure_ascii=False)
    with _conn() as conn:
        conn.execute(
            """INSERT INTO family_data (family_id, data, updated_at)
               VALUES (?, ?, ?)
               ON CONFLICT(family_id) DO UPDATE SET
                   data = excluded.data,
                   updated_at = excluded.updated_at""",
            (family_id, payload, updated_at),
        )
    return {"family_id": family_id, "data": data, "updated_at": updated_at}


# -------------------------------------------------------------- sessions
def create_session(user):
    token = uuid.uuid4().hex
    with _conn() as conn:
        conn.execute(
            "INSERT INTO sessions (token, user, created_at) VALUES (?, ?, ?)",
            (token, json.dumps(user, ensure_ascii=False), now_ms()),
        )
    return token, user


def get_session(token):
    if not token:
        return None
    with _conn() as conn:
        row = conn.execute(
            "SELECT user FROM sessions WHERE token = ?", (token,)
        ).fetchone()
    return json.loads(row["user"]) if row else None


def delete_session(token):
    if not token:
        return
    with _conn() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))


# ------------------------------------------------ one-time migration aid
def import_legacy_photos_json(json_path):
    """기존 data/photos.json 이 있으면 DB가 비어있을 때 한 번 가져온다."""
    if not os.path.isfile(json_path):
        return 0
    try:
        with open(json_path, encoding="utf-8") as f:
            payload = json.load(f)
        legacy = payload.get("photos") or []
    except (json.JSONDecodeError, OSError):
        return 0
    if not legacy:
        return 0
    with _conn() as conn:
        existing = conn.execute("SELECT COUNT(*) AS n FROM photos").fetchone()["n"]
    if existing:
        return 0
    count = 0
    for p in legacy:
        src = p.get("src") or ""
        stored = src.split("/uploads/", 1)[1] if "/uploads/" in src else None
        insert_photo({
            "id": p.get("id") or ("p" + uuid.uuid4().hex[:12]),
            "family_id": (p.get("family_id") or "BEBEBOX").upper(),
            "src": src,
            "storedFile": stored,
            "createdAt": p.get("createdAt") or now_ms(),
            "ageMonth": p.get("ageMonth") or 9,
            "likes": p.get("likes") or 0,
            "liked": p.get("liked"),
            "comments": p.get("comments") or [],
            "caption": p.get("caption") or "",
        })
        count += 1
    return count


# ---------------------------------------------------- 고객 여정(이벤트)
def insert_event(family_id, type_, actor=None, name=None, item_id=None, meta=None, user_id=None):
    fam = (family_id or "BEBEBOX").strip().upper()
    if not user_id:
        user_id = ("g:" + name) if (actor == "guest" and name) else fam
    with _conn() as conn:
        conn.execute(
            """INSERT INTO events (family_id, user_id, actor, name, type, item_id, meta, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (fam, user_id, actor, name, type_, item_id,
             json.dumps(meta or {}, ensure_ascii=False), now_ms()),
        )
    return True


# --------------------------------------------- 운영자: 회원(가족) 검색/상세
def _all_family_rows():
    with _conn() as conn:
        return conn.execute(
            "SELECT family_id, data, updated_at FROM family_data ORDER BY updated_at DESC"
        ).fetchall()


def _item_name_map(data):
    """위시/선물퍼즐 id → 표시 이름."""
    m = {}
    for arr in (data.get("wishlist") or {}).values():
        for it in (arr or []):
            if it and it.get("id"):
                m[it["id"]] = (it.get("emoji", "") + " " + (it.get("name") or "")).strip()
    for g in (data.get("giftPuzzles") or []):
        if g.get("id"):
            m[g["id"]] = g.get("productName") or "선물"
    return m


def list_members(q=None):
    """회원(가족) 요약 목록 + 검색(가족코드/아기이름)."""
    q = (q or "").strip().lower()
    out = []
    for row in _all_family_rows():
        try:
            data = json.loads(row["data"] or "{}")
        except json.JSONDecodeError:
            data = {}
        fam = row["family_id"]
        profile = data.get("profile") or {}
        baby = profile.get("babyName") or (profile.get("name") or "").replace("의 일기", "") or "우리 아기"
        kidikidi = (profile.get("kidikidiId") or "").strip()
        if q and q not in fam.lower() and q not in baby.lower() and q not in kidikidi.lower():
            continue
        published = sum(1 for v in (data.get("published") or {}).values() if v)
        received = sum(1 for v in (data.get("owned") or {}).values() if v)
        summary = journey_summary(fam)
        j = summary["funnel"]
        out.append({
            "family_id": fam, "user_id": fam, "baby": baby,
            "kidikidi_id": (profile.get("kidikidiId") or "").strip(),
            "points": int(data.get("points") or 0),
            "coupons": len(data.get("coupons") or []),
            "records": len(data.get("posts") or []),
            "published": published, "received": received,
            "views": j["views"], "gift_clicks": j["gift_clicks"], "gifts_done": j["gifts_done"],
            "guests": len(summary["guests"]),
            "updated_at": row["updated_at"],
        })
    out.sort(key=lambda m: -(m["points"]))
    return out


# ── 캔디(포인트) 원장: 이벤트 로그를 캔디 규칙(POINT_RULES 미러)으로 환산 ──
# ⚠️ 캔디 잔액(data.points)은 클라이언트가 계산해 서버에 '동기화'하는 값이라,
#    이 원장은 서버 이벤트로 재구성한 '추정치'다. run_finish(+5)/좋아요(+10/200)/
#    미션보너스(+100)/최초기록 등 이벤트로 남지 않는 적립은 빠질 수 있어 동기화
#    잔액(synced)과 차이(untracked)가 날 수 있다. (points.js POINT_RULES 참고)
_CANDY_RULES = {
    # 적립(earn)
    "record":           ("earn",  "기록 올리기",        20),
    "miniapp_share":    ("earn",  "AI 결과 공유",       30),
    "share":            ("earn",  "사진첩·링크 공유",   30),
    "gift_received":    ("earn",  "선물 받음",          50),
    "miniapp_refund":   ("earn",  "생성 실패 환불",     None),   # meta.amount
    "referral_redeem":  ("earn",  "추천·이벤트 코드",   None),   # 코드별 지급액
    # 소멸(spend)
    "miniapp_spend":    ("spend", "AI·게임 이용",       None),   # meta.amount(기본10)
    "coupon":           ("spend", "쿠폰 교환",          100),
    # 행동만(캔디 변동 없음)
    "miniapp_generate": ("act",   "AI 결과 생성",       0),
    "miniapp_request":  ("act",   "AI 생성 요청",       0),
    "ai_app":           ("act",   "미니앱 진입",        0),
    "ai_concept":       ("act",   "컨셉 선택",          0),
    "concept_run":      ("act",   "컨셉 생성",          0),
    "run_open":         ("act",   "게임 열기",          0),
    "publish":          ("act",   "위시 공개",          0),
    "wish_add":         ("act",   "위시 추가",          0),
    "inquiry":          ("act",   "1:1 문의",           0),
    "signup":           ("act",   "가입",               0),
    "share_view":       ("act",   "지인: 공유 조회",    0),
    "gift_click":       ("act",   "지인: 선물 클릭",    0),
    "gift_done":        ("act",   "지인: 선물 완료",    0),
    "heart":            ("act",   "지인: 하트",         0),
    "comment":          ("act",   "지인: 댓글",         0),
}


def _referral_candy_map():
    """추천·이벤트 코드 → 지급 캔디 {CODE: candy}."""
    out = {}
    for it in (get_config(_REFERRAL_KEY, []) or []):
        if isinstance(it, dict) and it.get("code"):
            out[_norm_code(it.get("code"))] = int(it.get("candy") or 0)
    return out


def candy_ledger(family_id, limit=150):
    """한 가족의 캔디 적립·소멸·행동 원장(서버 이벤트 기반 추정)."""
    fam = (family_id or "BEBEBOX").strip().upper()
    refmap = _referral_candy_map()
    with _conn() as conn:
        rows = conn.execute(
            "SELECT type, item_id, meta, actor, created_at FROM events "
            "WHERE family_id=? ORDER BY created_at DESC", (fam,),
        ).fetchall()
    earned = spent = 0
    entries = []
    for r in rows:
        typ = r["type"]
        kind, label, fixed = _CANDY_RULES.get(typ, ("act", typ, 0))
        try:
            meta = json.loads(r["meta"] or "{}")
        except (json.JSONDecodeError, TypeError):
            meta = {}
        if typ == "referral_redeem":
            delta = refmap.get(_norm_code(r["item_id"]), 0)
        elif typ == "miniapp_spend":
            delta = -int(meta.get("amount") or 10)
        elif typ == "miniapp_refund":
            delta = int(meta.get("amount") or 0)
        elif kind == "spend":
            delta = -int(fixed or 0)
        else:
            delta = int(fixed or 0)
        if delta > 0:
            earned += delta
        elif delta < 0:
            spent += -delta
        if len(entries) < limit:
            entries.append({
                "type": typ, "label": label, "kind": kind, "delta": delta,
                "actor": r["actor"], "item_id": r["item_id"],
                "created_at": r["created_at"],
            })
    return {"entries": entries, "total_events": len(rows),
            "earned": earned, "spent": spent, "net": earned - spent}


def member_detail(family_id):
    """회원 상세: 받아야/받은 선물, 누가 얼마나 조각을 썼는지, 타임라인."""
    fam = (family_id or "BEBEBOX").strip().upper()
    r = get_family_data(fam)
    data = (r or {}).get("data") or {}
    profile = data.get("profile") or {}
    baby = profile.get("babyName") or (profile.get("name") or "").replace("의 일기", "") or "우리 아기"
    names = _item_name_map(data)
    published = data.get("published") or {}
    owned = data.get("owned") or {}
    giftedBy = data.get("giftedBy") or {}

    # 공개된 위시(=받아야 할/받은 선물)
    to_give = []
    for iid in published:
        if not published[iid]:
            continue
        to_give.append({
            "item_id": iid, "name": names.get(iid, iid),
            "received": bool(owned.get(iid)), "giver": giftedBy.get(iid) or None,
        })

    # 누가 얼마나 조각을 썼는지: 방명록 + 부모 기록 + 이벤트 집계
    givers = {}
    def _g(name):
        return givers.setdefault(name, {"name": name, "pieces": 0, "items": [], "messages": [], "relationship": None})
    for gb in (data.get("guestbook") or []):
        g = _g(gb.get("guest_name") or "익명")
        g["pieces"] += 1
        nm = names.get(gb.get("item_id"), gb.get("item_id"))
        if nm:
            g["items"].append(nm)
        if gb.get("relationship"):
            g["relationship"] = gb["relationship"]
        if gb.get("message"):
            g["messages"].append(gb["message"])
    for iid, who in giftedBy.items():
        if not who:
            continue
        g = _g(who)
        if names.get(iid) and names.get(iid) not in g["items"]:
            g["pieces"] += 1
            g["items"].append(names.get(iid))

    js = journey_summary(fam)
    fmap = _fulfillment_map()
    coupons = []
    for c in (data.get("coupons") or []):
        cid = c.get("id") or ""
        ful = fmap.get((fam, cid))
        coupons.append({
            "coupon_id": cid, "amount": c.get("amount") or 0,
            "code": c.get("code") or "", "created_at": c.get("createdAt") or 0,
            "expires": c.get("expires") or "",
            "fulfilled": bool(ful and ful["fulfilled"]),
            "fulfilled_at": (ful or {}).get("fulfilled_at"),
        })
    coupons.sort(key=lambda c: (c["fulfilled"], -(c["created_at"] or 0)))
    led = candy_ledger(fam)
    led["synced"] = int(data.get("points") or 0)
    led["untracked"] = led["synced"] - led["net"]
    return {
        "family_id": fam, "user_id": fam, "baby": baby,
        "kidikidi_id": (profile.get("kidikidiId") or "").strip(),
        "points": int(data.get("points") or 0),
        "ledger": led,
        "coupons": coupons,
        "funnel": js["funnel"],
        "to_give": to_give,
        "givers": sorted(givers.values(), key=lambda x: -x["pieces"]),
        "guests": js["guests"],
        "recent": js["recent"],
    }


def journey_summary(family_id):
    """한 가족(고객)의 여정 요약: 단계별 카운트 + 지인 목록 + 최근 활동."""
    fam = (family_id or "BEBEBOX").strip().upper()
    with _conn() as conn:
        rows = conn.execute(
            "SELECT actor, name, type, item_id, meta, created_at FROM events WHERE family_id = ? ORDER BY created_at DESC",
            (fam,),
        ).fetchall()
    counts, guests, recent = {}, {}, []
    for r in rows:
        counts[r["type"]] = counts.get(r["type"], 0) + 1
        if r["actor"] == "guest" and r["name"]:
            g = guests.setdefault(r["name"], {"name": r["name"], "gift_click": 0, "gift_done": 0, "heart": 0, "comment": 0})
            if r["type"] in g:
                g[r["type"]] += 1
        if len(recent) < 30:
            recent.append({
                "actor": r["actor"], "name": r["name"], "type": r["type"],
                "item_id": r["item_id"], "created_at": r["created_at"],
            })
    # 전환 깔때기(가족 단위)
    funnel = {
        "views": counts.get("share_view", 0),
        "gift_clicks": counts.get("gift_click", 0),
        "gifts_done": counts.get("gift_done", 0),
        "hearts": counts.get("heart", 0),
        "comments": counts.get("comment", 0),
        "records": counts.get("record", 0),
        "shares": counts.get("share", 0),
        "miniapps": counts.get("miniapp_generate", 0),
    }
    return {
        "family_id": fam,
        "funnel": funnel,
        "counts": counts,
        "guests": sorted(guests.values(), key=lambda x: -(x["gift_done"] * 10 + x["gift_click"])),
        "recent": recent,
        "total_events": len(rows),
    }


def global_stats():
    """플랫폼 전체 지표(운영자용)."""
    with _conn() as conn:
        fam = conn.execute("SELECT COUNT(*) AS n FROM family_data").fetchone()["n"]
        ev = conn.execute("SELECT COUNT(*) AS n FROM events").fetchone()["n"]
        by = conn.execute("SELECT type, COUNT(*) AS n FROM events GROUP BY type").fetchall()
    q = coupon_queue()
    pending = sum(1 for c in q if not c["fulfilled"])
    return {
        "families": fam,
        "events": ev,
        "by_type": {r["type"]: r["n"] for r in by},
        "coupons_total": len(q),
        "coupons_pending": pending,
        "coupons_done": len(q) - pending,
    }


# ------------------------------------------------------- 쿠폰 지급(발급) 관리
def _fulfillment_map():
    """{(family_id, coupon_id): row} 형태로 발급 상태를 반환."""
    with _conn() as conn:
        rows = conn.execute("SELECT * FROM coupon_fulfillment").fetchall()
    return {(r["family_id"], r["coupon_id"]): dict(r) for r in rows}


def coupon_queue():
    """전 회원의 '교환된 쿠폰' 목록 = 운영자가 키디키디 쿠폰을 발급해 줘야 할 큐.

    각 항목: 아기/가족코드, 키디키디 아이디, 쿠폰(금액·코드·교환일), 발급 여부.
    미발급(대기)을 위로, 최신 교환순으로 정렬한다.
    """
    fmap = _fulfillment_map()
    out = []
    for row in _all_family_rows():
        try:
            data = json.loads(row["data"] or "{}")
        except json.JSONDecodeError:
            data = {}
        fam = row["family_id"]
        profile = data.get("profile") or {}
        baby = profile.get("babyName") or (profile.get("name") or "").replace("의 일기", "") or "우리 아기"
        kidikidi = (profile.get("kidikidiId") or "").strip()
        points = int(data.get("points") or 0)
        for c in (data.get("coupons") or []):
            cid = c.get("id") or ""
            ful = fmap.get((fam, cid))
            out.append({
                "family_id": fam, "baby": baby, "kidikidi_id": kidikidi,
                "coupon_id": cid,
                "amount": c.get("amount") or 0,
                "code": c.get("code") or "",
                "label": c.get("label") or "장바구니 쿠폰",
                "created_at": c.get("createdAt") or 0,
                "expires": c.get("expires") or "",
                "points": points,
                "fulfilled": bool(ful and ful["fulfilled"]),
                "fulfilled_at": (ful or {}).get("fulfilled_at"),
                "missing_kidikidi": not kidikidi,
            })
    out.sort(key=lambda c: (c["fulfilled"], -(c["created_at"] or 0)))
    return out


def get_config(key, default=None):
    with _conn() as conn:
        r = conn.execute("SELECT value FROM site_config WHERE key=?", (key,)).fetchone()
    if not r or r["value"] is None:
        return default
    try:
        return json.loads(r["value"])
    except (json.JSONDecodeError, TypeError):
        return default


def set_config(key, value):
    with _conn() as conn:
        conn.execute(
            "INSERT INTO site_config(key, value, updated_at) VALUES(?,?,?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
            (key, json.dumps(value, ensure_ascii=False), now_ms()),
        )
    return True


# ---------------------------------------------------------------- 고객 1:1 문의
def _row_to_inquiry(row):
    return {
        "id": row["id"],
        "family_id": row["family_id"],
        "category": row["category"] or "",
        "message": row["message"] or "",
        "status": row["status"] or "open",
        "reply": row["reply"] or "",
        "created_at": row["created_at"],
        "replied_at": row["replied_at"],
    }


def create_inquiry(family_id, category, message):
    ts = now_ms()
    with _conn() as conn:
        cur = conn.execute(
            "INSERT INTO inquiries(family_id, category, message, status, created_at) "
            "VALUES(?,?,?, 'open', ?)",
            (family_id, (category or "")[:40], (message or "")[:2000], ts),
        )
        rid = cur.lastrowid
    return {
        "id": rid, "family_id": family_id, "category": category or "",
        "message": message or "", "status": "open", "reply": "",
        "created_at": ts, "replied_at": None,
    }


def list_inquiries(family_id):
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM inquiries WHERE family_id=? ORDER BY created_at DESC LIMIT 100",
            (family_id,),
        ).fetchall()
    return [_row_to_inquiry(r) for r in rows]


def list_all_inquiries(limit=300):
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM inquiries ORDER BY created_at DESC LIMIT ?", (int(limit),)
        ).fetchall()
    return [_row_to_inquiry(r) for r in rows]


def reply_inquiry(inquiry_id, reply_text):
    with _conn() as conn:
        conn.execute(
            "UPDATE inquiries SET reply=?, status='answered', replied_at=? WHERE id=?",
            ((reply_text or "")[:4000], now_ms(), int(inquiry_id)),
        )
    return True


# ---------------------------------------------------------------- 카카오↔가족코드 매핑
_FAMILY_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _gen_family_code(conn):
    for _ in range(30):
        code = "".join(random.choice(_FAMILY_CHARS) for _ in range(6))
        if not conn.execute("SELECT 1 FROM kakao_family WHERE family_id=?", (code,)).fetchone():
            return code
    return "".join(random.choice(_FAMILY_CHARS) for _ in range(6))


def get_kakao_family(kakao_id):
    kid = str(kakao_id or "").strip()
    if not kid:
        return None
    with _conn() as conn:
        row = conn.execute(
            "SELECT family_id FROM kakao_family WHERE kakao_id=?", (kid,)
        ).fetchone()
    return row["family_id"] if row else None


def link_kakao_family(kakao_id, family_code):
    """카카오 계정의 '정식' 가족코드를 반환한다.
    - 이미 매핑돼 있으면 그 코드(기존 우선 → 기존 기록 보존)
    - 없으면 클라이언트가 보낸 현재 코드를 그 계정 것으로 등록(비었으면 새로 생성)
    """
    kid = str(kakao_id or "").strip()
    if not kid:
        return None
    with _conn() as conn:
        row = conn.execute(
            "SELECT family_id FROM kakao_family WHERE kakao_id=?", (kid,)
        ).fetchone()
        if row:
            return row["family_id"]
        code = (family_code or "").strip().upper()
        if not code or code == "BEBEBOX":
            code = _gen_family_code(conn)
        try:
            conn.execute(
                "INSERT INTO kakao_family(kakao_id, family_id, created_at) VALUES(?,?,?)",
                (kid, code, now_ms()),
            )
        except sqlite3.IntegrityError:
            # 동시 요청 경합: 다시 조회해 반환
            row = conn.execute(
                "SELECT family_id FROM kakao_family WHERE kakao_id=?", (kid,)
            ).fetchone()
            if row:
                return row["family_id"]
        return code


# ------------------------------------------------ 추천인코드(리퍼럴) 캔디 지급
# 운영자가 코드→지급 캔디를 등록(site_config['referrals'])하고, 회원이 가입 시
# 코드를 입력하면 1가족당 1회 교환(events type='referral_redeem')해 캔디를 준다.
_REFERRAL_KEY = "referrals"


def _norm_code(code):
    return (code or "").strip().upper()


def _referral_counts():
    """코드별 교환 횟수 {CODE: n}."""
    with _conn() as conn:
        rows = conn.execute(
            "SELECT item_id, COUNT(*) AS n FROM events "
            "WHERE type='referral_redeem' GROUP BY item_id"
        ).fetchall()
    return {_norm_code(r["item_id"]): r["n"] for r in rows}


def list_referrals():
    """등록된 추천인코드 목록 + 각 코드 교환 횟수(운영자 대시보드용)."""
    raw = get_config(_REFERRAL_KEY, []) or []
    counts = _referral_counts()
    out = []
    for it in raw:
        if not isinstance(it, dict):
            continue
        code = _norm_code(it.get("code"))
        if not code:
            continue
        out.append({
            "code": code,
            "candy": int(it.get("candy") or 0),
            "active": bool(it.get("active", True)),
            "note": (it.get("note") or "")[:60],
            "redeemed": counts.get(code, 0),
        })
    out.sort(key=lambda x: -x["redeemed"])
    return out


def save_referral(code, candy, active=True, note=""):
    """추천인코드 추가/수정(같은 코드면 덮어씀)."""
    code = _norm_code(code)
    if not code:
        return False
    candy = max(0, int(candy or 0))
    lst = get_config(_REFERRAL_KEY, []) or []
    if not isinstance(lst, list):
        lst = []
    found = False
    for it in lst:
        if isinstance(it, dict) and _norm_code(it.get("code")) == code:
            it["candy"] = candy
            it["active"] = bool(active)
            it["note"] = (note or "")[:60]
            found = True
            break
    if not found:
        lst.append({"code": code, "candy": candy,
                    "active": bool(active), "note": (note or "")[:60]})
    set_config(_REFERRAL_KEY, lst)
    return True


def delete_referral(code):
    code = _norm_code(code)
    lst = get_config(_REFERRAL_KEY, []) or []
    if not isinstance(lst, list):
        lst = []
    lst = [it for it in lst
           if isinstance(it, dict) and _norm_code(it.get("code")) != code]
    set_config(_REFERRAL_KEY, lst)
    return True


def get_active_referral(code):
    """활성 코드면 {code, candy} 반환, 아니면 None."""
    code = _norm_code(code)
    for it in (get_config(_REFERRAL_KEY, []) or []):
        if (isinstance(it, dict) and _norm_code(it.get("code")) == code
                and bool(it.get("active", True))):
            return {"code": code, "candy": int(it.get("candy") or 0)}
    return None


def has_referral_redemption(family_id):
    fam = (family_id or "").strip().upper()
    if not fam:
        return False
    with _conn() as conn:
        r = conn.execute(
            "SELECT COUNT(*) AS n FROM events "
            "WHERE family_id=? AND type='referral_redeem'",
            (fam,),
        ).fetchone()
    return bool(r and r["n"])


def redeem_referral(family_id, code):
    """가족이 추천인코드를 1회 교환한다.
       성공: {ok:True, code, candy}, 실패: {ok:False, reason}."""
    fam = (family_id or "").strip().upper()
    code = _norm_code(code)
    if not fam or len(fam) < 3 or not code:
        return {"ok": False, "reason": "invalid"}
    ref = get_active_referral(code)
    if not ref:
        return {"ok": False, "reason": "not_found"}
    if has_referral_redemption(fam):
        return {"ok": False, "reason": "already"}
    insert_event(fam, "referral_redeem", actor="parent", item_id=code,
                 meta={"code": code, "candy": ref["candy"]}, user_id=fam)
    return {"ok": True, "code": code, "candy": ref["candy"]}


def reset_referral_redemptions(code):
    """해당 코드의 교환 기록(사용 인원 집계)을 모두 삭제. 테스트/캠페인 리셋용.
       (이미 지급된 회원 캔디 잔액에는 영향 없음 — 카운트만 초기화)"""
    code = _norm_code(code)
    if not code:
        return 0
    with _conn() as conn:
        n = conn.execute(
            "DELETE FROM events WHERE type='referral_redeem' AND UPPER(item_id)=?",
            (code,),
        ).rowcount
    return n


def delete_family(family_id):
    """회원 탈퇴: 가족 데이터·사진·이벤트·쿠폰발급기록 전부 삭제. 사진 파일명 목록 반환."""
    fam = (family_id or "").strip().upper()
    if not fam:
        return []
    with _conn() as conn:
        rows = conn.execute("SELECT stored_file FROM photos WHERE family_id=?", (fam,)).fetchall()
        conn.execute("DELETE FROM family_data WHERE family_id=?", (fam,))
        conn.execute("DELETE FROM photos WHERE family_id=?", (fam,))
        conn.execute("DELETE FROM events WHERE family_id=?", (fam,))
        conn.execute("DELETE FROM coupon_fulfillment WHERE family_id=?", (fam,))
    return [r["stored_file"] for r in rows if r["stored_file"]]


def family_coupon_status(family_id):
    """한 가족의 쿠폰별 발급(지급) 상태: {coupon_id: {fulfilled, fulfilled_at}}."""
    fam = (family_id or "").strip().upper()
    with _conn() as conn:
        rows = conn.execute(
            "SELECT coupon_id, fulfilled, fulfilled_at FROM coupon_fulfillment WHERE family_id=?",
            (fam,),
        ).fetchall()
    return {r["coupon_id"]: {"fulfilled": bool(r["fulfilled"]), "fulfilled_at": r["fulfilled_at"]} for r in rows}


def set_coupon_fulfilled(family_id, coupon_id, fulfilled=True, note=""):
    fam = (family_id or "").strip().upper()
    cid = (coupon_id or "").strip()
    if not fam or not cid:
        return False
    with _conn() as conn:
        conn.execute(
            "INSERT INTO coupon_fulfillment(family_id, coupon_id, fulfilled, fulfilled_at, note) "
            "VALUES(?,?,?,?,?) ON CONFLICT(family_id, coupon_id) DO UPDATE SET "
            "fulfilled=excluded.fulfilled, fulfilled_at=excluded.fulfilled_at, note=excluded.note",
            (fam, cid, 1 if fulfilled else 0, now_ms() if fulfilled else None, note or ""),
        )
    return True
