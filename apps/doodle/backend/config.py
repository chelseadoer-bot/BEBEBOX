# -*- coding: utf-8 -*-
"""
공통 설정 로더 (모든 미니앱 동일 규격).
.env 또는 환경변수에서 값을 읽는다. python-dotenv가 없어도 동작한다.
"""
import os

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _load_dotenv():
    """backend 상위(앱 루트)의 .env를 best-effort 로드."""
    env_path = os.path.join(_BASE_DIR, ".env")
    if not os.path.exists(env_path):
        return
    try:
        from dotenv import load_dotenv  # type: ignore
        load_dotenv(env_path, override=True)
        return
    except Exception:
        pass
    # dotenv 미설치 시 수동 파싱
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                os.environ.__setitem__(k.strip(), v.strip().strip('"').strip("'"))
    except Exception:
        pass


_load_dotenv()


def get(key, default=None):
    val = os.environ.get(key)
    return val if val not in (None, "") else default


# ── AI ───────────────────────────────────────────────
GEMINI_API_KEY = get("GEMINI_API_KEY", "")
GEMINI_MODEL = get("GEMINI_MODEL", "gemini-2.5-flash-lite")
GEMINI_IMAGE_MODEL = get("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")
GEMINI_IMAGE_FALLBACK = get("GEMINI_IMAGE_FALLBACK", "gemini-2.0-flash-preview-image-generation")

# ── 서버/경로 ────────────────────────────────────────
BASE_DIR = _BASE_DIR
DATA_DIR = os.path.join(_BASE_DIR, "data")
STORAGE_DIR = os.path.join(_BASE_DIR, "storage")
FRONTEND_DIR = os.path.join(_BASE_DIR, "frontend")
DB_PATH = os.path.join(DATA_DIR, "app.db")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(STORAGE_DIR, exist_ok=True)
