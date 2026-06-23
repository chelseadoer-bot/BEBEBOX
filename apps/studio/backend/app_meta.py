# -*- coding: utf-8 -*-
"""2세 얼굴 예측 앱 메타."""
APP_NO = 13
APP_ID = "futurebaby"
TITLE = "2세 얼굴 예측"
SUBTITLE = "엄마·아빠 사진으로 아이의 연령별 얼굴을 볼수 있어요"
AI_TYPE = "image"
PORT = 8013

PERSIST = True
DEDUP = False
SINGLE_RECORD = True   # 한 고객당 1개의 input+output만 적치 (재생성 시 교체)

META = {
    "app_no": APP_NO, "app_id": APP_ID, "title": TITLE,
    "subtitle": SUBTITLE, "ai_type": AI_TYPE, "persist": PERSIST, "dedup": DEDUP,
}
