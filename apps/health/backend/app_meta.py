# -*- coding: utf-8 -*-
"""AI 건강 체크 앱 메타."""
APP_NO = 3
APP_ID = "symptom"
TITLE = "AI 건강 체크"
SUBTITLE = "아이의 증상을 확인하고 대처 방법을 안내해요."
AI_TYPE = "text"
PORT = 8003

PERSIST = True
DEDUP = False

META = {
    "app_no": APP_NO, "app_id": APP_ID, "title": TITLE,
    "subtitle": SUBTITLE, "ai_type": AI_TYPE, "persist": PERSIST, "dedup": DEDUP,
}
