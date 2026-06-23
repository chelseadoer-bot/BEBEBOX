# -*- coding: utf-8 -*-
"""AI 컨셉스튜디오 파이프라인 (이미지 생성).

아이 사진 1장 + 컨셉 1개 → 컨셉에 맞춘 스튜디오 화보 1장 생성.
적치 정책: OUTPUT(생성 이미지)만 날짜별/컨셉별로 쌓이도록 output 에는 생성 결과만 담는다.
입력 사진 base64 는 output/media 에 넣지 않는다.
"""
import prompts


def run(inputs, ctx):
    photo = inputs.get("photo")
    if not photo:
        raise ValueError("아이 사진을 올려주세요.")

    concept = inputs.get("concept") or prompts.DEFAULT_CONCEPT
    if concept not in prompts.CONCEPTS:
        concept = prompts.DEFAULT_CONCEPT

    prompt = prompts.build_prompt(concept)
    ref_imgs = [{"data": photo, "mime": "image/jpeg"}]

    data_url = ctx.llm.generate_image(prompt, images=ref_imgs)
    image_url = ctx.save_media(data_url, "png")

    output = {
        "image_url": image_url,
        "concept": concept,
        "concept_label": prompts.concept_label(concept),
    }
    return {"output": output, "media": [image_url]}
