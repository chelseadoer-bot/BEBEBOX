# -*- coding: utf-8 -*-
"""글로벌 작명소 파이프라인 (텍스트 LLM)."""
import prompts


def _normalize_entry(raw):
    if not raw:
        return None
    if isinstance(raw, str):
        return {"name": raw, "pronunciation": "-", "trend_tag": "트렌드", "persona": ""}
    return {
        "name": raw.get("name") or raw.get("full_name") or raw.get("value") or "-",
        "pronunciation": raw.get("pronunciation") or raw.get("reading") or "-",
        "trend_tag": raw.get("trend_tag") or raw.get("trend") or raw.get("tag") or "트렌드",
        "persona": raw.get("persona") or raw.get("description") or raw.get("desc") or "",
    }


def _normalize(d, locale_key):
    if not isinstance(d, dict):
        d = {}
    items = d.get("suggestions") or d.get("names") or d.get("options") or []
    if not items and locale_key in d:
        items = [d[locale_key]]
    mapped = [x for x in (_normalize_entry(i) for i in items) if x]
    while len(mapped) < 3:
        mapped.append({"name": "-", "pronunciation": "-", "trend_tag": "-", "persona": ""})
    return {
        "locale": locale_key or d.get("locale") or "en",
        "korean_meaning": d.get("korean_meaning") or d.get("meaning") or "",
        "suggestions": mapped[:3],
    }


def run(inputs, ctx):
    name = (inputs.get("name") or "").strip()
    if not name:
        raise ValueError("이름을 입력해 주세요.")
    locale_key = inputs.get("locale") or "en"
    gender = inputs.get("gender") or "girl"
    gender_text = "여자아이" if gender == "girl" else "남자아이"
    age = (inputs.get("age") or "").strip()

    prompt = prompts.build_prompt(name, gender_text, age, locale_key)
    data = ctx.llm.complete_text(prompt, max_tokens=2200)
    output = _normalize(data, locale_key)
    output["input_name"] = name
    output["gender"] = gender
    output["photo"] = inputs.get("photo") or ""
    return {"output": output, "media": []}
