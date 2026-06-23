# -*- coding: utf-8 -*-
"""2세 얼굴 예측 파이프라인 (이미지 생성).
나이대별(3/5/8/12/18) 5개 이미지를 생성. 엄마·아빠 사진 2장을 레퍼런스로 사용.
"""
import prompts

AGES = [3, 5, 8, 12, 18]


def run(inputs, ctx):
    mom = inputs.get("mom")
    dad = inputs.get("dad")
    if not mom or not dad:
        raise ValueError("엄마·아빠 사진을 모두 올려주세요.")
    gender = inputs.get("gender") or "girl"
    dad_pct = int(inputs.get("dadPct", 50))

    mom_url = ctx.save_media(mom, "jpg")
    dad_url = ctx.save_media(dad, "jpg")

    ref_imgs = [
        {"data": mom, "mime": "image/jpeg"},
        {"data": dad, "mime": "image/jpeg"},
    ]

    images = {}
    for age in AGES:
        prompt = prompts.build_prompt(age, gender, dad_pct)
        data_url = ctx.llm.generate_image(prompt, images=ref_imgs)
        images[str(age)] = ctx.save_media(data_url, "png")

    output = {
        "images": images,
        "ages": AGES,
        "gender": gender,
        "dadPct": dad_pct,
        "mom_thumb": mom_url,
        "dad_thumb": dad_url,
    }
    media = [mom_url, dad_url] + list(images.values())
    return {"output": output, "media": media}
