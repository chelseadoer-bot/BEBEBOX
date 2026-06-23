# -*- coding: utf-8 -*-
"""아이와 나의 전생 프롬프트 (기존 apps/pastlife.html 프롬프트 이식)."""

ERA_HINTS = [
    "고대 이집트", "고대 그리스", "고조선", "삼국시대 신라", "고려시대", "조선시대",
    "중세 유럽 기사단", "대항해시대", "에도시대 일본", "청나라 궁중", "로마 제국",
    "바이킹 시대", "르네상스 이탈리아", "19세기 파리", "서부 개척시대",
    "마야 문명", "송나라 강호", "빅토리아 시대 런던",
]


def build_prompt(rel_label, parent, child, chip_list, extra, seed):
    era_hint = ERA_HINTS[seed % len(ERA_HINTS)]
    return (
        "당신은 전생 관계 감정사입니다. 재치있고 매번 다른 결과를 만드는 문체로 답하세요. "
        "분석할 관계: " + rel_label + "=" + parent + ", 아이=" + child + ". "
        "현재 특징: " + chip_list + ". 추가정보: " + extra + ". "
        "이번 감정의 전생 시대 영감은 '" + era_hint + "' 분위기로 잡되, 인물 역할과 스토리는 창의적으로 새롭게 구성하세요. "
        "전체 텍스트 분량은 700자 내외로 작성하세요. "
        "반드시 순수 JSON만 출력하세요 (설명 없이 중괄호로 시작, this_life_quote와 this_life_interpret는 반드시 문자열): "
        '{"era":"전생 시대","parent_emoji":"이모지1개","child_emoji":"이모지1개",'
        '"parent_past_role":"' + parent + '의 전생 직책","child_past_role":"' + child + '의 전생 직책",'
        '"relation_type":"전생 관계 한 줄","relation_subtitle":"부제",'
        '"story":"드라마틱하고 웃긴 전생 스토리 3-4문장",'
        '"evidence":["이생 흔적1","흔적2","흔적3"],'
        '"karma_scores":{"인연농도":85,"빚의무게":72,"재결합확률":94},'
        '"this_life_quote":"전생이 이생에 전하는 시적 메시지 한 문장",'
        '"this_life_interpret":"그 메시지의 웃긴 현실 해석 한 문장"}'
    )
