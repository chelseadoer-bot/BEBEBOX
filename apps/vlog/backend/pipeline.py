# -*- coding: utf-8 -*-
"""먹·놀·잠 미디어 3개를 상/중/하 세로 스택으로 합성하는 파이프라인.

LLM을 사용하지 않는 특수 미디어 합성 케이스다. 입력 dataURL 3개를 storage에
저장한 뒤 imageio-ffmpeg 번들 바이너리로 vstack 합성한다. 입력에 동영상이
하나라도 있으면 결과는 mp4, 모두 이미지면 단일 jpg를 만든다.
"""
import os
import time
import uuid
import subprocess

import imageio_ffmpeg

import config

_SLOT_ORDER = ["eat", "play", "sleep"]
_KO_TO_EN = {"먹": "eat", "놀": "play", "잠": "sleep"}

_VIDEO_EXT = {"mp4", "mov", "webm", "avi", "mkv", "m4v"}
_MIME_EXT = {
    "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
    "video/x-msvideo": "avi", "video/x-matroska": "mkv", "video/x-m4v": "m4v",
    "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png",
    "image/webp": "webp", "image/gif": "gif",
}

PANEL = 720
DURATION = 6


def _ext_for(mime):
    return _MIME_EXT.get((mime or "").strip().lower(), "")


def _is_video(mime, ext):
    if mime and mime.strip().lower().startswith("video/"):
        return True
    return (ext or "").lower() in _VIDEO_EXT


def _abspath(public_url):
    return os.path.join(config.STORAGE_DIR, public_url.rsplit("/", 1)[-1])


def _collect(inputs):
    items = []
    slots = inputs.get("slots") if isinstance(inputs, dict) else None
    if isinstance(slots, list) and slots:
        for s in slots:
            if not isinstance(s, dict):
                continue
            data = s.get("data") or s.get("dataURL") or s.get("url")
            if not data:
                continue
            key = s.get("slot") or s.get("key") or s.get("name")
            key = _KO_TO_EN.get(key, key)
            items.append({"slot": key, "data": data, "mime": s.get("mime")})
    else:
        for key in _SLOT_ORDER:
            v = inputs.get(key)
            if isinstance(v, dict):
                items.append({"slot": key, "data": v.get("data") or v.get("dataURL"), "mime": v.get("mime")})
            elif isinstance(v, str) and v:
                items.append({"slot": key, "data": v, "mime": None})

    def _order(it):
        try:
            return _SLOT_ORDER.index(it.get("slot"))
        except ValueError:
            return 99

    items = [it for it in items if it.get("data")]
    items.sort(key=_order)
    return items


def _resolve_ext_mime(it):
    mime = (it.get("mime") or "").strip()
    data = it.get("data")
    if not mime and isinstance(data, str) and data.startswith("data:"):
        header = data[5:].split(";", 1)[0]
        if header:
            mime = header
    ext = _ext_for(mime)
    if not ext:
        ext = "mp4" if "video" in mime else "jpg"
    return ext, mime


def run(inputs, ctx):
    items = _collect(inputs)
    if len(items) < 3:
        raise ValueError("먹·놀·잠 미디어 3개를 모두 올려주세요.")
    items = items[:3]

    saved = []
    abs_paths = []
    has_video = False
    for it in items:
        ext, mime = _resolve_ext_mime(it)
        public = ctx.save_media(it["data"], ext)
        saved.append(public)
        abs_paths.append(_abspath(public))
        if _is_video(mime, ext):
            has_video = True

    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    stem = "%s_%s" % (int(time.time() * 1000), uuid.uuid4().hex[:8])

    if has_video:
        out_file = stem + ".mp4"
        out_abs = os.path.join(config.STORAGE_DIR, out_file)
        cmd = [ffmpeg, "-y"]
        for ab in abs_paths:
            if ab.rsplit(".", 1)[-1].lower() in _VIDEO_EXT:
                cmd += ["-stream_loop", "-1", "-t", str(DURATION), "-i", ab]
            else:
                cmd += ["-loop", "1", "-t", str(DURATION), "-i", ab]
        filt = ""
        for i in range(3):
            filt += ("[%d:v]scale=%d:%d:force_original_aspect_ratio=increase,"
                     "crop=%d:%d,setsar=1,format=yuv420p,fps=30[v%d];" %
                     (i, PANEL, PANEL, PANEL, PANEL, i))
        filt += "[v0][v1][v2]vstack=inputs=3[out]"
        cmd += ["-filter_complex", filt, "-map", "[out]", "-an",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30",
                "-t", str(DURATION), "-movflags", "+faststart", out_abs]
        result_type = "video"
    else:
        out_file = stem + ".jpg"
        out_abs = os.path.join(config.STORAGE_DIR, out_file)
        cmd = [ffmpeg, "-y"]
        for ab in abs_paths:
            cmd += ["-i", ab]
        filt = ""
        for i in range(3):
            filt += ("[%d:v]scale=%d:%d:force_original_aspect_ratio=increase,"
                     "crop=%d:%d,setsar=1,format=yuv420p[v%d];" %
                     (i, PANEL, PANEL, PANEL, PANEL, i))
        filt += "[v0][v1][v2]vstack=inputs=3[out]"
        cmd += ["-filter_complex", filt, "-map", "[out]", "-frames:v", "1",
                "-update", "1", "-q:v", "3", out_abs]
        result_type = "image"

    try:
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=300)
    except Exception as e:
        raise ValueError("미디어 합성 실행에 실패했어요. (ffmpeg 실행 오류: %s)" % e)

    if proc.returncode != 0 or not os.path.exists(out_abs):
        tail = proc.stderr.decode("utf-8", "ignore")[-600:] if proc.stderr else ""
        raise ValueError("미디어 합성에 실패했어요. " + tail)

    result_url = "/storage/" + out_file
    output = {
        "result_url": result_url,
        "result_type": result_type,
        "share_url": result_url,
        "slots": saved,
        "created_label": time.strftime("%Y.%m.%d %H:%M"),
    }
    return {"output": output, "media": [result_url] + saved}
