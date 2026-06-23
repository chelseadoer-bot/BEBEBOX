# -*- coding: utf-8 -*-
"""AI 컨셉스튜디오 앱 메타."""
APP_NO = 15
APP_ID = "emoticon"
TITLE = "AI 컨셉스튜디오"
SUBTITLE = "특별한 장소에 가지 않아도 예쁜 아이 사진을 완성해요."
AI_TYPE = "image"
PORT = 8015

PERSIST = True
DEDUP = False
STRIP_INPUT_KEYS = ["photo"]   # 엑셀 G: INPUT(사진) 미적치, OUTPUT만 적치

META = {
    "app_no": APP_NO, "app_id": APP_ID, "title": TITLE,
    "subtitle": SUBTITLE, "ai_type": AI_TYPE, "persist": PERSIST, "dedup": DEDUP,
}
