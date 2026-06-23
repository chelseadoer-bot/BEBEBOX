# -*- coding: utf-8 -*-
"""
공통 Gemini 프록시 (모든 미니앱 동일 규격).
기존 shared/kidikidi-gemini-direct.js 의 동작을 Python으로 이식.
- complete_text : 텍스트/비전 LLM (JSON 응답)
- generate_image: 이미지 생성 (base64 inline data 반환)
서버사이드 GEMINI_API_KEY 사용.
"""
import json
import re
import urllib.request
import urllib.parse

import config

_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models/"


class LLMError(Exception):
    pass


def _call(model, payload):
    key = config.GEMINI_API_KEY
    if not key:
        raise LLMError("GEMINI_API_KEY 가 설정되지 않았습니다. .env 를 확인하세요.")
    url = _API_BASE + urllib.parse.quote(model) + ":generateContent"
    headers = {"Content-Type": "application/json"}
    if key.startswith("AQ."):
        headers["Authorization"] = "Bearer " + key
    else:
        url += "?key=" + urllib.parse.quote(key)
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", "ignore")
        try:
            msg = json.loads(err_body).get("error", {}).get("message", err_body)
        except Exception:
            msg = err_body
        raise LLMError("Gemini API %s: %s" % (e.code, msg))
    except Exception as e:
        raise LLMError("Gemini 호출 실패: %s" % e)
    return json.loads(body)


def _extract_json_blob(raw):
    cleaned = re.sub(r"```json\s*|```", "", str(raw)).strip()
    s, e = cleaned.find("{"), cleaned.rfind("}")
    if s >= 0 and e > s:
        return cleaned[s:e + 1]
    s, e = cleaned.find("["), cleaned.rfind("]")
    if s >= 0 and e > s:
        return cleaned[s:e + 1]
    return cleaned


def _repair_json(text):
    blob = _extract_json_blob(text)
    try:
        json.loads(blob)
        return blob
    except Exception:
        pass
    s = blob.replace("\u201c", '"').replace("\u201d", '"').replace("\u2018", "'").replace("\u2019", "'")
    s = re.sub(r",\s*([}\]])", r"\1", s)
    out, in_str, esc = [], False, False
    for ch in s:
        if in_str:
            if esc:
                out.append(ch); esc = False
            elif ch == "\\":
                out.append(ch); esc = True
            elif ch == '"':
                out.append(ch); in_str = False
            elif ch in "\n\r":
                out.append("\\n")
            else:
                out.append(ch)
        else:
            if ch == '"':
                in_str = True
            out.append(ch)
    if in_str:
        out.append('"')
    return "".join(out)


def _build_parts(prompt, images):
    parts = [{"text": prompt}]
    for img in (images or []):
        b64 = img.get("data") if isinstance(img, dict) else img
        if not b64:
            continue
        if "," in b64 and b64.strip().startswith("data:"):
            b64 = b64.split(",", 1)[1]
        mime = img.get("mime", "image/jpeg") if isinstance(img, dict) else "image/jpeg"
        parts.append({"inline_data": {"mime_type": mime, "data": b64}})
    return parts


def complete_text(prompt, images=None, max_tokens=2048, model=None, temperature=0.35, as_json=True):
    """텍스트/비전 LLM 호출. as_json=True면 dict 반환, 아니면 raw 텍스트 반환."""
    model = model or config.GEMINI_MODEL
    has_image = bool(images)
    gen_cfg = {
        "maxOutputTokens": max(max_tokens, 8192 if has_image else 4096),
        "temperature": temperature,
    }
    if as_json:
        gen_cfg["responseMimeType"] = "application/json"
    payload = {
        "contents": [{"role": "user", "parts": _build_parts(prompt, images)}],
        "generationConfig": gen_cfg,
    }
    resp = _call(model, payload)
    cand = (resp.get("candidates") or [{}])[0]
    if cand.get("finishReason") == "MAX_TOKENS":
        raise LLMError("AI 응답이 너무 길어 잘렸어요. 잠시 후 다시 시도해 주세요.")
    text = "".join(p.get("text", "") for p in (cand.get("content", {}).get("parts") or [])).strip()
    if not text:
        raise LLMError("AI가 빈 응답을 반환했습니다.")
    if not as_json:
        return text
    blob = _extract_json_blob(text)
    for attempt in (blob, _repair_json(blob), _repair_json(text)):
        try:
            return json.loads(attempt)
        except Exception:
            continue
    raise LLMError("JSON 파싱 실패. 잠시 후 다시 시도해 주세요.")


def generate_image(prompt, images=None, model=None, temperature=0.9):
    """이미지 생성. data URL(str) 반환."""
    models = [model] if model else [config.GEMINI_IMAGE_MODEL, config.GEMINI_IMAGE_FALLBACK]
    last_err = None
    for m in models:
        if not m:
            continue
        payload = {
            "contents": [{"role": "user", "parts": _build_parts(prompt, images)}],
            "generationConfig": {"temperature": temperature, "responseModalities": ["IMAGE", "TEXT"]},
        }
        try:
            resp = _call(m, payload)
        except LLMError as e:
            last_err = e
            continue
        cand = (resp.get("candidates") or [{}])[0]
        for p in (cand.get("content", {}).get("parts") or []):
            d = p.get("inlineData") or p.get("inline_data")
            if d and d.get("data"):
                mime = d.get("mimeType") or d.get("mime_type") or "image/png"
                return "data:%s;base64,%s" % (mime, d["data"])
        last_err = LLMError("이미지가 생성되지 않았습니다.")
    raise last_err or LLMError("이미지 생성 실패")
