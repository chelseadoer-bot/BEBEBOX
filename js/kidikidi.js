const KIDIKIDI_ITEM_BASE = "https://kidikidi.elandmall.co.kr/i/item?itemNo=";
const KIDIKIDI_SEARCH_API = "https://kidikidi.elandmall.co.kr/v1/search/item/api";
const KIDIKIDI_IMG = "https://item.elandrs.com/";

const KIDIKIDI_KEYWORD_ALIASES = {
  "스피터업타월": "턱받이",
  "바디슈트": "바디슈트",
  "우주복": "우주복",
  "튼살크림": "튼살",
  "튼살오일": "튼살",
  "국민 이유식 의자": "하이체어",
  "이유식 의자": "하이체어",
};

function kidikidiSearchCandidates(itemName) {
  const raw = String(itemName || "").trim();
  if (!raw) return ["유아"];
  const stripped = raw.replace(/\s*\([^)]*\)/g, "").trim();
  const parts = stripped.split("/").map((s) => s.trim()).filter(Boolean);
  const out = [];
  const push = (s) => {
    const k = String(s || "").trim();
    if (!k || out.includes(k)) return;
    out.push(k);
  };
  if (parts.length > 1) {
    push(parts[parts.length - 1]);
    push(parts[0]);
  } else {
    push(parts[0] || stripped);
  }
  for (const [from, to] of Object.entries(KIDIKIDI_KEYWORD_ALIASES)) {
    if (raw.includes(from)) push(to);
  }
  if (/엽산|철분|칼슘|비타민|오메가|유산균/.test(raw)) push("임산부 영양제");
  if (/턱받이|스피터|타월/.test(raw)) push("턱받이");
  if (/젖병|젖꼭지/.test(raw)) push("젖병");
  if (/카시트|유모차|아기띠|슬링/.test(raw)) {
    const m = raw.match(/카시트|유모차|아기띠|슬링/);
    if (m) push(m[0]);
  }
  return out;
}

function kidikidiSearchKeyword(itemName) {
  return kidikidiSearchCandidates(itemName)[0] || String(itemName || "").trim();
}

function kidikidiProductUrl(itemNo) {
  return KIDIKIDI_ITEM_BASE + encodeURIComponent(itemNo);
}

function kidikidiKeywordForJourney(node) {
  if (node.kidikidiKeyword) return node.kidikidiKeyword;
  if (node.collectKey && typeof COLLECT_QUESTS !== "undefined") {
    const q = COLLECT_QUESTS[node.collectKey];
    if (q?.name) {
      const m = q.name.match(/턱받이|이유식|카시트|유모차|빕|젖병|하이체어|매트/);
      if (m) return m[0];
    }
  }
  return kidikidiSearchKeyword(node.name);
}

function mapKidikidiItems(items, limit) {
  const out = [];
  for (const it of items || []) {
    let path = it.representImagePath || "";
    if (!path && it.image?.length) path = (it.image[0] || {}).imagePath || "";
    const no = String(it.itemNo || "");
    out.push({
      id: "kd-" + no,
      itemNo: no,
      brand: it.brandName || "키디키디",
      name: it.itemName || "",
      price: it.finalDcPrice || it.sellprice || 0,
      image: path ? KIDIKIDI_IMG + path + "?w=&h=500&q=100" : "",
      url: kidikidiProductUrl(no),
      rating: it.reviewScoreDecimalpoint || it.reviewScore,
      reviews: it.reviewCount || 0,
      source: "kidikidi",
      custom: false,
    });
    if (out.length >= (limit || 4)) break;
  }
  return out;
}

function extractKidikidiList(data) {
  const d = data?.data || {};
  for (const key of ["srchOutCome", "item"]) {
    const blk = d[key];
    if (!blk || typeof blk !== "object") continue;
    const itemBlk = blk.item || blk;
    const list = itemBlk.list || [];
    if (list.length) return { list, total: itemBlk.total || list.length };
  }
  return { list: [], total: 0 };
}

async function fetchKidikidiDirect(keyword, limit) {
  const q = encodeURIComponent(keyword);
  const res = await fetch(KIDIKIDI_SEARCH_API + "?q=" + q);
  if (!res.ok) throw new Error("direct_search_failed");
  const data = await res.json();
  const { list, total } = extractKidikidiList(data);
  return {
    keyword,
    total,
    products: mapKidikidiItems(list, limit || 4),
  };
}

async function fetchKidikidiViaProxy(keyword, limit) {
  const q = encodeURIComponent(keyword);
  const n = limit || 4;
  // 프록시가 무응답이면 무한 로딩이 되므로 7초 후 끊고 에러로 처리한다.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  let res;
  try {
    res = await fetch(`/api/kidikidi/search?q=${q}&limit=${n}`, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 404) throw new Error("proxy_not_available");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "search_failed");
  }
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) throw new Error("proxy_not_available");
  return res.json();
}

async function fetchKidikidiOnce(keyword, limit) {
  try {
    return await fetchKidikidiViaProxy(keyword, limit);
  } catch (proxyErr) {
    try {
      return await fetchKidikidiDirect(keyword, limit);
    } catch (directErr) {
      throw proxyErr;
    }
  }
}

async function fetchKidikidiProducts(keywordOrName, limit) {
  const candidates = kidikidiSearchCandidates(keywordOrName);
  let last = { keyword: candidates[0], total: 0, products: [] };
  let proxyUnavailable = false;
  for (const kw of candidates) {
    try {
      const data = await fetchKidikidiOnce(kw, limit);
      last = { ...data, keyword: kw };
      if (data.products?.length) return last;
    } catch (e) {
      if (e.message === "proxy_not_available") proxyUnavailable = true;
      last = { keyword: kw, total: 0, products: [], error: e.message };
    }
  }
  return { ...last, proxyUnavailable };
}
