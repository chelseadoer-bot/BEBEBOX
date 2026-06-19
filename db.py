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
DATA_DIR = os.path.join(ROOT, "data")
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
