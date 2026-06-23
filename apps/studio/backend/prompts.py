# -*- coding: utf-8 -*-
"""AI 컨셉스튜디오 이미지 생성 프롬프트.

기존 apps/emoticon SPA 의 얼굴 동일성(IDENTITY LOCK) 프롬프트 톤을 이식.
입력한 아이 사진을 레퍼런스로, 배경/의상/조명만 컨셉에 맞춰 바꾼 스튜디오 화보를 생성.
"""

CONCEPTS = {
    "spring": {
        "label": "봄꽃 스튜디오",
        "emoji": "🌸",
        "desc": "벚꽃과 들꽃이 가득한 화사한 봄날 화보",
        "scene": (
            "- 화사한 봄날 감성의 벚꽃/꽃밭 컨셉 스튜디오 화보\n"
            "- 배경은 만개한 연분홍 벚꽃과 부드러운 꽃잎이 흩날리는 포토존\n"
            "- 파스텔 톤의 따뜻하고 맑은 자연광\n"
            "- 아기는 봄 느낌의 화이트/파스텔 컬러 원피스 또는 셔츠 착용\n"
            "- 작은 꽃 헤어밴드나 꽃 소품으로 포인트"
        ),
        "mood": "봄꽃 컨셉 스튜디오에서 촬영한 화사하고 따뜻한 봄 화보",
    },
    "hanbok": {
        "label": "한복 스튜디오",
        "emoji": "🏮",
        "desc": "단아한 전통 한복을 차려입은 명절 화보",
        "scene": (
            "- 단아하고 고급스러운 전통 한복 컨셉 스튜디오 화보\n"
            "- 배경은 한지 창살, 전통 보자기, 은은한 단색 한옥 무드의 포토존\n"
            "- 따뜻하고 부드러운 실내 조명\n"
            "- 아기는 색동/파스텔 톤의 전통 한복(저고리와 치마/바지) 착용\n"
            "- 복주머니나 전통 소품으로 포인트"
        ),
        "mood": "한복 컨셉 스튜디오에서 촬영한 정갈하고 사랑스러운 명절 화보",
    },
    "beach": {
        "label": "바닷가 스튜디오",
        "emoji": "🌊",
        "desc": "시원한 여름 바다 감성의 휴양지 화보",
        "scene": (
            "- 시원한 여름 감성의 바닷가/해변 컨셉 스튜디오 화보\n"
            "- 배경은 맑은 하늘과 파도, 하얀 모래사장이 보이는 포토존\n"
            "- 밝고 청량한 햇살과 자연광\n"
            "- 아기는 여름 휴양지 느낌의 밀짚모자, 파스텔 비치웨어 착용\n"
            "- 작은 튜브나 조개 소품으로 포인트"
        ),
        "mood": "바닷가 컨셉 스튜디오에서 촬영한 청량하고 시원한 여름 화보",
    },
    "space": {
        "label": "우주 스튜디오",
        "emoji": "🚀",
        "desc": "별과 행성이 빛나는 우주 탐험 화보",
        "scene": (
            "- 신비로운 우주 탐험 컨셉 스튜디오 화보\n"
            "- 배경은 반짝이는 별, 은하수, 둥근 행성이 보이는 깊은 우주 포토존\n"
            "- 부드러운 별빛과 은은한 색감의 조명\n"
            "- 아기는 귀여운 우주복/우주비행사 의상 착용\n"
            "- 작은 로켓이나 별 소품으로 포인트"
        ),
        "mood": "우주 컨셉 스튜디오에서 촬영한 꿈처럼 신비로운 우주 화보",
    },
    # 기존 studio SPA 의 '수박 컨셉' 화보를 이식
    "watermelon": {
        "label": "수박 스튜디오",
        "emoji": "🍉",
        "desc": "상큼한 여름 수박 컨셉 화보",
        "scene": (
            "- 시원한 여름 감성의 수박 컨셉 스튜디오 화보\n"
            "- 배경은 커다란 수박 단면이 가득한 포토존, 빨간 과육과 초록 껍질 패턴이 선명하게\n"
            "- 밝고 화사한 여름 색감, 자연광 느낌의 부드러운 조명\n"
            "- 아기는 수박 패턴 의상과 초록 줄무늬 수박 모자 착용\n"
            "- 초록+연두 컬러로 귀엽고 여름 느낌 나는 스타일"
        ),
        "mood": "수박 컨셉 스튜디오에서 촬영한 상큼하고 시원한 여름 화보",
    },
    "christmas": {
        "label": "크리스마스 스튜디오",
        "emoji": "🎄",
        "desc": "따뜻한 겨울 성탄 컨셉 화보",
        "scene": (
            "- 포근하고 따뜻한 크리스마스 컨셉 스튜디오 화보\n"
            "- 배경은 반짝이는 크리스마스 트리, 따뜻한 전구 조명, 선물 상자가 있는 포토존\n"
            "- 아늑한 골드/레드/그린 톤의 따뜻한 실내 조명\n"
            "- 아기는 산타 모자나 루돌프/니트 등 크리스마스 의상 착용\n"
            "- 작은 양말, 오너먼트, 리본 소품으로 포인트"
        ),
        "mood": "크리스마스 컨셉 스튜디오에서 촬영한 포근하고 사랑스러운 겨울 성탄 화보",
    },
}

