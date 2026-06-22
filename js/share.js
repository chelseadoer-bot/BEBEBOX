/** 지인용 공유 페이지(/share/:baby_id) — 로그인 없이 보는 반응형 웹.
 * 기록(사진)을 크게 보여주고, 선물(조각 채우기)은 하단 플로팅 버튼으로 진입.
 * "조각 채우기" 섹션 = 선물 퍼즐 + 옷장(시기별 필요/보유) 전체.
 */
(function () {
  var BABY_ID = (window.__BABY_ID__ && window.__BABY_ID__ !== "{{BABY_ID}}")
    ? window.__BABY_ID__
    : decodeURIComponent((location.pathname.split("/share/")[1] || "BEBEBOX").split("/")[0] || "BEBEBOX");
  var KIDIKIDI_HOME = "https://kidikidi.elandmall.co.kr/";
  var STAGES = [
    { id: "s1", name: "임신 초기" }, { id: "s2", name: "임신 중기" }, { id: "s3", name: "임신 후기" },
    { id: "s4", name: "출산 전후" }, { id: "s5", name: "0-3개월" }, { id: "s6", name: "4-6개월" },
    { id: "s7", name: "7-12개월" }, { id: "s8", name: "돌 이후" }
  ];
  var ITEM_INDEX = {}; // id -> item (위시리스트 클릭용)

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtPrice(n) { return n ? Number(n).toLocaleString("ko-KR") + "원" : ""; }
  function ageLabel(m) {
    if (m == null) return "";
    if (m === 0) return "신생아";
    if (m <= 24) return m + "개월";
    return Math.floor(m / 12) + "세";
  }
  function kidikidiLink(item) {
    var u = item.url || "";
    if (/^https?:\/\//.test(u)) return u;
    var q = encodeURIComponent([item.brand, item.productName || item.name].filter(Boolean).join(" "));
    return q ? (KIDIKIDI_HOME + "p/search/result?searchTerm=" + q) : KIDIKIDI_HOME;
  }
  async function fetchJSON(url) {
    try { var r = await fetch(url); if (!r.ok) return null; return await r.json(); } catch (_) { return null; }
  }
  function collectPhotos(data) {
    var srcs = [];
    (data.posts || []).slice().sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); })
      .forEach(function (p) { (p.photos || []).forEach(function (s) { if (s) srcs.push(s); }); });
    return srcs;
  }

  // 선물 퍼즐(컴팩트)
  function renderPuzzles(registry) {
    if (!registry.length) return "";
    return '<div class="s-puzzles">' + registry.map(function (g) {
      var filled = (g.pieces || []).length, total = g.total || 9;
      var pct = Math.round(filled / total * 100);
      var thumb = g.image
        ? '<div class="s-pz-thumb" style="background-image:url(\'' + esc(g.image) + '\')"></div>'
        : '<div class="s-pz-thumb">🎁</div>';
      return '<div class="s-pz-card">' + thumb +
        '<div class="s-pz-body"><div class="s-pz-name">' + esc(g.productName) + "</div>" +
        '<div class="s-pz-sub">' + esc([g.brand, fmtPrice(g.price)].filter(Boolean).join(" · ")) + "</div>" +
        '<div class="s-pz-bar"><div class="s-pz-bar-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="s-pz-meta">🧩 ' + filled + " / " + total + " 조각</div></div>" +
        '<button type="button" class="s-pz-go" data-gift="' + esc(g.id) + '">선물</button>' +
        "</div>";
    }).join("") + "</div>";
  }

  // 옷장(위시리스트) — 시기별 필요/보유
  function renderWishlist(data) {
    var wl = data.wishlist || {}, owned = data.owned || {}, hidden = data.hidden || {};
    var out = "";
    STAGES.forEach(function (st) {
      var items = (wl[st.id] || []).filter(function (it) { return it && !hidden[it.id]; });
      if (!items.length) return;
      items.forEach(function (it) { ITEM_INDEX[it.id] = it; });
      var needed = items.filter(function (it) { return !owned[it.id]; }).length;
      out += '<div class="s-stage">' +
        '<div class="s-stage-head"><span>' + esc(st.name) + '</span>' +
        '<span class="s-stage-count">' + needed + "개 필요</span></div>" +
        '<div class="s-stage-items">' + items.map(function (it) {
          var have = !!owned[it.id];
          return '<button type="button" class="s-wl-item' + (have ? " have" : "") + '" data-wl="' + esc(it.id) + '">' +
            '<span class="s-wl-emoji">' + esc(it.emoji || "🎁") + "</span>" +
            '<span class="s-wl-name">' + esc(it.name) + "</span>" +
            '<span class="s-wl-status">' + (have ? "✓ 보유" : "🎁 선물") + "</span>" +
            "</button>";
        }).join("") + "</div></div>";
    });
    return out;
  }

  function render(data) {
    var root = document.getElementById("share-root");
    var profile = data.profile || {};
    var baby = profile.babyName || (profile.name || "").replace("의 일기", "") || "우리 아기";
    var avatar = profile.avatar || "/public/photos/ai-01.jpg";
    var hero = profile.shareImage || profile.background || collectPhotos(data)[0] || avatar;
    var age = ageLabel(profile.currentAge);
    var photos = collectPhotos(data);
    var registry = data.giftPuzzles || [];

    var recHtml = photos.length
      ? '<div class="s-records">' + photos.map(function (s) {
          return '<div class="s-rec"><img src="' + esc(s) + '" alt="" loading="lazy"/></div>';
        }).join("") + "</div>"
      : '<p class="s-photo-empty">아직 올라온 기록이 없어요</p>';

    var giftInner = renderPuzzles(registry) + renderWishlist(data);
    if (!giftInner) giftInner = '<p class="s-photo-empty">아직 등록된 선물이 없어요</p>';

    root.innerHTML =
      '<section class="s-hero">' +
        '<div class="s-hero-bg" style="background-image:url(\'' + esc(hero) + '\')"></div>' +
        '<div class="s-hero-grad"></div>' +
        '<div class="s-hero-body">' +
          '<img class="s-hero-avatar" src="' + esc(avatar) + '" alt=""/>' +
          "<div><div class=\"s-hero-name\">" + esc(baby) + "의 베베박스</div>" +
          (age ? '<div class="s-hero-age">' + esc(age) + " · 성장 기록 중 👶</div>" : "") +
          "</div>" +
        "</div>" +
      "</section>" +
      '<section class="s-section s-section--records">' +
        '<h2 class="s-section-title">📷 ' + esc(baby) + "의 기록</h2>" +
        recHtml +
      "</section>" +
      '<section class="s-section" id="gift-section">' +
        '<h2 class="s-section-title">🧩 ' + esc(baby) + "의 조각 채우기</h2>" +
        '<p class="s-section-sub">선물하면 ' + esc(baby) + "에게 한 조각이 채워지고, 나도 키디키디 쿠폰을 받아요</p>" +
        giftInner +
      "</section>" +
      '<footer class="s-footer">' +
        '<div class="s-footer-brand">베베박스 · BEBEBOX</div>' +
        "아기의 성장을 가족과 함께 기록하고 선물해요" +
        '<br/><a class="s-cta-app" href="/home">나도 우리 아이 기록 시작하기 →</a>' +
      "</footer>" +
      '<button type="button" class="s-fab" id="s-fab" aria-label="선물하기">🎁<span class="s-fab-label">선물</span></button>';

    root.querySelectorAll("[data-gift]").forEach(function (btn) {
      btn.onclick = function () {
        var g = registry.find(function (x) { return x.id === btn.dataset.gift; });
        if (g) openGiftModal(g, baby);
      };
    });
    root.querySelectorAll("[data-wl]").forEach(function (btn) {
      btn.onclick = function () {
        var it = ITEM_INDEX[btn.dataset.wl];
        if (it) openGiftModal(it, baby);
      };
    });
    var fab = document.getElementById("s-fab");
    if (fab) fab.onclick = function () {
      var sec = document.getElementById("gift-section");
      if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
    };
  }

  function openGiftModal(item, baby) {
    var name = item.productName || item.name || "선물";
    document.getElementById("gift-modal-title").textContent = name;
    document.getElementById("gift-modal-desc").textContent =
      baby + "에게 “" + name + "”을(를) 선물해 주세요!";
    document.getElementById("gift-modal-go").href = kidikidiLink(item);
    document.getElementById("gift-modal").classList.remove("hidden");
  }
  function closeGiftModal() { document.getElementById("gift-modal").classList.add("hidden"); }
  document.getElementById("gift-modal-close").onclick = closeGiftModal;
  document.getElementById("gift-modal-backdrop").onclick = closeGiftModal;

  (async function init() {
    var fam = encodeURIComponent(BABY_ID);
    var row = await fetchJSON("/api/family-data?family=" + fam);
    var data = (row && row.data) || {};
    if (!data.posts || !data.posts.length) {
      var ph = await fetchJSON("/api/photos?family=" + fam);
      if (ph && ph.photos && ph.photos.length) {
        data.posts = [{ createdAt: Date.now(), photos: ph.photos.map(function (p) { return p.src; }) }];
      }
    }
    render(data);
  })();
})();
