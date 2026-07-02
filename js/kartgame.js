/* 베베 카트 레이스 — 독립 미니게임 (기존 로직과 분리)
 * window.KartGame.open() 으로 진입. 뷰 전환은 app.js 의 showOverlay/switchMainTab 재사용.
 * 카트 선택 → 아기 프로필 사진이 카트에 타서 좌우로 장애물 피하고 별 모으기(약 60초).
 */
(function () {
  "use strict";
  var KARTS = [
    { id: "k1", name: "크림",   img: "public/photos/karts/kart1.png" },
    { id: "k2", name: "그레이", img: "public/photos/karts/kart2.png" },
    { id: "k3", name: "차콜",   img: "public/photos/karts/kart3.png" },
    { id: "k4", name: "아이보리", img: "public/photos/karts/kart4.png" }
  ];
  var DEFAULT_AVATAR = "public/photos/default-profile.png";
  var GAME_SECONDS = 60;

  // 결과 화면 '핀핀 상품 더보기' (키디키디 상품)
  var PINPIN_PRODUCTS = [
    { no: "2603319309", name: "초경량 휴대용 트라이크 V1 클래식", price: 69900, img: "https://item.elandrs.com/r/image/item/2026-05-21/e5214c5c-4dbd-4d5c-a7d4-573c60ddc6db.jpg" },
    { no: "2604393821", name: "초경량 휴대용 트라이크 V2 와이드", price: 85900, img: "https://item.elandrs.com/r/image/item/2026-05-14/cd02590b-b069-4200-9f84-0a8069f9fbbf.jpg" },
    { no: "2603334059", name: "드림 스타트 밸런스 바이크 V2 프로", price: 45900, img: "https://item.elandrs.com/r/image/item/2026-03-19/cfc89107-87e2-4e7f-a749-f8178bb0282a.jpg" },
    { no: "2604390565", name: "스위밍베어 캐노피 튜브", price: 17900, img: "https://item.elandrs.com/r/image/item/2026-05-13/ae1f4e2b-41e7-429c-9651-7c72ff317533.jpg" }
  ];
  function pinpinUrl(no) { return "https://kidikidi.elandmall.co.kr/i/item?itemNo=" + no; }
  function wonFmt(n) { return (n || 0).toLocaleString("ko-KR") + "원"; }
  function renderPinpin() {
    var wrap = $("#kr-products"); if (!wrap) return;
    if (wrap.getAttribute("data-filled") === "1") return;
    wrap.innerHTML = "";
    PINPIN_PRODUCTS.forEach(function (p) {
      var a = document.createElement("a");
      a.href = pinpinUrl(p.no); a.target = "_blank"; a.rel = "noopener noreferrer";
      a.className = "kr-prod";
      a.innerHTML =
        '<span class="kr-prod-img"><img src="' + p.img + '" alt="" loading="lazy"/></span>' +
        '<span class="kr-prod-brand">핀핀</span>' +
        '<span class="kr-prod-name">' + p.name + '</span>' +
        '<span class="kr-prod-price">' + wonFmt(p.price) + '</span>';
      wrap.appendChild(a);
    });
    wrap.setAttribute("data-filled", "1");
  }

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var chosen = null, kartImg = null, avatarImg = null;
  var timer = null, running = false, lastTs = 0;
  var now = function () { return (window.performance && performance.now) ? performance.now() : Date.now(); };
  var cv, ctx, W = 0, H = 0, dpr = 1;
  var g = null;           // 진행 중 게임 상태
  var dir = 0;            // -1 왼쪽 / 1 오른쪽 / 0 정지
  var imgCache = {};

  function babyAvatarSrc() {
    try {
      var a = window.state && window.state.profile && window.state.profile.avatar;
      return a || DEFAULT_AVATAR;
    } catch (e) { return DEFAULT_AVATAR; }
  }
  function babyName() {
    try {
      return (window.state && window.state.profile && window.state.profile.babyName) || "우리 아이";
    } catch (e) { return "우리 아이"; }
  }
  function loadImg(src) {
    return new Promise(function (res) {
      if (imgCache[src]) { res(imgCache[src]); return; }
      var im = new Image();
      im.onload = function () { imgCache[src] = im; res(im); };
      im.onerror = function () { res(null); };
      im.src = src;
    });
  }

  /* ---------------- 화면 전환 ---------------- */
  function open() {
    if (!$("#kart-view")) return;
    if (window.showOverlay) window.showOverlay("#kart-view");
    else $("#kart-view").classList.add("active");
    showSelect();
  }
  function backToList() { stop(); if (window.switchMainTab) window.switchMainTab("game"); }

  function screen(id) {
    ["kart-select", "kart-play", "kart-result"].forEach(function (s) {
      var el = document.getElementById(s); if (el) el.classList.toggle("hidden", s !== id);
    });
  }

  function showSelect() {
    stop();
    var n = $("#kart-select .js-baby-name"); if (n) n.textContent = babyName();
    screen("kart-select");
    renderKarts();
  }
  function renderKarts() {
    var wrap = $("#kr-karts"); if (!wrap) return;
    var av = babyAvatarSrc();
    wrap.innerHTML = "";
    KARTS.forEach(function (k) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "kr-kart" + (chosen && chosen.id === k.id ? " on" : "");
      b.innerHTML =
        '<div class="kr-kart-stage">' +
          '<img class="kr-kart-img" src="' + k.img + '" alt="' + k.name + ' 카트"/>' +
          '<span class="kr-kart-ava" style="background-image:url(\'' + av + '\')"></span>' +
        '</div>' +
        '<span class="kr-kart-nm">' + k.name + ' 카트</span>';
      b.onclick = function () { chosen = k; renderKarts(); var s = $("#kr-start"); if (s) s.disabled = false; };
      wrap.appendChild(b);
    });
  }

  /* ---------------- 게임 시작/종료 ---------------- */
  function startPlay() {
    if (!chosen) return;
    screen("kart-play");
    Promise.all([loadImg(chosen.img), loadImg(babyAvatarSrc())]).then(function (res) {
      kartImg = res[0]; avatarImg = res[1] || null;
      sizeCanvas();
      g = {
        kartX: 0, kartY: 0, kartW: 0, kartH: 0,
        vx: 0, obstacles: [], spawnAt: 0, laneOffset: 0,
        scenery: [], sceneryAt: 0, bob: 0,
        speed: 240, score: 0, lives: 3, time: GAME_SECONDS,
        invuln: 0, over: false
      };
      g.kartW = Math.min(104, W * 0.32);
      g.kartH = g.kartW;
      g.kartY = H - g.kartH - 18;
      g.kartX = (W - g.kartW) / 2;
      updateHud();
      running = true; lastTs = now();
      timer = setInterval(tick, 1000 / 60);
    });
  }
  function stop() {
    running = false;
    if (timer) { clearInterval(timer); timer = null; }
    dir = 0;
  }
  function finish(cleared) {
    stop();
    var t = $("#kr-result-title"), e = $("#kr-result-emoji"),
        fs = $("#kr-final-score"), sub = $("#kr-result-sub");
    if (fs) fs.textContent = g ? g.score : 0;
    if (cleared) {
      if (t) t.textContent = "완주 성공! 🎉";
      if (e) e.textContent = "🏆";
      var rewarded = false;
      try {
        if (typeof window.addPoints === "function") {
          window.addPoints(10, "kart_win"); rewarded = true;
          if (typeof window._syncProfileChange === "function") window._syncProfileChange();
          if (typeof window.renderPointsUI === "function") window.renderPointsUI();
        }
      } catch (err) {}
      if (sub) sub.textContent = babyName() + "가 끝까지 달렸어요!" + (rewarded ? " 🍬 완주 보상 +10캔디!" : "");
      if (rewarded && typeof window.showToast === "function") window.showToast("🎉 완주 성공! +10캔디 획득");
    }
    else { if (t) t.textContent = "게임 오버"; if (e) e.textContent = "💥"; if (sub) sub.textContent = "별을 더 모아 최고 점수에 도전해요!"; }
    renderPinpin();
    screen("kart-result");
  }

  /* ---------------- 캔버스 ---------------- */
  function sizeCanvas() {
    cv = $("#kr-canvas"); if (!cv) return;
    ctx = cv.getContext("2d");
    var wrap = cv.parentElement;
    dpr = window.devicePixelRatio || 1;
    W = wrap.clientWidth; H = wrap.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + "px"; cv.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function roadRect() { var rx = W * 0.1, rw = W * 0.8; return { x: rx, w: rw }; }

  function tick() {
    if (!running) return;
    var t = now();
    var dt = Math.min(0.05, (t - lastTs) / 1000); lastTs = t;
    update(dt); draw();
  }

  function update(dt) {
    var rd = roadRect();
    // 타이머
    g.time -= dt;
    if (g.time <= 0) { g.time = 0; updateHud(); finish(true); return; }
    // 속도 점점 증가
    g.speed = Math.min(560, g.speed + dt * 18);
    g.laneOffset = (g.laneOffset + g.speed * dt) % 60;
    g.bob += dt;
    // 길가 배경 장식(비충돌) 스폰/이동
    g.sceneryAt -= dt;
    if (g.sceneryAt <= 0) {
      g.sceneryAt = 0.42 + Math.random() * 0.35;
      var TYPES = ["tree", "tree", "bush", "flower"];
      g.scenery.push({ side: Math.random() < 0.5 ? -1 : 1, y: -40, type: TYPES[(Math.random() * TYPES.length) | 0], seed: Math.random() });
    }
    for (var si = g.scenery.length - 1; si >= 0; si--) {
      g.scenery[si].y += g.speed * dt * 0.92;
      if (g.scenery[si].y > H + 50) g.scenery.splice(si, 1);
    }
    // 카트 이동
    g.kartX += dir * (W * 0.9) * dt;
    var minX = rd.x + 4, maxX = rd.x + rd.w - g.kartW - 4;
    if (g.kartX < minX) g.kartX = minX;
    if (g.kartX > maxX) g.kartX = maxX;
    if (g.invuln > 0) g.invuln -= dt;
    // 장애물 스폰
    g.spawnAt -= dt;
    if (g.spawnAt <= 0) {
      g.spawnAt = Math.max(0.45, 0.95 - (GAME_SECONDS - g.time) * 0.008);
      var isStar = Math.random() < 0.34;
      var r = isStar ? 16 : (18 + Math.random() * 6);
      var x = rd.x + r + Math.random() * (rd.w - 2 * r);
      g.obstacles.push({ x: x, y: -r - 4, r: r, star: isStar });
    }
    // 이동 + 충돌
    var kcx = g.kartX + g.kartW / 2, kcy = g.kartY + g.kartH * 0.5, kr = g.kartW * 0.28;
    for (var i = g.obstacles.length - 1; i >= 0; i--) {
      var o = g.obstacles[i];
      o.y += g.speed * dt;
      if (o.y - o.r > H + 10) { g.obstacles.splice(i, 1); continue; }
      var dx = o.x - kcx, dy = o.y - kcy, dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < o.r + kr) {
        if (o.star) { g.score += 10; g.obstacles.splice(i, 1); updateHud(); }
        else if (g.invuln <= 0) {
          g.lives -= 1; g.invuln = 1.0; g.obstacles.splice(i, 1); updateHud();
          if (g.lives <= 0) { finish(false); return; }
        }
      }
    }
  }

  function draw() {
    var rd = roadRect();
    drawGrass();
    drawScenery(rd);   // 길가 나무/꽃/덤불 (도로 밖 잔디 위)
    drawRoad(rd);
    // 장애물/별
    for (var i = 0; i < g.obstacles.length; i++) {
      var o = g.obstacles[i];
      ctx.font = (o.r * 2) + "px serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(o.star ? "⭐" : "🚧", o.x, o.y);
    }
    // 카트 + 아이
    var blink = g.invuln > 0 && (Math.floor(g.invuln * 12) % 2 === 0);
    if (!blink) drawKartAndChild();
  }

  function drawGrass() {
    var gr = ctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, "#7ec97a"); gr.addColorStop(1, "#93d98c");
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    // 스크롤되는 잔디 줄무늬(잔디 깎은 느낌)
    ctx.fillStyle = "rgba(255,255,255,.05)";
    var band = 74, start = (g.laneOffset % band) - band;
    for (var y = start; y < H; y += band) ctx.fillRect(0, y, W, band / 2);
  }

  function drawRoad(rd) {
    var agr = ctx.createLinearGradient(rd.x, 0, rd.x + rd.w, 0);
    agr.addColorStop(0, "#4f5866"); agr.addColorStop(0.5, "#606978"); agr.addColorStop(1, "#4f5866");
    ctx.fillStyle = agr; ctx.fillRect(rd.x, 0, rd.w, H);
    // 도로 안쪽 흰 실선
    ctx.fillStyle = "#eef2f7"; ctx.fillRect(rd.x + 4, 0, 4, H); ctx.fillRect(rd.x + rd.w - 8, 0, 4, H);
    // 빨강/흰 커브(스크롤)
    var seg = 34, p = (g.laneOffset % (seg * 2)) - seg * 2;
    for (var y = p; y < H; y += seg * 2) {
      ctx.fillStyle = "#e2554f"; ctx.fillRect(rd.x - 6, y, 6, seg); ctx.fillRect(rd.x + rd.w, y, 6, seg);
      ctx.fillStyle = "#f5f6f8"; ctx.fillRect(rd.x - 6, y + seg, 6, seg); ctx.fillRect(rd.x + rd.w, y + seg, 6, seg);
    }
    // 중앙 점선
    ctx.fillStyle = "rgba(255,255,255,.9)";
    var cx = rd.x + rd.w / 2 - 3;
    for (var y2 = -60 + g.laneOffset; y2 < H; y2 += 60) ctx.fillRect(cx, y2, 6, 34);
  }

  function drawScenery(rd) {
    var leftC = rd.x * 0.52, rightC = rd.x + rd.w + (W - rd.x - rd.w) * 0.48;
    for (var i = 0; i < g.scenery.length; i++) {
      var sc = g.scenery[i];
      var cx = (sc.side < 0 ? leftC : rightC) + (sc.seed - 0.5) * (rd.x * 0.5);
      drawSceneryItem(sc.type, cx, sc.y, sc.seed);
    }
  }

  function drawSceneryItem(type, x, y, seed) {
    if (type === "tree") {
      ctx.fillStyle = "#8a5a33"; ctx.fillRect(x - 3, y, 6, 16);
      ctx.fillStyle = "#3f9d55"; ctx.beginPath(); ctx.arc(x, y - 4, 15, 0, 7); ctx.fill();
      ctx.fillStyle = "#4bb168"; ctx.beginPath(); ctx.arc(x - 6, y - 1, 10, 0, 7); ctx.arc(x + 7, y - 2, 11, 0, 7); ctx.fill();
    } else if (type === "bush") {
      ctx.fillStyle = "#57b56e";
      ctx.beginPath(); ctx.arc(x - 8, y, 9, 0, 7); ctx.arc(x + 8, y, 9, 0, 7); ctx.arc(x, y - 5, 11, 0, 7); ctx.fill();
    } else if (type === "flower") {
      var cols = ["#ff8fb1", "#ffd45e", "#a99cff", "#ff9d6e"];
      for (var k = 0; k < 3; k++) {
        var fx = x + (k - 1) * 12, fy = y + ((k % 2) ? 6 : 0);
        ctx.fillStyle = cols[((seed * 10 + k) | 0) % cols.length];
        for (var q = 0; q < 5; q++) { var an = q / 5 * 6.283; ctx.beginPath(); ctx.arc(fx + Math.cos(an) * 4, fy + Math.sin(an) * 4, 3, 0, 7); ctx.fill(); }
        ctx.fillStyle = "#fff6c0"; ctx.beginPath(); ctx.arc(fx, fy, 2.5, 0, 7); ctx.fill();
      }
    }
  }

  function drawKartAndChild() {
    var kx = g.kartX, ky = g.kartY, kw = g.kartW, kh = g.kartH;
    var bob = Math.sin(g.bob * 6) * 1.2; // 살짝 흔들리는 주행감
    // 바닥 접지 그림자
    ctx.fillStyle = "rgba(0,0,0,.22)";
    ctx.beginPath(); ctx.ellipse(kx + kw / 2, ky + kh - 3, kw * 0.36, 8, 0, 0, 7); ctx.fill();
    // 누끼 카트
    if (kartImg) ctx.drawImage(kartImg, kx, ky + bob, kw, kh);
    // 좌석에 앉은 아이: 접지 그림자 → 몸통 → 머리
    var ax = kx + kw * 0.5, ay = ky + kh * 0.31 + bob, ar = kw * 0.145;
    // 좌석 위 접지 그림자
    ctx.fillStyle = "rgba(0,0,0,.13)";
    ctx.beginPath(); ctx.ellipse(ax, ay + ar * 1.35, ar * 1.0, ar * 0.34, 0, 0, 7); ctx.fill();
    // 몸통/어깨(레이싱 로퍼)
    ctx.save();
    ctx.fillStyle = "#6d5cff"; ctx.strokeStyle = "rgba(0,0,0,.12)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(ax, ay + ar * 1.18, ar * 1.02, ar * 0.72, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.18)";
    ctx.beginPath(); ctx.ellipse(ax, ay + ar * 0.98, ar * 0.68, ar * 0.26, 0, 0, 7); ctx.fill();
    ctx.restore();
    // 머리(아바타) — 부드러운 그림자 + 원형 클립 + 얇은 흰 링
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.20)"; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1;
    ctx.beginPath(); ctx.arc(ax, ay, ar, 0, 7); ctx.fillStyle = "#fff"; ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.arc(ax, ay, ar, 0, 7); ctx.clip();
    if (avatarImg) {
      var s = Math.max((2 * ar) / avatarImg.width, (2 * ar) / avatarImg.height);
      ctx.drawImage(avatarImg, ax - avatarImg.width * s / 2, ay - avatarImg.height * s / 2, avatarImg.width * s, avatarImg.height * s);
    } else { ctx.fillStyle = "#c9ccd2"; ctx.fillRect(ax - ar, ay - ar, 2 * ar, 2 * ar); }
    ctx.restore();
    ctx.lineWidth = Math.max(1.5, ar * 0.09); ctx.strokeStyle = "#fff";
    ctx.beginPath(); ctx.arc(ax, ay, ar, 0, 7); ctx.stroke();
  }

  function updateHud() {
    var t = $("#kr-time"), s = $("#kr-score"), l = $("#kr-lives");
    if (t) t.textContent = Math.ceil(g.time);
    if (s) s.textContent = g.score;
    if (l) l.textContent = g.lives > 0 ? "❤️".repeat(g.lives) : "💔";
  }

  /* ---------------- 컨트롤 ---------------- */
  function setDir(d) { dir = d; }
  function bindHold(el, d) {
    if (!el) return;
    var down = function (e) { e.preventDefault(); setDir(d); };
    var up = function () { if (dir === d) setDir(0); };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointerleave", up);
    el.addEventListener("pointercancel", up);
  }
  function bindCanvasTouch() {
    if (!cv) cv = $("#kr-canvas"); if (!cv) return;
    var move = function (e) {
      if (!running) return;
      var rect = cv.getBoundingClientRect();
      var x = (e.clientX != null ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0)) - rect.left;
      setDir(x < rect.width / 2 ? -1 : 1);
    };
    cv.addEventListener("pointerdown", function (e) { e.preventDefault(); move(e); });
    cv.addEventListener("pointermove", function (e) { if (e.buttons) move(e); });
    cv.addEventListener("pointerup", function () { setDir(0); });
    cv.addEventListener("pointerleave", function () { setDir(0); });
  }

  function bind() {
    $("#btn-kart-game") && ($("#btn-kart-game").onclick = open);
    $("#kr-back") && ($("#kr-back").onclick = backToList);
    $("#kr-start") && ($("#kr-start").onclick = startPlay);
    $("#kr-again") && ($("#kr-again").onclick = startPlay);
    $("#kr-tolist") && ($("#kr-tolist").onclick = backToList);
    bindHold($("#kr-left"), -1);
    bindHold($("#kr-right"), 1);
    bindCanvasTouch();
    document.addEventListener("keydown", function (e) {
      if (!running) return;
      if (e.key === "ArrowLeft") setDir(-1);
      else if (e.key === "ArrowRight") setDir(1);
    });
    document.addEventListener("keyup", function (e) {
      if (e.key === "ArrowLeft" && dir === -1) setDir(0);
      else if (e.key === "ArrowRight" && dir === 1) setDir(0);
    });
    window.addEventListener("resize", function () { if (running) sizeCanvas(); });
  }

  window.KartGame = { open: open, renderShop: renderPinpin };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
