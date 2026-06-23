# -*- coding: utf-8 -*-
"""2세 얼굴 예측 이미지 생성 프롬프트 (기존 apps/futurebaby.html 이식)."""


def build_prompt(age, gender, dad_pct):
    mom_pct = 100 - int(dad_pct)
    g = "Korean boy" if gender == "boy" else "Korean girl"
    return (
        "Create ONE photorealistic portrait of a " + g + ", age " + str(age) + ". "
        "Blend mother (" + str(mom_pct) + "%) and father (" + str(dad_pct) + "%) "
        "from the two reference photos. East Asian, natural skin, soft studio lighting, "
        "plain background. No text or watermark."
    )
