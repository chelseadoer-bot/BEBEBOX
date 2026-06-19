# -*- coding: utf-8 -*-
import json, re, urllib.parse, urllib.request

def fetch(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "*/*",
        "Accept-Language": "ko-KR,ko;q=0.9",
        "Referer": "https://kidikidi.elandmall.co.kr/",
    })
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read().decode("utf-8", "replace"), r.headers.get("Content-Type","")

# homepage api paths
html, _ = fetch("https://kidikidi.elandmall.co.kr/")
apis = sorted(set(re.findall(r'["\'](/api/[^"\']+)["\']', html)))
print("API paths on homepage:", len(apis))
for a in apis[:40]:
    print(a)

# category page
cat, _ = fetch("https://kidikidi.elandmall.co.kr/c/ctggrp?dispCategoryGroupNo=400002")
print("\nCategory len", len(cat))

# try search API guesses
q = urllib.parse.quote("턱받이")
for url in [
    f"https://kidikidi.elandmall.co.kr/v1/search/item/api?q={q}",
    f"https://kidikidi.elandmall.co.kr/v1/search/item/api?searchTerm={q}",
    f"https://kidikidi.elandmall.co.kr/v1/search/item/api?keyword={q}",
    f"https://kidikidi.elandmall.co.kr/v1/search/item/api?searchWord={q}",
    f"https://kidikidi.elandmall.co.kr/v1/search/item/api?autocomp_kwd={q}",
]:
    try:
        body, ct = fetch(url)
        print("\n", url)
        print(body[:800])
    except Exception as e:
        print("\n", url, "ERR", e)

# parse goods from category HTML
goods = re.findall(r'data-goods-no="(\d+)"', cat)
print("\ngoods nos in category:", len(goods), goods[:5])
# try product link patterns
links = re.findall(r'href="(/g/goods/detail[^"]+)"', cat)[:3]
print("detail links", links)
links2 = re.findall(r'href="([^"]*goodsNo=\d+[^"]*)"', cat)[:3]
print("goodsNo links", links2)

for pat in [r'href="(/g/goods/[^"]+)"', r'goodsNo["\']?\s*[:=]\s*["\']?(\d+)', r'/api/[^"\']+search[^"\']*']:
    m = re.findall(pat, cat)
    if m:
        print(pat, "->", m[:5])
# search API paths
scripts = re.findall(r'<script[^>]+src="([^"]+)"', cat)
print("scripts", len(scripts))
for s in scripts[:8]:
    print(s)
# download first app bundle
for s in scripts:
    if ".js" in s and ("main" in s or "app" in s or "chunk" in s or "vendor" in s):
        url = s if s.startswith("http") else "https://kidikidi.elandmall.co.kr" + s
        try:
            js = fetch(url)[0]
            apis = sorted(set(re.findall(r'["\'](/v1/[^"\']+)["\']', js)))
            srch = [a for a in apis if "search" in a or "goods" in a or "disp" in a]
            if srch:
                print("from", s[-50:], srch[:20])
        except Exception:
            pass
for pat in ["goodsNo", "goods_no", "dispGoods", "salePrc", "finalPrc", "/g/goods", "/i/goods", "goodsList"]:
    print(pat, cat.count(pat))
# first goods block
idx = cat.find("goodsNo")
if idx > 0:
    print("snippet:", cat[idx:idx+300])
# try search result page URLs
# find img base in homepage
for m in re.findall(r'https?://[^"\']+/r/image/[^"\']+', html)[:5]:
    print("img sample:", m)
for m in re.findall(r'["\']([^"\']*r/image/item[^"\']+)["\']', html)[:3]:
    print("img path:", m)
