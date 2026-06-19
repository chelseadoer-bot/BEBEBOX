# -*- coding: utf-8 -*-
import json, re, urllib.parse, urllib.request

def fetch(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/json",
        "Accept-Language": "ko-KR,ko;q=0.9",
    })
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read().decode("utf-8", "replace"), r.geturl()

q = urllib.parse.quote("턱받이")
urls = [
    f"https://kidikidi.elandmall.co.kr/s/srch?q={q}",
    f"https://kidikidi.elandmall.co.kr/",
]
for url in urls:
    try:
        html, final = fetch(url)
        print("===", url, "->", final[:100], "len", len(html))
        for pat in ["goodsNo", "goodsNm", "salePrc", "api/", "search", "srch", "__NEXT", "goodsList"]:
            if pat in html:
                print("  found:", pat)
        m = re.search(r'__NEXT_DATA__[^>]*>({.*?})</script>', html, re.S)
        if m:
            print("  NEXT_DATA size", len(m.group(1)))
        # sample product links
        links = re.findall(r'href="(/[^"]*goods[^"]*)"', html)[:5]
        if links:
            print("  goods links:", links[:3])
    except Exception as e:
        print("ERR", url, e)
