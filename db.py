"""BEBEBOX 로컬 백엔드 데이터 계층 (SQLite, 표준 라이브러리만 사용).

외부 서비스(클라우드 DB) 없이 단일 파일 DB(data/bebebox.db)에 저장한다.
- photos: 사진 메타데이터 (파일은 uploads/ 에 저장)
- family_data: 가족 단위 앱 상태(위시리스트·펀딩·프로필 등) JSON
- sessions: 카카오 로그인 세션
"""
import json
import os
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
        if q and q not in fam.lower() and q not in baby.lower():
            continue
        published = sum(1 for v in (data.get("published") or {}).values() if v)
        received = sum(1 for v in (data.get("owned") or {}).values() if v)
        j = journey_summary(fam)["funnel"]
        out.append({
            "family_id": fam, "user_id": fam, "baby": baby,
            "records": len(data.get("posts") or []),
            "published": published, "received": received,
            "views": j["views"], "gift_clicks": j["gift_clicks"], "gifts_done": j["gifts_done"],
            "guests": len(journey_summary(fam)["guests"]),
            "updated_at": row["updated_at"],
        })
    return out


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
    # 선물 퍼즐도 포함
    for g in (data.get("giftPuzzles") or []):
        to_give.append({
            "item_id": g.get("id"), "name": g.get("productName") or "선물",
            "received": (len(g.get("pieces") or []) >= (g.get("total") or 9)),
            "giver": None, "puzzle": "%d/%d" % (len(g.get("pieces") or []), g.get("total") or 9),
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
    return {
        "family_id": fam, "user_id": fam, "baby": baby,
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
    return {
        "families": fam,
        "events": ev,
        "by_type": {r["type"]: r["n"] for r in by},
    }
