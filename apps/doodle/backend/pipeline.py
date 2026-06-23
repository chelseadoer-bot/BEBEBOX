# -*- coding: utf-8 -*-
"""낙서 심리 분석 파이프라인 (비전 LLM)."""
import prompts

_EXT = {"image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}


def run(inputs, ctx):
    img = inputs.get("image")
    if not img:
        raise ValueError("그림 이미지를 올려주세요.")
    mime = inputs.get("mime") or "image/jpeg"
    name = (inputs.get("name") or "우리 아이").strip()
    age = (inputs.get("age") or "나이 미입력").strip()
    mood = (inputs.get("mood") or "모름").strip()

    image_url = ctx.save_media(img, _EXT.get(mime, "jpg"))
    prompt = prompts.build_prompt(name, age, mood)
    data = ctx.llm.complete_text(prompt, images=[{"data": img, "mime": mime}], max_tokens=2000)

    if isinstance(data, dict) and data.get("is_drawing") is False:
        raise ValueError(data.get("error") or "그림 이미지를 올려주세요.")

    data["image_url"] = image_url
    data["child_name"] = name
    data["child_age"] = age
    data["mood"] = mood
    return {"output": data, "media": [image_url]}
