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
  var CURRENT_DATA = null;   // 서버에서 받은 전체 가족 데이터(상호작용 저장 시 그대로 PUT)
  var HAS_FAMILY = false;    // 가족 데이터 문서가 있을 때만 서버 저장
  var CUR_BABY = "우리 아기";
  var CMT_PID = null;        // 현재 댓글 시트가 열린 글 id
  var _saveTimer = null;

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

  // 서버에 가족 데이터 전체를 그대로 되돌려 저장(불러온 객체를 수정해 PUT → 다른 필드 보존)
  function persistSoon() {
    if (!HAS_FAMILY || !CURRENT_DATA) return;
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(persistNow, 500);
  }
  async function persistNow() {
    if (!HAS_FAMILY || !CURRENT_DATA) return;
    try {
      await fetch("/api/family-data?family=" + encodeURIComponent(BABY_ID), {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(CURRENT_DATA),
      });
    } catch (_) {}
  }
  function getPost(id) { return (CURRENT_DATA.posts || []).find(function (p) { return p.id === id; }); }

  function fmtDate(ts) {
    if (!ts) return "";
    var d = new Date(ts);
    return (d.getMonth() + 1) + "월 " + d.getDate() + "일";
  }
  // 부모 화면과 동일한 게시물(post-card) 형태 + 하트 게이지 + 댓글
  function renderRecords(posts, profile, baby) {
    if (!posts.length) return '<p class="s-photo-empty">아직 올라온 기록이 없어요</p>';
    var avatar = profile.avatar || "/public/photos/ai-01.jpg";
    var name = profile.name || (baby + "의 일기");
    return posts.map(function (p) {
      var multi = (p.photos || []).length > 1;
      var slides = (p.photos || []).map(function (s) {
        return '<div class="post-photo-slide"><img src="' + esc(s) + '" alt="" loading="lazy"/></div>';
      }).join("");
      var nav = multi
        ? '<button type="button" class="post-nav prev" data-nav="prev" aria-label="이전 사진">‹</button>' +
          '<button type="button" class="post-nav next" data-nav="next" aria-label="다음 사진">›</button>' +
          '<div class="post-count">1/' + p.photos.length + "</div>"
        : "";
      var dots = multi
        ? '<div class="post-dots">' + p.photos.map(function (_, i) { return '<span class="' + (i === 0 ? "on" : "") + '"></span>'; }).join("") + "</div>"
        : "";
      var imgs = (p.photos && p.photos.length)
        ? '<div class="post-photos-wrap"><div class="post-photos' + (multi ? " multi" : "") + '">' + slides + "</div>" + nav + "</div>" + dots
        : "";
      var gpct = Math.min(100, p.gauge || 0);
      var dateAge = [fmtDate(p.createdAt), ageLabel(p.ageMonth)].filter(Boolean).join(" · ");
      var text = p.text ? '<p class="post-text"><strong>' + esc(name) + "</strong> " + esc(p.text) + "</p>" : "";
      var cc = (p.comments || []).length;
      return '<article class="post-card" data-pid="' + esc(p.id) + '">' +
        '<div class="post-head"><img class="post-avatar" src="' + esc(avatar) + '" alt=""/>' +
          '<div class="post-head-meta"><div class="post-name">' + esc(name) + '</div><div class="post-date">' + esc(dateAge) + "</div></div></div>" +
        imgs +
        '<div class="post-emotion">' +
          '<button type="button" class="post-emotion-btn" data-heart="' + esc(p.id) + '" aria-label="하트">❤️</button>' +
          '<div class="post-gauge"><div class="post-gauge-fill" style="width:' + gpct + '%"></div></div>' +
          '<span class="post-emotion-count" data-hc="' + esc(p.id) + '">' + (p.gauge || 0) + "</span>" +
        "</div>" +
        text +
        '<button type="button" class="post-comment-link" data-cmt="' + esc(p.id) + '">💬 댓글 ' + (cc ? cc + "개" : "달기") + "</button>" +
        "</article>";
    }).join("");
  }
  function cssEsc(s) { return (window.CSS && CSS.escape) ? CSS.escape(s) : s; }
  function bumpHeart(id) {
    var p = getPost(id); if (!p) return;
    p.gauge = (p.gauge || 0) + 1;
    var hc = document.querySelector('[data-hc="' + cssEsc(id) + '"]');
    var card = document.querySelector('.post-card[data-pid="' + cssEsc(id) + '"]');
    if (hc) hc.textContent = p.gauge;
    var fill = card && card.querySelector(".post-gauge-fill");
    if (fill) fill.style.width = Math.min(100, p.gauge) + "%";
    var btn = card && card.querySelector(".post-emotion-btn");
    if (btn) { btn.classList.remove("pop"); void btn.offsetWidth; btn.classList.add("pop"); }
    persistSoon();
  }

  function openComments(id) {
    CMT_PID = id;
    renderCommentList();
    document.getElementById("cmt-text").value = "";
    document.getElementById("cmt-sheet").classList.remove("hidden");
  }
  function closeComments() { document.getElementById("cmt-sheet").classList.add("hidden"); CMT_PID = null; }
  function renderCommentList() {
    var p = getPost(CMT_PID);
    var list = document.getElementById("cmt-list");
    var arr = (p && p.comments) || [];
    list.innerHTML = arr.length
      ? arr.map(function (c) {
          return '<div class="cmt-item"><b>' + esc(c.author || "익명") + "</b> " + esc(c.text) + "</div>";
        }).join("")
      : '<p class="cmt-empty">첫 댓글을 남겨보세요 🙂</p>';
    list.scrollTop = list.scrollHeight;
  }
  function sendComment() {
    var p = getPost(CMT_PID); if (!p) return;
    var t = document.getElementById("cmt-text").value.trim();
    if (!t) return;
    var name = document.getElementById("cmt-name").value.trim() || "익명";
    if (!Array.isArray(p.comments)) p.comments = [];
    p.comments.push({ id: "c" + Date.now(), author: name, text: t, at: Date.now() });
    document.getElementById("cmt-text").value = "";
    renderCommentList();
    persistNow();
    var link = document.querySelector('[data-cmt="' + (window.CSS && CSS.escape ? CSS.escape(CMT_PID) : CMT_PID) + '"]');
    if (link) link.textContent = "💬 댓글 " + p.comments.length + "개";
  }

  function render(data) {
    var root = document.getElementById("share-root");
    var profile = data.profile || {};
    var baby = profile.babyName || (profile.name || "").replace("의 일기", "") || "우리 아기";
    CUR_BABY = baby;
    var avatar = profile.avatar || "/public/photos/ai-01.jpg";
    var hero = profile.shareImage || profile.background || collectPhotos(data)[0] || avatar;
    var age = ageLabel(profile.currentAge);
    var posts = (data.posts || []).slice().sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    var registry = data.giftPuzzles || [];

    var recHtml = renderRecords(posts, profile, baby);

    // 첫 화면은 기록만. 선물(조각 채우기)은 플로팅 버튼 → 오버레이로만 진입.
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
      '<footer class="s-footer">' +
        '<div class="s-footer-brand">베베박스 · BEBEBOX</div>' +
        "아기의 성장을 가족과 함께 기록하고 선물해요" +
        '<br/><a class="s-cta-app" href="/home">나도 우리 아이 기록 시작하기 →</a>' +
      "</footer>" +
      '<button type="button" class="s-fab" id="s-fab" aria-label="선물하기">🎁<span class="s-fab-label">선물</span></button>';

    bindRecordEvents(root);
    var fab = document.getElementById("s-fab");
    if (fab) fab.onclick = openGiftSheet;
  }

  // 기록 카드 이벤트(하트·댓글·캐러셀) — 부모 화면과 동일 동작
  function bindRecordEvents(scope) {
    scope.querySelectorAll("[data-heart]").forEach(function (btn) {
      btn.onclick = function () { bumpHeart(btn.dataset.heart); };
    });
    scope.querySelectorAll("[data-cmt]").forEach(function (btn) {
      btn.onclick = function () { openComments(btn.dataset.cmt); };
    });
    scope.querySelectorAll(".post-nav").forEach(function (btn) {
      btn.onclick = function () {
        var sc = btn.parentElement.querySelector(".post-photos");
        if (!sc) return;
        sc.scrollBy({ left: (btn.dataset.nav === "next" ? 1 : -1) * sc.clientWidth, behavior: "smooth" });
      };
    });
    scope.querySelectorAll(".post-photos.multi").forEach(function (sc) {
      sc.addEventListener("scroll", function () {
        var i = Math.round(sc.scrollLeft / Math.max(1, sc.clientWidth));
        var wrap = sc.parentElement, dots = wrap.nextElementSibling;
        if (dots && dots.classList.contains("post-dots"))
          dots.querySelectorAll("span").forEach(function (d, di) { d.classList.toggle("on", di === i); });
        var cnt = wrap.querySelector(".post-count");
        if (cnt) cnt.textContent = (i + 1) + "/" + sc.children.length;
      }, { passive: true });
    });
  }

  // 선물(조각 채우기) 오버레이
  function openGiftSheet() {
    var body = document.getElementById("gift-sheet-body");
    var inner = renderPuzzles(CURRENT_DATA.giftPuzzles || []) + renderWishlist(CURRENT_DATA);
    body.innerHTML = '<p class="s-section-sub">선물하면 ' + esc(CUR_BABY) + "에게 한 조각이 채워지고, 나도 키디키디 쿠폰을 받아요</p>" +
      (inner || '<p class="s-photo-empty">아직 등록된 선물이 없어요</p>');
    document.getElementById("gift-sheet-title").textContent = CUR_BABY + "의 조각 채우기";
    body.querySelectorAll("[data-gift]").forEach(function (btn) {
      btn.onclick = function () {
        var g = (CURRENT_DATA.giftPuzzles || []).find(function (x) { return x.id === btn.dataset.gift; });
        if (g) openGiftModal(g, CUR_BABY);
      };
    });
    body.querySelectorAll("[data-wl]").forEach(function (btn) {
      btn.onclick = function () { var it = ITEM_INDEX[btn.dataset.wl]; if (it) openGiftModal(it, CUR_BABY); };
    });
    document.getElementById("gift-sheet").classList.remove("hidden");
  }
  function closeGiftSheet() { document.getElementById("gift-sheet").classList.add("hidden"); }

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
  document.getElementById("gift-sheet-backdrop").onclick = closeGiftSheet;
  document.getElementById("gift-sheet-close").onclick = closeGiftSheet;
  document.getElementById("cmt-backdrop").onclick = closeComments;
  document.getElementById("cmt-send").onclick = sendComment;
  document.getElementById("cmt-text").addEventListener("keydown", function (e) { if (e.key === "Enter") sendComment(); });

  (async function init() {
    var fam = encodeURIComponent(BABY_ID);
    var row = await fetchJSON("/api/family-data?family=" + fam);
    HAS_FAMILY = !!(row && row.data && Object.keys(row.data).length);
    var data = (row && row.data) || {};
    if (!data.posts || !data.posts.length) {
      var ph = await fetchJSON("/api/photos?family=" + fam);
      if (ph && ph.photos && ph.photos.length) {
        data.posts = [{ id: "legacy", createdAt: Date.now(), photos: ph.photos.map(function (p) { return p.src; }) }];
      }
    }
    // 글마다 id/배열 보정(하트·댓글 저장용)
    (data.posts || []).forEach(function (p, i) {
      if (!p.id) p.id = "post" + i;
      if (!Array.isArray(p.comments)) p.comments = [];
      if (p.gauge == null) p.gauge = 0;
    });
    CURRENT_DATA = data;
    render(data);
  })();
})();
