/** 지인용 공유 페이지(/share/:baby_id) — 로그인 없이 보는 반응형 웹.
 * 부모가 등록한 아기 프로필·사진·선물 레지스트리를 읽기 전용으로 보여주고,
 * 선물 버튼을 누르면 외부 키디키디로 연결하는 고전환 랜딩 페이지.
 */
(function () {
  var BABY_ID = (window.__BABY_ID__ && window.__BABY_ID__ !== "{{BABY_ID}}")
    ? window.__BABY_ID__
    : decodeURIComponent((location.pathname.split("/share/")[1] || "BEBEBOX").split("/")[0] || "BEBEBOX");
  var KIDIKIDI_HOME = "https://kidikidi.elandmall.co.kr/";

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

  function render(data) {
    var root = document.getElementById("share-root");
    var profile = data.profile || {};
    var baby = profile.babyName || (profile.name || "").replace("의 일기", "") || "우리 아기";
    var avatar = profile.avatar || "/public/photos/ai-01.jpg";
    var hero = profile.shareImage || profile.background || collectPhotos(data)[0] || avatar;
    var age = ageLabel(profile.currentAge);
    var photos = collectPhotos(data).slice(0, 6);
    var registry = (data.giftPuzzles || []);

    var photoGrid = photos.length
      ? '<div class="s-photo-grid">' + photos.map(function (s) {
          return '<div class="cell" style="background-image:url(\'' + esc(s) + '\')"></div>';
        }).join("") + "</div>"
      : '<p class="s-photo-empty">아직 올라온 사진이 없어요</p>';

    var registryHtml = registry.length
      ? '<div class="s-registry">' + registry.map(function (g) {
          var filled = (g.pieces || []).length, total = g.total || 9;
          var pct = Math.round(filled / total * 100);
          var thumb = g.image
            ? '<div class="s-reg-thumb" style="background-image:url(\'' + esc(g.image) + '\')"></div>'
            : '<div class="s-reg-thumb">🎁</div>';
          return '<div class="s-reg-card">' + thumb +
            '<div class="s-reg-body">' +
            '<div class="s-reg-name">' + esc(g.productName) + "</div>" +
            '<div class="s-reg-brand">' + esc([g.brand, fmtPrice(g.price)].filter(Boolean).join(" · ")) + "</div>" +
            '<div class="s-reg-progress">🧩 ' + filled + " / " + total + " 조각 모임</div>" +
            '<div class="s-reg-bar"><div class="s-reg-bar-fill" style="width:' + pct + '%"></div></div>' +
            '<button type="button" class="s-gift-btn" data-gift="' + esc(g.id) + '">🎁 이 선물하고 키디키디 쿠폰 받기</button>' +
            "</div></div>";
        }).join("") + "</div>"
      : '<p class="s-photo-empty">아직 등록된 선물이 없어요</p>';

    root.innerHTML =
      '<section class="s-hero">' +
        '<div class="s-hero-bg" style="background-image:url(\'' + esc(hero) + '\')"></div>' +
        '<div class="s-hero-grad"></div>' +
        '<div class="s-hero-body">' +
          '<img class="s-hero-avatar" src="' + esc(avatar) + '" alt=""/>' +
          "<div><div class=\"s-hero-name\">" + esc(baby) + '의 베베박스</div>' +
          (age ? '<div class="s-hero-age">' + esc(age) + " · 성장 기록 중 👶</div>" : "") +
          "</div>" +
        "</div>" +
      "</section>" +
      '<section class="s-section">' +
        '<h2 class="s-section-title">📷 ' + esc(baby) + "의 순간들</h2>" +
        '<p class="s-section-sub">부모님이 담은 ' + esc(baby) + "의 소중한 기록이에요</p>" +
        photoGrid +
      "</section>" +
      '<section class="s-section">' +
        '<h2 class="s-section-title">🎁 ' + esc(baby) + " 선물 레지스트리</h2>" +
        '<p class="s-section-sub">선물하면 ' + esc(baby) + "에게 한 조각이 채워지고, 나도 키디키디 쿠폰을 받아요</p>" +
        registryHtml +
      "</section>" +
      '<footer class="s-footer">' +
        '<div class="s-footer-brand">베베박스 · BEBEBOX</div>' +
        "아기의 성장을 가족과 함께 기록하고 선물해요" +
        '<br/><a class="s-cta-app" href="/home">나도 우리 아이 기록 시작하기 →</a>' +
      "</footer>";

    root.querySelectorAll("[data-gift]").forEach(function (btn) {
      btn.onclick = function () {
        var g = registry.find(function (x) { return x.id === btn.dataset.gift; });
        if (g) openGiftModal(g, baby);
      };
    });
  }

  function openGiftModal(item, baby) {
    document.getElementById("gift-modal-title").textContent = item.productName;
    document.getElementById("gift-modal-desc").textContent =
      esc(baby) + "에게 “" + item.productName + "”을(를) 선물해 주세요!";
    var go = document.getElementById("gift-modal-go");
    go.href = kidikidiLink(item);
    document.getElementById("gift-modal").classList.remove("hidden");
  }
  function closeGiftModal() { document.getElementById("gift-modal").classList.add("hidden"); }

  document.getElementById("gift-modal-close").onclick = closeGiftModal;
  document.getElementById("gift-modal-backdrop").onclick = closeGiftModal;

  (async function init() {
    var fam = encodeURIComponent(BABY_ID);
    var row = await fetchJSON("/api/family-data?family=" + fam);
    var data = (row && row.data) || {};
    if (!data.profile) {
      // 사진만 있고 family-data 가 없는 경우라도 사진은 보여준다.
      var ph = await fetchJSON("/api/photos?family=" + fam);
      if (ph && ph.photos && ph.photos.length) {
        data.posts = [{ createdAt: Date.now(), photos: ph.photos.map(function (p) { return p.src; }) }];
      }
    }
    render(data);
  })();
})();
