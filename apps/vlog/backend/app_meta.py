# -*- coding: utf-8 -*-
"""브이로그 제작소 앱 메타 (먹·놀·잠 미디어 합성, LLM 미사용)."""
APP_NO = 4
APP_ID = "muknoljam"
TITLE = "브이로그 제작소"
SUBTITLE = "하루 먹고·놀고·잠자는 영상을 모아 브이로그를 만들어요"
AI_TYPE = "media"
PORT = 8004

PERSIST = True
DEDUP = False

META = {
    "app_no": APP_NO, "app_id": APP_ID, "title": TITLE,
    "subtitle": SUBTITLE, "ai_type": AI_TYPE, "persist": PERSIST, "dedup": DEDUP,
}
