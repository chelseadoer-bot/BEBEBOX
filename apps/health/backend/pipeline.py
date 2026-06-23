# -*- coding: utf-8 -*-
"""AI 건강 체크 파이프라인 (텍스트 LLM)."""
import re

import prompts

_DISCLAIMER = (
    "이 결과는 AI 참고용 정보이며 실제 의학적 진단을 대체하지 않습니다. "
    "증상이 악화되면 즉시 전문의 진료를 받으세요."
)


def _to_text_list(v):
    if not v:
        return []
    if not isinstance(v, list):
        v = [v]
    out = []
    for item in v:
        if isinstance(item, str):
            t = item.strip()
        elif isinstance(item, dict):
            t = str(item.get("name") or item.get("condition") or item.get("title")
                    or item.get("text") or item.get("label") or item.get("description") or "").strip()
        else:
            t = str(item or "").strip()
        if t:
            out.append(t)
    return out


def _normalize_urgency(d):
    raw = str(d.get("urgency") or d.get("urgency_level") or d.get("risk_level")
              or d.get("recommendation") or "")
    u = re.sub(r"\s", "", raw).lower()
    if re.search(r"즉시|응급|emergency|critical|severe|high|위험", u):
        return "즉시응급"
    if re.search(r"오늘|today|urgent|병원", u) and "내일" not in u:
        return "오늘병원"
    if re.search(r"내일|tomorrow|soon", u):
        return "내일병원"
    if re.search(r"가정|집|home|low|mild|관리|경증", u):
        return "가정관리"
    if d.get("urgency") in ("즉시응급", "오늘병원", "내일병원", "가정관리"):
        return d["urgency"]
    return "가정관리"


def _normalize(d):
    if not isinstance(d, dict):
        d = {}
    return {
        "urgency": _normalize_urgency(d),
        "urgency_reason": (d.get("urgency_reason") or d.get("summary") or d.get("reason")
                           or d.get("explanation") or "입력하신 증상을 바탕으로 한 참고 안내입니다."),
        "possible_conditions": _to_text_list(d.get("possible_conditions") or d.get("conditions")
                                             or d.get("possible_diagnoses") or d.get("likely_conditions")),
        "home_care": _to_text_list(d.get("home_care") or d.get("care_tips")
                                   or d.get("home_tips") or d.get("home_management")),
        "go_er_if": _to_text_list(d.get("go_er_if") or d.get("when_to_go")
                                  or d.get("emergency_signs") or d.get("go_to_er")),
        "doctor_questions": _to_text_list(d.get("doctor_questions") or d.get("questions_for_doctor")
                                          or d.get("ask_doctor") or d.get("hospital_questions")),
        "disclaimer": d.get("disclaimer") or d.get("medical_disclaimer") or _DISCLAIMER,
    }


def run(inputs, ctx):
    symptoms = inputs.get("symptoms") or []
    if isinstance(symptoms, list):
        symptom_list = ", ".join(str(s).strip() for s in symptoms if str(s).strip())
    else:
        symptom_list = str(symptoms).strip()
    if not symptom_list:
        raise ValueError("증상을 한 가지 이상 선택해 주세요.")
    age = (inputs.get("age") or "").strip()
    fever = (inputs.get("fever") or "").strip()
    dur = (inputs.get("dur") or "").strip()
    note = (inputs.get("note") or "").strip()[:500]

    prompt = prompts.build_prompt(symptom_list, age, fever, dur, note)
    data = ctx.llm.complete_text(prompt, max_tokens=1800)
    output = _normalize(data)
    output["symptoms"] = symptom_list
    output["age"] = age
    output["fever"] = fever
    output["dur"] = dur
    return {"output": output, "media": []}
