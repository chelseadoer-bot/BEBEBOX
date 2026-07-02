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
    if (cleared) { if (t) t.textContent = "완주 성공!"; if (e) e.textContent = "🏆"; if (sub) sub.textContent = babyName() + "가 끝까지 달렸어요!"; }
    else { if (t) t.textContent = "게임 오버"; if (e) e.textContent = "💥"; if (sub) sub.textContent = "별을 더 모아 최고 점수에 도전해요!"; }
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
    // 잔디 배경
    ctx.fillStyle = "#8fd18a"; ctx.fillRect(0, 0, W, H);
    // 도로
    ctx.fillStyle = "#5b6472"; ctx.fillRect(rd.x, 0, rd.w, H);
    ctx.fillStyle = "#e9edf2"; ctx.fillRect(rd.x - 5, 0, 5, H); ctx.fillRect(rd.x + rd.w, 0, 5, H);
    // 차선(점선, 스크롤)
    ctx.fillStyle = "rgba(255,255,255,.85)";
    var cx = rd.x + rd.w / 2 - 3;
    for (var y = -60 + g.laneOffset; y < H; y += 60) ctx.fillRect(cx, y, 6, 34);
    // 장애물/별
    for (var i = 0; i < g.obstacles.length; i++) {
      var o = g.obstacles[i];
      ctx.font = (o.r * 2) + "px serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(o.star ? "⭐" : "🚧", o.x, o.y);
    }
    // 카트 + 아기
    var blink = g.invuln > 0 && (Math.floor(g.invuln * 12) % 2 === 0);
    if (!blink) {
      // 그림자
      ctx.fillStyle = "rgba(0,0,0,.18)";
      ctx.beginPath();
      ctx.ellipse(g.kartX + g.kartW / 2, g.kartY + g.kartH - 6, g.kartW * 0.34, 8, 0, 0, 7);
      ctx.fill();
      if (kartImg) ctx.drawImage(kartImg, g.kartX, g.kartY, g.kartW, g.kartH);
      // 아기 아바타 (좌석 위, 원형)
      var ax = g.kartX + g.kartW * 0.52, ay = g.kartY + g.kartH * 0.40, ar = g.kartW * 0.17;
      ctx.save();
      ctx.beginPath(); ctx.arc(ax, ay, ar, 0, 7); ctx.closePath();
      ctx.fillStyle = "#fff"; ctx.fill();
      ctx.save(); ctx.clip();
      if (avatarImg) {
        var s = Math.max((2 * ar) / avatarImg.width, (2 * ar) / avatarImg.height);
        ctx.drawImage(avatarImg, ax - avatarImg.width * s / 2, ay - avatarImg.height * s / 2, avatarImg.width * s, avatarImg.height * s);
      } else { ctx.fillStyle = "#c9ccd2"; ctx.fillRect(ax - ar, ay - ar, 2 * ar, 2 * ar); }
      ctx.restore();
      ctx.lineWidth = 3; ctx.strokeStyle = "#fff"; ctx.beginPath(); ctx.arc(ax, ay, ar, 0, 7); ctx.stroke();
      ctx.restore();
    }
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

  window.KartGame = { open: open };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
