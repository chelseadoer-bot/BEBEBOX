#!/usr/bin/env python3
import json, os, urllib.parse, urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))

def load_dotenv(path):
    if not os.path.isfile(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k, v = k.strip(), v.strip().strip('"').strip("'")
            if k and k not in os.environ:
                os.environ[k] = v

load_dotenv(os.path.join(ROOT, ".env"))
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
SEARCH = "https://kidikidi.elandmall.co.kr/v1/search/item/api"
IMG = "https://item.elandrs.com/"
ITEM = "https://kidikidi.elandmall.co.kr/i/item?itemNo="

def map_items(items):
    out = []
    for it in items:
        path = it.get("representImagePath") or ""
        if not path and it.get("image"):
            path = (it["image"][0] or {}).get("imagePath") or ""
        no = str(it.get("itemNo") or "")
        out.append({
            "id": "kd-" + no, "itemNo": no,
            "brand": it.get("brandName") or "키디키디",
            "name": it.get("itemName") or "",
            "price": it.get("finalDcPrice") or it.get("sellprice") or 0,
            "image": (IMG + path + "?w=&h=500&q=100") if path else "",
            "url": ITEM + no,
            "rating": it.get("reviewScoreDecimalpoint") or it.get("reviewScore"),
            "reviews": it.get("reviewCount") or 0,
            "source": "kidikidi", "custom": False,
        })
    return out

class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()
    def do_GET(self):
        if not self.path.startswith("/api/kidikidi/search"):
            return super().do_GET()
        p = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        q = (p.get("q") or [""])[0].strip()
        try: lim = max(1, min(12, int((p.get("limit") or ["4"])[0])))
        except ValueError: lim = 4
        if not q:
            b = json.dumps({"error": "missing q"}).encode(); self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b); return
        url = SEARCH + "?q=" + urllib.parse.quote(q)
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Referer": "https://kidikidi.elandmall.co.kr/"})
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                data = json.loads(r.read().decode())
        except Exception as e:
            b = json.dumps({"error": "kidikidi_unreachable", "detail": str(e)}, ensure_ascii=False).encode()
            self.send_response(502); self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b); return
        d = data.get("data") or {}
        items, total = [], 0
        for key in ("srchOutCome", "item"):
            blk = d.get(key)
            if not isinstance(blk, dict):
                continue
            item_blk = blk.get("item") if isinstance(blk.get("item"), dict) else blk
            lst = (item_blk or {}).get("list") or []
            if lst:
                items, total = lst, (item_blk or {}).get("total") or len(lst)
                break
        body = json.dumps({"keyword": q, "total": total or len(items), "products": map_items(items[:lim])}, ensure_ascii=False).encode()
        self.send_response(200); self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)

if __name__ == "__main__":
    import socket
    port = int(os.environ.get("PORT", "8080"))
    probe = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        probe.bind(("", port))
    except OSError:
        print("포트 %d 가 이미 사용 중이에요." % port)
        print("다른 터미널의 `python -m http.server 8080` 을 종료한 뒤 다시 실행해 주세요.")
        raise SystemExit(1)
    finally:
        probe.close()
    print("베베박스 서버: http://localhost:%d" % port)
    print("키디키디 API 프록시: /api/kidikidi/search")
    if GEMINI_API_KEY:
        print("Gemini API KEY: 설정됨 (사진 AI 분석 사용 가능)")
    else:
        print("Gemini API KEY: 미설정 — .env 파일에 GEMINI_API_KEY 를 넣거나 start.bat 로 입력하세요")
    ThreadingHTTPServer(("", port), H).serve_forever()
