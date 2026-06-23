# -*- coding: utf-8 -*-
"""AI 건강 체크 프롬프트 (기존 apps/symptom.html 프롬프트 이식)."""


def build_prompt(symptom_list, age, fever, dur, note):
    note_part = (" 보호자 메모: " + note + ".") if note else ""
    return (
        "소아과 전문 AI입니다. 고급 의학 지식을 바탕으로 답하되, 의학적 진단을 대체하지 않는 참고용 안내입니다. "
        "모든 텍스트 필드는 반드시 한국어로만 작성하세요. 아이 증상을 분석하고 대처 가이드를 제공해주세요. "
        "증상: " + symptom_list + ". 나이: " + age + ". 열: " + fever + ". 기간: " + dur + "." + note_part +
        " 전체 텍스트 분량은 500자 내외로 간결하게 작성하세요. "
        "반드시 순수 JSON만 출력하세요 (설명 없이 중괄호로 시작): "
        '{"urgency":"즉시응급","urgency_reason":"이 수준인 이유 1-2문장",'
        '"possible_conditions":["가능성 있는 상태1","상태2"],'
        '"home_care":["집에서 할 수 있는 대처법1","대처법2","대처법3"],'
        '"go_er_if":["즉시 응급실 가야 하는 상황1","상황2"],'
        '"doctor_questions":["병원 갈 때 꼭 말할 것1","꼭 말할 것2"],'
        '"disclaimer":"이 결과는 AI 참고용 정보이며 실제 의학적 진단을 대체하지 않습니다."}. '
        "urgency값은 즉시응급/오늘병원/내일병원/가정관리 중 하나여야 합니다."
    )
