# -*- coding: utf-8 -*-
"""글로벌 작명소 프롬프트 (기존 apps/naming.html 프롬프트 이식)."""

LOCALES = {
    "en": {"label": "영어", "lang": "English", "country": "영어권"},
    "zh": {"label": "중국어", "lang": "Chinese", "country": "중국"},
    "jp": {"label": "일본어", "lang": "Japanese", "country": "일본"},
    "de": {"label": "독일어", "lang": "German", "country": "독일"},
}


def build_prompt(name, gender_text, age, locale_key):
    loc = LOCALES.get(locale_key, LOCALES["en"])
    age_part = (" 나이: " + age) if age else ""
    return (
        "글로벌 아이 네이밍 전문가입니다. 사용자가 선택한 언어/나라: " + loc["label"] +
        " (" + loc["lang"] + "). 한국 이름 \"" + name + "\"에 어울리는 " + loc["label"] +
        " 스타일 이름을 정확히 3개 추천하세요. 성별: " + gender_text + age_part +
        ". 세 이름은 서로 다른 느낌(클래식/트렌디/유니크 등)으로 구성하세요. "
        "중요: name만 " + loc["lang"] + "로 작성하고, pronunciation·trend_tag·persona·korean_meaning은 "
        "반드시 한국어로만 작성하세요. persona는 외국어 단어나 문장을 쓰지 말고 한국어 2줄 설명으로 작성하세요. "
        "순수 JSON만 출력 (백틱 없이): "
        '{"korean_meaning":"한국 이름 뜻/어감 (한국어)","locale":"' + locale_key + '",'
        '"suggestions":[{"name":"' + loc["lang"] + ' 풀네임","pronunciation":"한국어 발음",'
        '"trend_tag":"한국어 트렌드 키워드","persona":"한국어 2줄. 첫 줄: 그 나라에서 이 이름을 지은 아이의 이미지. '
        '둘째 줄: 성격·분위기 설명."},{"name":"...","pronunciation":"...","trend_tag":"...","persona":"..."},'
        '{"name":"...","pronunciation":"...","trend_tag":"...","persona":"..."}]}'
    )
