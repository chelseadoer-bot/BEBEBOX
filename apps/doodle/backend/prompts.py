# -*- coding: utf-8 -*-
"""낙서 심리 분석 프롬프트 (기존 apps/drawing.html 프롬프트 이식)."""


def build_prompt(name, age, mood):
    return (
        "미술치료사·발달심리사·어린이 미술관 도슨트를 겸한 전문가로서 아이 그림을 분석해주세요. "
        "모든 텍스트 필드는 반드시 한국어로만 작성하세요. 아이: " + name + ", " + age + ", 상태: " + mood +
        "  순수 JSON만 출력 (백틱 없이): "
        '{"artwork_title":"창의적인 작품 제목","artwork_subtitle":"' + name + ' 作, ' + age + '",'
        '"dev_stages":[{"label":"표현력","score":숫자0-100},{"label":"공간감","score":숫자0-100},'
        '{"label":"색채감","score":숫자0-100},{"label":"세밀함","score":숫자0-100}],'
        '"dev_comment":"발달 단계 코멘트 2문장","emotion_tags":["감정태그1","감정태그2","감정태그3"],'
        '"emotion_analysis":"감정 분석 3문장","psychology_insight":"심리적 특징 2-3문장",'
        '"docent_review":"미술관 도슨트 감상평 3-4문장. 진지하면서 따뜻하게",'
        '"tip_for_mom":["육아 팁 1","육아 팁 2"],'
        '"message_to_mom":"엄마에게 보내는 따뜻한 메시지 2-3문장","is_drawing":true} '
        '그림이 아니면: {"is_drawing":false,"error":"설명"}'
    )
