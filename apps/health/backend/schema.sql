-- 표준 앱 DB 스키마 (모든 미니앱 동일 규격)
-- 엔드유저 1인(uid) 단위로 INPUT/OUTPUT 적치

CREATE TABLE IF NOT EXISTS users (
    uid         TEXT PRIMARY KEY,
    first_seen  TEXT NOT NULL,
    last_seen   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS records (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    uid         TEXT NOT NULL,
    app_id      TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'done',
    input_json  TEXT,            -- 엔드유저 INPUT (JSON)
    output_json TEXT,            -- LLM/로직 OUTPUT (JSON)
    media_json  TEXT,            -- 산출 미디어 경로 목록 (JSON 배열)
    input_hash  TEXT             -- 동일입력 dedup 용
);

CREATE INDEX IF NOT EXISTS idx_records_uid ON records(uid);
CREATE INDEX IF NOT EXISTS idx_records_hash ON records(uid, input_hash);