DEFAULT_CONCEPT = "spring"

_IDENTITY_LOCK = (
    "[🔥 최우선 규칙 — 얼굴 동일성 유지 / IDENTITY LOCK]\n"
    "- 업로드한 아기와 완전히 동일한 인물이어야 함\n"
    "- 눈 크기, 눈매, 코 모양, 입술, 볼살, 피부톤, 얼굴형, 귀 위치까지 그대로 유지\n"
    "- AI 특유의 미화된 얼굴 절대 금지, 실제 촬영한 우리 아기 느낌 유지\n"
    "- 얼굴 비율 임의 수정 금지, 나이 더 어리거나 커 보이게 변경 금지\n"
    "- 몸 비율은 실제 아이 체형 그대로, 손가락 개수와 팔 길이 자연스럽게"
)

_NEGATIVE = (
    "face change, different person, AI beautified face, plastic skin, oversmoothed skin, "
    "makeup, adult face, wrong age, face distortion, blurry face, scary expression, "
    "generic AI cute baby, extra fingers, deformed hands, unnatural arms, ugly, deformed, "
    "bad anatomy, extra limbs, text, watermark, logo, cartoon, anime, oversaturated, horror"
)


def concept_label(concept):
    c = CONCEPTS.get(concept) or CONCEPTS[DEFAULT_CONCEPT]
    return c["label"]


def build_prompt(concept):
    c = CONCEPTS.get(concept) or CONCEPTS[DEFAULT_CONCEPT]
    return (
        "첨부된 아기 사진을 레퍼런스로, 얼굴과 인상은 그대로 유지하면서 "
        "배경·의상·조명만 " + c["label"] + " 컨셉으로 바꾼 스튜디오 화보를 생성해 줘.\n"
        "가장 중요한 건 아기의 얼굴과 실제 인상, 분위기를 절대 바꾸지 않는 것이다.\n\n"
        + _IDENTITY_LOCK + "\n\n"
        "[🎨 컨셉 — " + c["label"] + "]\n"
        + c["scene"] + "\n\n"
        "[🖼 구도]\n"
        "- 세로형 인물 화보 (인스타 스토리 비율)\n"
        "- 실제 아동복 브랜드 화보처럼 자연스럽게\n\n"
        + c["mood"] + " 느낌으로 생성.\n\n"
        "Photorealistic, high quality, natural lighting, professional baby studio photography.\n"
        "Negative: " + _NEGATIVE
    )
