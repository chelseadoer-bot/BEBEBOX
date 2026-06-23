# -*- coding: utf-8 -*-
"""기질 검사(K-TYPE) 파이프라인 (무-LLM, 규칙 기반)."""
import rules


def run(inputs, ctx):
    answers = inputs.get("answers")
    if not isinstance(answers, list) or len(answers) < rules.TOTAL_Q:
        raise ValueError("16문항에 모두 응답해 주세요.")
    result = rules.diagnose(answers)
    result["child_name"] = inputs.get("child_name") or ""
    result["birthdate"] = inputs.get("birthdate") or ""
    return {"output": result, "media": []}
