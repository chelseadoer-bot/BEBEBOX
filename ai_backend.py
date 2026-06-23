# -*- coding: utf-8 -*-
"""
AI 그라운드 미니앱 통합 백엔드 (표준 라이브러리만 사용).

apps/<slug>/backend/ 의 각 미니앱(원래 FastAPI 규격)을 별도 서버 없이
베베박스 stdlib 서버 안에서 그대로 구동한다. 앱별 로직(pipeline/prompts/
app_meta)만 동적 로드하고, 표준 엔드포인트(main.py가 하던 일)는 이 모듈이
대신 처리한다.

- LLM 호출(llm.py)·설정(config.py)·DB(db.py)는 모두 stdlib(urllib/sqlite)라
  추가 의존성이 없다. (예외: vlog=브이로그는 imageio-ffmpeg 필요)
- 데이터/스토리지는 BEBEBOX_DATA_DIR(/data) 아래 ai/<slug>/ 에 적치 → 영구 보존.
- GEMINI_API_KEY 환경변수만 있으면 실제 AI 결과가 생성된다.

지원 경로 (server.py가 위임):
  GET  /apps/<slug>/api/meta
  GET  /apps/<slug>/api/health
  GET  /apps/<slug>/api/records?uid=...
  GET  /apps/<slug>/api/records/<id>?uid=...
  POST /apps/<slug>/api/run
  GET  /apps/<slug>/storage/<file>
"""
import os
import sys
import time
import uuid
import base64
import threading

import db as maindb   # 베베박스 본체(고객 정보) DB — 미니앱 활동을 통합 적치

_HERE = os.path.dirname(os.path.abspath(__file__))
APPS_DIR = os.path.join(_HERE, "apps")
_DATA_ROOT = os.environ.get("BEBEBOX_DATA_DIR") or os.path.join(_HERE, "data")

# 게임 탭 타일 slug → apps/<slug>/backend (이미 복사돼 있음)
SLUGS = ("naming", "doodle", "health", "vlog", "chores", "temperament", "studio", "pastlife")

# 앱마다 같은 이름(config/db/llm/pipeline/...)을 쓰므로 로드 시 sys.modules 충돌을
# 막기 위해 임시로 비우고, 로드된 모듈 객체는 slug별로 캐시해 재사용한다.
_SHARED = ("config", "db", "llm", "app_meta", "pipeline", "prompts", "rules")
_loaded = {}
_lock = threading.Lock()


def _load(slug):
    """slug 앱의 backend 모듈들을 1회 로드해 캐시. 실패 시 {'error':msg} 반환."""
    if slug in _loaded:
        return _loaded[slug]
    with _lock:
        if slug in _loaded:
            return _loaded[slug]
        backend = os.path.join(APPS_DIR, slug, "backend")
        if not os.path.isdir(backend):
            _loaded[slug] = {"error": "백엔드를 찾을 수 없어요."}
            return _loaded[slug]
        import importlib
        saved = {m: sys.modules.pop(m, None) for m in _SHARED}
        sys.path.insert(0, backend)
        try:
            config = importlib.import_module("config")
            # 실행 중인 서버(예: Render)의 환경변수 키를 각 앱 config 에 확실히 주입한다.
            # (앱별 .env 누락/이름 차이 대비, GOOGLE_API_KEY 별칭도 허용)
            _key = (os.environ.get("GEMINI_API_KEY")
                    or os.environ.get("GOOGLE_API_KEY")
                    or getattr(config, "GEMINI_API_KEY", "") or "")
            config.GEMINI_API_KEY = _key
            # 데이터/스토리지를 /data/ai/<slug> 로 돌려 영구 보존 + 저장소 오염 방지
            base = os.path.join(_DATA_ROOT, "ai", slug)
            config.DATA_DIR = base
            config.DB_PATH = os.path.join(base, "app.db")
            config.STORAGE_DIR = os.path.join(base, "storage")
            os.makedirs(config.STORAGE_DIR, exist_ok=True)

            db = importlib.import_module("db")
            llm = importlib.import_module("llm")
            app_meta = importlib.import_module("app_meta")
            pipeline = importlib.import_module("pipeline")
            db.init_db()
            mods = {"config": config, "db": db, "llm": llm,
                    "app_meta": app_meta, "pipeline": pipeline, "error": None}
        except Exception as e:
            mods = {"error": "%s: %s" % (type(e).__name__, e)}
        finally:
            sys.path.remove(backend)
            for m in _SHARED:
                sys.modules.pop(m, None)
                if saved.get(m) is not None:
                    sys.modules[m] = saved[m]
        _loaded[slug] = mods
        return mods


class _Ctx:
    """pipeline.run(inputs, ctx) 가 기대하는 컨텍스트 (main.py의 Ctx 이식)."""
    def __init__(self, uid, config, llm):
        self.uid = uid
        self.llm = llm
        self._config = config

    def save_media(self, data, ext="png"):
        fname = "%s_%s.%s" % (int(time.time() * 1000), uuid.uuid4().hex[:8], ext)
        fpath = os.path.join(self._config.STORAGE_DIR, fname)
        if isinstance(data, str):
            if data.startswith("data:") and "," in data:
                data = data.split(",", 1)[1]
            raw = base64.b64decode(data)
        else:
            raw = data
        with open(fpath, "wb") as f:
            f.write(raw)
        return "/storage/" + fname


