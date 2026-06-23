# -*- coding: utf-8 -*-
"""
표준 앱 DB 모듈 (모든 미니앱 동일 규격).
앱별 자체 SQLite(완전 독립). _HUB가 이 파일을 읽어 표준 스키마로 집계한다.
"""
import os
import json
import hashlib
import sqlite3
from datetime import datetime, timezone

import config

_SCHEMA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "schema.sql")


def _now():
    return datetime.now(timezone.utc).isoformat()


def _conn():
    c = sqlite3.connect(config.DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def init_db():
    with open(_SCHEMA, "r", encoding="utf-8") as f:
        sql = f.read()
    with _conn() as c:
        c.executescript(sql)


def input_hash(inputs):
    raw = json.dumps(inputs, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


def touch_user(uid):
    now = _now()
    with _conn() as c:
        c.execute(
            "INSERT INTO users(uid, first_seen, last_seen) VALUES(?,?,?) "
            "ON CONFLICT(uid) DO UPDATE SET last_seen=excluded.last_seen",
            (uid, now, now),
        )


def find_by_hash(uid, ihash):
    with _conn() as c:
        row = c.execute(
            "SELECT * FROM records WHERE uid=? AND input_hash=? ORDER BY id DESC LIMIT 1",
            (uid, ihash),
        ).fetchone()
    return _row_to_dict(row) if row else None


def save_record(uid, app_id, inputs, output, media=None, ihash=None):
    now = _now()
    with _conn() as c:
        cur = c.execute(
            "INSERT INTO records(uid, app_id, created_at, status, input_json, output_json, media_json, input_hash) "
            "VALUES(?,?,?,?,?,?,?,?)",
            (
                uid, app_id, now, "done",
                json.dumps(inputs, ensure_ascii=False),
                json.dumps(output, ensure_ascii=False),
                json.dumps(media or [], ensure_ascii=False),
                ihash,
            ),
        )
        return cur.lastrowid


def delete_user_records(uid, app_id):
    with _conn() as c:
        c.execute("DELETE FROM records WHERE uid=? AND app_id=?", (uid, app_id))


def list_records(uid, limit=50):
    with _conn() as c:
        rows = c.execute(
            "SELECT id, app_id, created_at, input_json, output_json, media_json "
            "FROM records WHERE uid=? ORDER BY id DESC LIMIT ?",
            (uid, limit),
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def get_record(rec_id, uid=None):
    with _conn() as c:
        if uid:
            row = c.execute("SELECT * FROM records WHERE id=? AND uid=?", (rec_id, uid)).fetchone()
        else:
            row = c.execute("SELECT * FROM records WHERE id=?", (rec_id,)).fetchone()
    return _row_to_dict(row) if row else None


def _row_to_dict(row):
    if not row:
        return None
    d = dict(row)
    for k in ("input_json", "output_json", "media_json"):
        if k in d and d[k]:
            try:
                d[k.replace("_json", "")] = json.loads(d[k])
            except Exception:
                d[k.replace("_json", "")] = None
        d.pop(k, None)
    return d
