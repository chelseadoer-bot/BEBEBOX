# -*- coding: utf-8 -*-
"""아이와 나의 전생 파이프라인 (텍스트 LLM)."""
import hashlib

import prompts

_REL_LABEL = {"mom": "엄마", "dad": "아빠", "both": "엄마와 아빠"}


def _to_text_list(v):
    if not v:
        return []
    if isinstance(v, str):
        parts = []
        for chunk in v.replace("\n", ",").replace("·", ",").split(","):
            t = chunk.strip()
            if t:
                parts.append(t)
        return parts
    if isinstance(v, list):
        out = []
        for x in v:
            t = x if isinstance(x, str) else (x.get("text") if isinstance(x, dict) else str(x or ""))
            t = str(t or "").strip()
            if t:
                out.append(t)
        return out
    return []


def _normalize(d, parent, child):
    if not isinstance(d, dict):
        d = {}
    quote = d.get("this_life_quote") or d.get("quote") or d.get("message") or ""
    if isinstance(quote, dict):
        quote = quote.get("text") or quote.get("message") or ""
    interpret = d.get("this_life_interpret") or d.get("interpretation") or d.get("interpret") or ""
    if isinstance(interpret, dict):
        interpret = interpret.get("text") or interpret.get("message") or ""
    karma = d.get("karma_scores")
    if not isinstance(karma, dict) or not karma:
        karma = {"인연농도": 85, "빚의무게": 72, "재결합확률": 94}
    return {
        "era": d.get("era") or "전생의 어느 시대",
        "parent_emoji": d.get("parent_emoji") or "🌙",
        "child_emoji": d.get("child_emoji") or "⭐",
        "parent_past_role": d.get("parent_past_role") or "-",
        "child_past_role": d.get("child_past_role") or "-",
        "relation_type": d.get("relation_type") or "깊은 인연",
        "relation_subtitle": d.get("relation_subtitle") or "",
        "story": d.get("story") or "",
        "evidence": _to_text_list(d.get("evidence") or d.get("signs") or d.get("clues")),
        "karma_scores": karma,
        "this_life_quote": str(quote or "").strip() or "전생의 인연이 이생에도 이어지고 있어요.",
        "this_life_interpret": str(interpret or "").strip() or "현실에서는 서로 다른 말투로 같은 마음을 전하고 있을지도 몰라요.",
        "parent_name": parent,
        "child_name": child,
    }


def run(inputs, ctx):
    parent = (inputs.get("parent") or "").strip()
    child = (inputs.get("child") or "").strip()
    if not parent or not child:
        raise ValueError("두 분 이름을 모두 입력해 주세요.")
    rel = inputs.get("rel") or "mom"
    rel_label = _REL_LABEL.get(rel, "엄마")
    chips = inputs.get("chips") or []
    if isinstance(chips, list):
        chip_list = ", ".join(str(c).strip() for c in chips if str(c).strip()) or "없음"
    else:
        chip_list = str(chips).strip() or "없음"
    extra = (inputs.get("extra") or "").strip() or "없음"

    seed_src = (rel + "|" + parent + "|" + child + "|" + chip_list + "|" + extra).encode("utf-8")
    seed = int(hashlib.md5(seed_src).hexdigest(), 16) % 100000

    prompt = prompts.build_prompt(rel_label, parent, child, chip_list, extra, seed)
    data = ctx.llm.complete_text(prompt, max_tokens=2000, temperature=0.95)
    output = _normalize(data, parent, child)
    return {"output": output, "media": []}