def _uid_from(body):
    uid = None
    if isinstance(body, dict):
        uid = body.get("uid")
    if not uid or len(str(uid)) < 3:
        uid = "guest_" + uuid.uuid4().hex[:12]
    return str(uid)


def _scope_media(obj, slug):
    """파이프라인이 돌려준 '/storage/..' 경로를 '/apps/<slug>/storage/..' 로 치환."""
    prefix = "/apps/%s/storage/" % slug
    if isinstance(obj, str):
        if obj.startswith("/storage/"):
            return prefix + obj[len("/storage/"):]
        return obj
    if isinstance(obj, list):
        return [_scope_media(x, slug) for x in obj]
    if isinstance(obj, dict):
        return {k: _scope_media(v, slug) for k, v in obj.items()}
    return obj


# ───────────────────────── 라우팅 진입점 ─────────────────────────
def handle(method, slug, sub, query, body):
    """server.py가 호출. (status:int, payload:dict) 반환. storage는 별도 처리."""
    if slug not in SLUGS:
        return 404, {"ok": False, "error": "unknown_app"}
    mods = _load(slug)
    if mods.get("error"):
        return 500, {"ok": False, "error": mods["error"]}
    am = mods["app_meta"]
    db = mods["db"]
    llm = mods["llm"]
    config = mods["config"]
    pipeline = mods["pipeline"]

    if method == "GET" and sub == "meta":
        return 200, getattr(am, "META", {})

    if method == "GET" and sub == "health":
        return 200, {"ok": True, "app_id": am.APP_ID, "has_key": bool(config.GEMINI_API_KEY)}

    if method == "GET" and sub == "records":
        uid = (query.get("uid") or "").strip()
        if not uid:
            return 200, {"ok": True, "records": []}
        recs = [_scope_media(r, slug) for r in db.list_records(uid, int(query.get("limit", 50)))]
        return 200, {"ok": True, "records": recs}

    if method == "GET" and sub.startswith("records/"):
        try:
            rec_id = int(sub.split("/", 1)[1])
        except ValueError:
            return 404, {"ok": False, "error": "not_found"}
        rec = db.get_record(rec_id, (query.get("uid") or "").strip() or None)
        if not rec:
            return 404, {"ok": False, "error": "not_found"}
        return 200, {"ok": True, "record": _scope_media(rec, slug)}

    if method == "POST" and sub == "run":
        inputs = body.get("inputs", body) if isinstance(body, dict) else {}
        if isinstance(inputs, dict):
            inputs = {k: v for k, v in inputs.items() if k != "uid"}
        uid = _uid_from(body)
        ctx = _Ctx(uid, config, llm)
        ihash = db.input_hash(inputs) if getattr(am, "PERSIST", False) else None

        if getattr(am, "PERSIST", False) and getattr(am, "DEDUP", False):
            existing = db.find_by_hash(uid, ihash)
            if existing:
                return 200, {"ok": True, "uid": uid, "record_id": existing["id"],
                             "output": _scope_media(existing.get("output"), slug),
                             "media": _scope_media(existing.get("media") or [], slug),
                             "from_cache": True}
        try:
            result = pipeline.run(inputs, ctx)
        except getattr(llm, "LLMError", Exception) as e:
            return 502, {"ok": False, "error": str(e)}
        except ValueError as e:
            return 400, {"ok": False, "error": str(e)}
        except Exception as e:
            return 500, {"ok": False, "error": "%s: %s" % (type(e).__name__, e)}

        output = result.get("output", result)
        media = result.get("media", [])
        record_id = None
        if getattr(am, "PERSIST", False):
            if getattr(am, "SINGLE_RECORD", False):
                db.delete_user_records(uid, am.APP_ID)
            db.touch_user(uid)
            stored = inputs
            strip = getattr(am, "STRIP_INPUT_KEYS", None)
            if strip and isinstance(inputs, dict):
                stored = {k: v for k, v in inputs.items() if k not in strip}
            record_id = db.save_record(uid, am.APP_ID, stored, output, media, ihash)
        # 미니앱 산출물 생성을 고객 정보 DB(events)에 동일 uid(=가족코드)로 적치 →
        # 미니앱 DB ↔ 기존 고객 정보 연결성 구축. (게스트 uid 는 제외)
        if uid and not str(uid).startswith("guest_"):
            try:
                maindb.insert_event(
                    uid, "miniapp_generate", actor="parent",
                    name=getattr(am, "TITLE", slug), item_id=am.APP_ID,
                    meta={"slug": slug, "record_id": record_id},
                    user_id=uid,
                )
            except Exception:
                pass
        return 200, {"ok": True, "uid": uid, "record_id": record_id,
                     "output": _scope_media(output, slug),
                     "media": _scope_media(media, slug), "from_cache": False}

    return 404, {"ok": False, "error": "not_found"}


def storage_path(slug, fname):
    """/apps/<slug>/storage/<fname> 의 실제 파일 경로 (없으면 None)."""
    if slug not in SLUGS or "/" in fname or fname.startswith("."):
        return None
    mods = _load(slug)
    if mods.get("error"):
        return None
    path = os.path.join(mods["config"].STORAGE_DIR, fname)
    return path if os.path.isfile(path) else None
