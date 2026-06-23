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
  /* ===== 감성 큐레이션: 베이비샤워 위시리스트 ===== */
  // 상품명 키워드 → 감성 카피
  var EMO = [
    { k: "엽산", t: "첫 영양소 👶", d: "아기의 첫 세포 성장을 위한 매일의 필수 영양소" },
    { k: "철분", t: "튼튼 철분 🩸", d: "엄마와 아기의 건강한 혈액을 채워주는 영양" },
    { k: "튼살", t: "엄마 토닥토닥 크림 🤰", d: "변화하는 엄마 피부를 사랑으로 지키는 보습 크림" },
    { k: "실내복", t: "보들보들 첫 옷 🍼", d: "아기 살에 직접 닿는 가장 부드러운 순면" },
    { k: "바디", t: "꼬물이 우주복 👕", d: "기저귀 갈기 편한 보들보들 데일리 옷" },
    { k: "우주복", t: "꼬물이 우주복 👕", d: "기저귀 갈기 편한 보들보들 데일리 옷" },
    { k: "배냇", t: "처음 만나는 배냇저고리 👶", d: "세상에서 가장 보드라운 아기의 첫 옷" },
    { k: "속싸개", t: "포근 속싸개 🧣", d: "엄마 품처럼 아늑하게 감싸주는 첫 이불" },
    { k: "젖병", t: "첫 수유 젖병 🍼", d: "아기의 첫 식사를 함께할 안심 젖병" },
    { k: "카시트", t: "첫 드라이브 카시트 🚗", d: "안전한 첫 외출을 지켜주는 든든한 보호막" },
    { k: "유모차", t: "첫 산책 유모차 🛒", d: "세상 구경 나가는 아기의 첫 마차" },
    { k: "이유식", t: "냠냠 이유식 세트 🥣", d: "생애 첫 미음을 응원하는 식기 세트" },
    { k: "턱받이", t: "침받이 턱받이 👶", d: "이유식 시간을 뽀송하게 지켜줄 필수템" },
    { k: "기저귀", t: "뽀송 기저귀 🧷", d: "하루에도 몇 번씩, 아기를 보송하게" },
    { k: "체온계", t: "안심 체온계 🌡️", d: "작은 변화도 놓치지 않는 부모의 눈" },
    { k: "하이체어", t: "아기 식탁 의자 🪑", d: "가족과 함께 식탁에 앉는 첫 자리" },
    { k: "치발기", t: "오물오물 치발기 🦷", d: "이앓이 시기를 시원하게 달래줘요" },
    { k: "모빌", t: "빙글빙글 모빌 🎠", d: "아기의 첫 시선을 사로잡는 장난감" },
    { k: "수유", t: "편안한 수유 시간 🤱", d: "엄마와 아기 모두 편안한 수유를 위해" }
  ];
  function emoFor(name) {
    name = name || "";
    for (var i = 0; i < EMO.length; i++) if (name.indexOf(EMO[i].k) >= 0) return EMO[i];
    return { t: name + " 🎁", d: "우리 아이에게 필요한 소중한 선물" };
  }
  function guestbookFor(id) {
    var gb = (CURRENT_DATA.guestbook || []).filter(function (g) { return g.item_id === id; });
    return gb.length ? gb[gb.length - 1] : null;
  }
  // 보드/카드에 쓸 9조각: 선물 퍼즐 + 옷장 필요 항목
  function buildPieces() {
    var out = [], seen = {};
    (CURRENT_DATA.giftPuzzles || []).forEach(function (g) {
      if (seen[g.id]) return; seen[g.id] = 1;
      var e = emoFor(g.productName);
      out.push({ id: g.id, base: g.productName, title: e.t, desc: e.d, emoji: (e.t.match(/\p{Emoji}/u) || ["🎁"])[0], url: g.url, brand: g.brand });
    });
    var wl = CURRENT_DATA.wishlist || {}, owned = CURRENT_DATA.owned || {}, hidden = CURRENT_DATA.hidden || {};
    STAGES.forEach(function (st) {
      (wl[st.id] || []).forEach(function (it) {
        if (out.length >= 9 || !it || hidden[it.id] || owned[it.id] || seen[it.id]) return;
        seen[it.id] = 1; ITEM_INDEX[it.id] = it;
        var e = emoFor(it.name);
        out.push({ id: it.id, base: it.name, title: e.t, desc: e.d, emoji: it.emoji || (e.t.match(/\p{Emoji}/u) || ["🎁"])[0], url: it.url });
      });
    });
    return out.slice(0, 9);
  }

  var PIECES = [];
  function openGiftSheet() {
    PIECES = buildPieces();
    document.getElementById("gift-sheet-title").textContent = CUR_BABY + "의 베이비샤워 위시";
    document.getElementById("gift-sheet-body").innerHTML = renderRegistry();
    bindRegistry();
    document.getElementById("gift-sheet").classList.remove("hidden");
  }
  function closeGiftSheet() { document.getElementById("gift-sheet").classList.add("hidden"); }

  function renderRegistry() {
    if (!PIECES.length) return '<p class="s-photo-empty">아직 등록된 선물이 없어요</p>';
    // 3x3 보드
    var board = '<div class="bb-board">' + Array.from({ length: 9 }).map(function (_, i) {
      var p = PIECES[i];
      if (!p) return '<div class="bb-tile empty"><span class="bb-lock">🔒</span></div>';
      var gb = guestbookFor(p.id);
      if (gb) return '<div class="bb-tile filled"><span class="bb-foot">👣</span><span class="bb-bubble">' + esc(gb.guest_name) + '</span></div>';
      return '<div class="bb-tile locked"><span class="bb-emoji">' + esc(p.emoji) + '</span></div>';
    }).join("") + "</div>";
    var done = PIECES.filter(function (p) { return guestbookFor(p.id); }).length;
    var progress = '<p class="bb-progress">🧩 ' + done + " / " + PIECES.length + " 조각이 채워졌어요</p>";
    // 카드
    var cards = '<div class="bb-cards">' + PIECES.map(function (p) {
      var gb = guestbookFor(p.id);
      if (gb) {
        return '<div class="bb-card gifted">' +
          '<div class="bb-card-emoji">' + esc(p.emoji) + "</div>" +
          '<div class="bb-card-title">' + esc(p.title) + "</div>" +
          '<div class="bb-chat">' + esc(gb.guest_name) + ": " + esc(gb.message || "선물 완료! 🎁") + "</div>" +
          '<div class="bb-gifted-badge">✓ 선물 완료</div></div>';
      }
      return '<div class="bb-card">' +
        '<div class="bb-card-emoji">' + esc(p.emoji) + "</div>" +
        '<div class="bb-card-title">' + esc(p.title) + "</div>" +
        '<div class="bb-card-desc">' + esc(p.desc) + "</div>" +
        '<button type="button" class="bb-card-cta" data-piece="' + esc(p.id) + '">' + esc(CUR_BABY) + "에게 이 조각 선물하기 🎁</button></div>";
    }).join("") + "</div>";
    return board + progress + cards;
  }
  function bindRegistry() {
    document.querySelectorAll("[data-piece]").forEach(function (btn) {
      btn.onclick = function () {
        var p = PIECES.find(function (x) { return x.id === btn.dataset.piece; });
        if (p) startGiftFlow(p);
      };
    });
  }

  /* ===== 3단계 선물 + 방명록 플로우 ===== */
  var FLOW_PIECE = null;
  function showFlow(html) {
    document.getElementById("flow-card").innerHTML = html;
    document.getElementById("flow-modal").classList.remove("hidden");
  }
  function closeFlow() { document.getElementById("flow-modal").classList.add("hidden"); FLOW_PIECE = null; }

  function startGiftFlow(piece) {
    FLOW_PIECE = piece;
    // Step 1: 키디키디로 이동
    var url = kidikidiLink({ url: piece.url, brand: piece.brand, productName: piece.base, name: piece.base });
    window.open(url, "_blank", "noopener");
    showFlow(
      '<div class="flow-emoji">🛍️</div>' +
      '<h3 class="flow-title">키디키디로 이동했어요</h3>' +
      '<p class="flow-desc">새 탭에서 “' + esc(piece.base) + '”을(를) 구매한 뒤<br/>이 화면으로 돌아와 주세요.</p>' +
      '<button type="button" class="flow-primary" id="flow-step2">구매하고 돌아왔어요</button>' +
      '<button type="button" class="flow-ghost" id="flow-cancel">취소</button>'
    );
    document.getElementById("flow-step2").onclick = stepConfirm;
    document.getElementById("flow-cancel").onclick = closeFlow;
  }
  function stepConfirm() {
    showFlow(
      '<div class="flow-emoji">🎉</div>' +
      '<h3 class="flow-title">' + esc(CUR_BABY) + "에게 선물을 완료하셨나요?</h3>" +
      '<p class="flow-desc">완료하셨다면 따뜻한 축하 한마디를 남겨주세요!</p>' +
      '<button type="button" class="flow-primary" id="flow-yes">네, 선물 완료! 🎁</button>' +
      '<button type="button" class="flow-ghost" id="flow-back">돌아가기</button>'
    );
    document.getElementById("flow-yes").onclick = stepForm;
    document.getElementById("flow-back").onclick = closeFlow;
  }
  var REL = ["이모", "고모", "삼촌", "외삼촌", "할머니", "할아버지", "친구", "기타"];
  var pickedRel = "이모";
  function stepForm() {
    pickedRel = "이모";
    showFlow(
      '<h3 class="flow-title">축하 남기기 ✍️</h3>' +
      '<p class="flow-label">관계</p>' +
      '<div class="flow-chips" id="flow-chips">' + REL.map(function (r, i) {
        return '<button type="button" class="flow-chip' + (i === 0 ? " on" : "") + '" data-rel="' + r + '">' + r + "</button>";
      }).join("") + "</div>" +
      '<p class="flow-label">이름/닉네임</p>' +
      '<input type="text" id="flow-name" class="flow-input" placeholder="예: 체리이모" maxlength="16"/>' +
      '<p class="flow-label">축하 메시지</p>' +
      '<textarea id="flow-msg" class="flow-textarea" rows="3" maxlength="200" placeholder="민우야 이모가 사준 옷 입고 꿀잠 자~ ❤️"></textarea>' +
      '<button type="button" class="flow-primary" id="flow-submit">축하 남기고 완료 🎀</button>'
    );
    document.querySelectorAll("[data-rel]").forEach(function (c) {
      c.onclick = function () {
        document.querySelectorAll("[data-rel]").forEach(function (x) { x.classList.remove("on"); });
        c.classList.add("on"); pickedRel = c.dataset.rel;
      };
    });
    document.getElementById("flow-submit").onclick = submitGuestbook;
  }
  function submitGuestbook() {
    if (!FLOW_PIECE) return;
    var name = (document.getElementById("flow-name").value || "").trim() || pickedRel;
    var msg = (document.getElementById("flow-msg").value || "").trim();
    var data = { item_id: FLOW_PIECE.id, relationship: pickedRel, guest_name: name, message: msg };
    handleGuestbookSubmit(data);
    closeFlow();
    fireConfetti();
    // 보드/카드 갱신
    document.getElementById("gift-sheet-body").innerHTML = renderRegistry();
    bindRegistry();
  }
  // 백엔드 연동용 핸들러(콘솔 출력 + 가족 데이터에 저장)
  function handleGuestbookSubmit(data) {
    console.log("[handleGuestbookSubmit]", data);
    if (!Array.isArray(CURRENT_DATA.guestbook)) CURRENT_DATA.guestbook = [];
    CURRENT_DATA.guestbook.push({ item_id: data.item_id, relationship: data.relationship, guest_name: data.guest_name, message: data.message, at: Date.now() });
    persistNow();
  }

  /* ===== 컨페티 ===== */
  function fireConfetti() {
    var cv = document.getElementById("confetti");
    if (!cv) return;
    var ctx = cv.getContext("2d");
    cv.width = window.innerWidth; cv.height = window.innerHeight;
    var colors = ["#ff6b3d", "#ffd166", "#ff8fab", "#a0e7a0", "#8ec5ff", "#c8a2ff"];
    var parts = [];
    for (var i = 0; i < 140; i++) parts.push({
      x: cv.width / 2, y: cv.height * 0.35,
      vx: (Math.random() - 0.5) * 14, vy: Math.random() * -15 - 4,
      g: 0.35 + Math.random() * 0.2, s: 6 + Math.random() * 6,
      c: colors[(Math.random() * colors.length) | 0], r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4
    });
    var t0 = Date.now();
    (function frame() {
      var el = Date.now() - t0;
      ctx.clearRect(0, 0, cv.width, cv.height);
      parts.forEach(function (p) {
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); ctx.restore();
      });
      if (el < 2600) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, cv.width, cv.height);
    })();
  }

  document.getElementById("gift-sheet-backdrop").onclick = closeGiftSheet;
  document.getElementById("gift-sheet-close").onclick = closeGiftSheet;
  document.getElementById("flow-backdrop").onclick = closeFlow;
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
