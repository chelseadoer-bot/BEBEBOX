/**
 * KIDIKIDI 미니앱 공용 프론트 런타임 (15개 앱 동일 규격)
 * - uid 해석: URL ?uid= → 부모(postMessage) → localStorage 게스트
 * - 표준 API 래퍼: run / records / record
 * - 표준 "기존 결과물 보기" 버튼 + 모달
 */
(function (global) {
  var KD = {};

  // ── uid ────────────────────────────────────────────
  function genGuest() {
    return 'guest_' + Math.random().toString(36).slice(2, 14);
  }
  KD.uid = function () {
    if (KD._uid) return KD._uid;
    var q = new URLSearchParams(location.search);
    var u = q.get('uid');
    if (!u) {
      try {
        u = localStorage.getItem('kd_uid');
      } catch (e) {}
    }
    if (!u) {
      u = genGuest();
      try { localStorage.setItem('kd_uid', u); } catch (e) {}
    }
    KD._uid = u;
    return u;
  };
  // 부모(베베박스) 앱에서 uid 주입 가능
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'kidikidi-set-uid' && e.data.uid) {
      KD._uid = String(e.data.uid);
      try { localStorage.setItem('kd_uid', KD._uid); } catch (err) {}
    }
  });
  // URL ?uid= 핸드오프(허브/베베박스) → 자동 로그인 세션으로 인정
  // (게스트 uid 는 로그인으로 보지 않음 → 로그인 게이트 동작)
  (function () {
    try {
      var u = new URLSearchParams(location.search).get('uid');
      if (u && u.indexOf('guest_') !== 0) {
        localStorage.setItem('kd_user', u);
        localStorage.setItem('kd_uid', u);
        KD._uid = u;
      }
    } catch (e) {}
  })();

  // ── API ────────────────────────────────────────────
  KD.run = async function (inputs) {
    var resp = await fetch('api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: KD.uid(), inputs: inputs }),
    });
    var json = await resp.json();
    if (!resp.ok || json.ok === false) {
      throw new Error((json && json.error) || ('API ' + resp.status));
    }
    return json; // {ok, uid, record_id, output, media, from_cache}
  };
  KD.records = async function () {
    var resp = await fetch('api/records?uid=' + encodeURIComponent(KD.uid()));
    var json = await resp.json();
    return (json && json.records) || [];
  };
  KD.record = async function (id) {
    var resp = await fetch('api/records/' + id + '?uid=' + encodeURIComponent(KD.uid()));
    var json = await resp.json();
    return json && json.record;
  };
  KD.meta = async function () {
    try { return await (await fetch('api/meta')).json(); } catch (e) { return {}; }
  };

  // ── 기존 결과물 보기 (표준 버튼 + 모달) ─────────────
  var CSS =
    '.kd-hist-btn{display:flex;align-items:center;justify-content:center;gap:7px;width:calc(100% - 40px);margin:0 20px 18px;padding:14px;border:1px solid var(--border,#DBEAFE);border-radius:12px;background:#fff;color:var(--ink2,#475569);font-family:inherit;font-size:14px;font-weight:800;cursor:pointer;transition:all .18s;}' +
    '.kd-hist-btn:hover{border-color:var(--brand,#4A90E2);color:var(--brand-d,#2563EB);}' +
    '.kd-modal{position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:10000;display:none;align-items:flex-end;justify-content:center;}' +
    '.kd-modal.on{display:flex;}' +
    '.kd-sheet{background:#fff;width:100%;max-width:480px;max-height:86vh;border-radius:20px 20px 0 0;display:flex;flex-direction:column;overflow:hidden;animation:kdUp .25s ease;}' +
    '@keyframes kdUp{from{transform:translateY(40px);opacity:.6;}to{transform:none;opacity:1;}}' +
    '.kd-sheet-top{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--border,#eee);}' +
    '.kd-sheet-top b{font-size:15px;font-weight:800;color:var(--ink,#1E293B);}' +
    '.kd-x{border:none;background:#f1f5f9;width:30px;height:30px;border-radius:50%;font-size:16px;cursor:pointer;color:#475569;}' +
    '.kd-sheet-body{overflow-y:auto;padding:14px 16px 28px;}' +
    '.kd-rec{border:1px solid var(--border,#eee);border-radius:14px;padding:14px;margin-bottom:10px;cursor:pointer;transition:all .15s;background:#fff;}' +
    '.kd-rec:hover{border-color:var(--brand,#4A90E2);background:var(--brand-l,#EFF6FF);}' +
    '.kd-rec .d{font-size:11px;font-weight:800;color:var(--ink3,#64748B);margin-bottom:4px;}' +
    '.kd-rec .t{font-size:14px;font-weight:700;color:var(--ink,#1E293B);}' +
    '.kd-empty{text-align:center;color:var(--ink3,#64748B);font-size:13px;font-weight:700;padding:40px 0;}' +
    '.kd-back{border:none;background:#f1f5f9;color:#475569;font-weight:800;font-size:13px;border-radius:10px;padding:8px 14px;cursor:pointer;margin-bottom:12px;}' +
    '.kd-save-btn{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;margin-top:14px;padding:14px;border:none;border-radius:12px;background:var(--brand,#4A90E2);color:#fff;font-family:inherit;font-size:14px;font-weight:800;cursor:pointer;}' +
    '.kd-save-btn:active{opacity:.85;}' +
    '.kd-auth{position:fixed;top:12px;right:12px;z-index:9998;}' +
    '.kd-auth-btn{display:flex;align-items:center;gap:6px;background:#fff;border:1px solid var(--border,#DBEAFE);border-radius:30px;padding:7px 13px;font-family:inherit;font-size:12px;font-weight:800;color:var(--ink2,#475569);cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.10);}' +
    '.kd-auth-btn b{color:var(--brand-d,#2563EB);}' +
    '.kd-auth-form{display:flex;flex-direction:column;gap:10px;padding:6px 2px 4px;}' +
    '.kd-auth-form input{padding:12px 14px;border:1px solid var(--border,#DBEAFE);border-radius:10px;font-family:inherit;font-size:14px;outline:none;}' +
    '.kd-auth-tabs{display:flex;gap:8px;margin-bottom:6px;}' +
    '.kd-auth-tab{flex:1;padding:9px;border:1px solid var(--border,#DBEAFE);border-radius:10px;background:#fff;font-family:inherit;font-weight:800;font-size:13px;color:var(--ink3,#64748B);cursor:pointer;}' +
    '.kd-auth-tab.on{background:var(--brand,#4A90E2);color:#fff;border-color:var(--brand,#4A90E2);}' +
    '.kd-auth-go{padding:13px;border:none;border-radius:12px;background:var(--brand,#4A90E2);color:#fff;font-family:inherit;font-weight:800;font-size:15px;cursor:pointer;}' +
    '.kd-auth-msg{font-size:12px;font-weight:700;color:#EF4444;min-height:16px;text-align:center;}';

  function injectCss() {
    if (document.getElementById('kd-app-css')) return;
    var s = document.createElement('style');
    s.id = 'kd-app-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function fmtDate(iso) {
    try {
      var d = new Date(iso);
      return d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate() + ' ' +
        ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    } catch (e) { return iso || ''; }
  }

  /**
   * 표준 "기존 결과물 보기" 마운트
   * @param {Object} opts
   *  - mountTarget: 버튼을 삽입할 엘리먼트 (기본: body 최상단 영역)
   *  - label: 레코드 한 줄 요약 함수 (record)=>string
   *  - renderRecord: (record, container)=>void  결과 상세 렌더 (앱 OUTPUT UX 재사용)
   */
  KD.mountHistory = function (opts) {
    opts = opts || {};
    injectCss();

    var btn = document.createElement('button');
    btn.className = 'kd-hist-btn';
    btn.type = 'button';
    btn.innerHTML = '\u23F0 기존 결과물 보기';

    var modal = document.createElement('div');
    modal.className = 'kd-modal';
    modal.innerHTML =
      '<div class="kd-sheet">' +
      '<div class="kd-sheet-top"><b>기존 결과물</b><button class="kd-x" type="button">\u00D7</button></div>' +
      '<div class="kd-sheet-body" id="kd-sheet-body"></div></div>';
    document.body.appendChild(modal);

    var body = modal.querySelector('#kd-sheet-body');
    function close() { modal.classList.remove('on'); }
    modal.querySelector('.kd-x').onclick = close;
    modal.onclick = function (e) { if (e.target === modal) close(); };

    async function openList() {
      modal.classList.add('on');
      body.innerHTML = '<div class="kd-empty">불러오는 중...</div>';
      var recs = await KD.records();
      if (!recs.length) {
        body.innerHTML = '<div class="kd-empty">아직 저장된 결과물이 없어요.</div>';
        return;
      }
      body.innerHTML = '';
      recs.forEach(function (r) {
        var card = document.createElement('div');
        card.className = 'kd-rec';
        var title = opts.label ? opts.label(r) : '결과 #' + r.id;
        card.innerHTML = '<div class="d">' + fmtDate(r.created_at) + '</div><div class="t">' +
          String(title).replace(/</g, '&lt;') + '</div>';
        card.onclick = function () { openDetail(r); };
        body.appendChild(card);
      });
    }

    async function openDetail(rec) {
      body.innerHTML = '<div class="kd-empty">불러오는 중...</div>';
      var full = await KD.record(rec.id) || rec;
      body.innerHTML = '';
      var back = document.createElement('button');
      back.className = 'kd-back';
      back.type = 'button';
      back.innerHTML = '\u2190 목록';
      back.onclick = openList;
      body.appendChild(back);
      var container = document.createElement('div');
      body.appendChild(container);
      if (opts.renderRecord) opts.renderRecord(full, container);
      else container.textContent = JSON.stringify(full.output);

      // 모든 앱 공통: 결과 상세 하단에 "이미지로 저장" (스크린샷) 버튼
      if (opts.screenshot !== false) {
        var saveBtn = document.createElement('button');
        saveBtn.className = 'kd-save-btn';
        saveBtn.type = 'button';
        saveBtn.innerHTML = '\uD83D\uDCF8 이미지로 저장';
        saveBtn.onclick = function () {
          if (typeof opts.captureRecord === 'function') {
            opts.captureRecord(full, container);
          } else {
            KD.copyShot({ target: container, bg: '#ffffff', filename: (opts.shotName || 'kidikidi-result') + '.png' });
          }
        };
        body.appendChild(saveBtn);
      }
    }

    btn.onclick = openList;
    KD.openHistory = openList;

    // 허브 임베드 딥링크: ?kdview=1 → 기존 결과물 목록 자동 오픈
    try { if (new URLSearchParams(location.search).get('kdview')) setTimeout(openList, 80); } catch (e) {}

    if (opts.mountTarget) {
      opts.mountTarget.appendChild(btn);
    } else {
      var app = document.querySelector('.app') || document.body;
      app.appendChild(btn);
    }
    return btn;
  };

  // ── 결과 화면 스크린샷 → 이미지로 클립보드 복사 ───────
  // html2canvas 지연 로드 (CDN, 1회 캐시)
  KD._loadH2C = function () {
    if (global.html2canvas) return Promise.resolve();
    if (KD._h2cP) return KD._h2cP;
    KD._h2cP = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('html2canvas load failed')); };
      document.head.appendChild(s);
    });
    return KD._h2cP;
  };

  // 자체 토스트 (앱 토스트가 없을 때 사용)
  KD.toast = function (msg) {
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText =
      'position:fixed;left:50%;bottom:32px;transform:translateX(-50%);' +
      'background:rgba(15,23,42,.92);color:#fff;font-size:13px;font-weight:800;' +
      'padding:11px 18px;border-radius:12px;z-index:10001;font-family:inherit;' +
      'box-shadow:0 6px 20px rgba(0,0,0,.25);max-width:88vw;text-align:center;';
    document.body.appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; }, 1500);
    setTimeout(function () { t.remove(); }, 1850);
  };

  /**
   * 결과 화면을 모바일 스크린샷으로 캡처해 클립보드에 "이미지"로 복사.
   * (클립보드 이미지 미지원 환경에서는 PNG 다운로드로 자동 폴백)
   * @param {Object} opts
   *  - target  : 캡처 대상(선택자 문자열/Element). 기본: #result-wrap → .result-content → .app → body
   *  - hide    : 캡처 중 숨길 선택자(기본: 공유/이력 버튼 영역)
   *  - bg      : 배경색(기본: 대상 배경 또는 흰색)
   *  - filename: 폴백 다운로드 파일명
   *  - toast   : 완료 메시지 함수(기본: 내장 토스트)
   */
  KD.copyShot = async function (opts) {
    opts = opts || {};
    var target = opts.target;
    if (typeof target === 'string') target = document.querySelector(target);
    target = target ||
      document.getElementById('result-wrap') ||
      document.querySelector('.result-content') ||
      document.querySelector('.app') ||
      document.body;
    var toast = opts.toast || KD.toast;
    var hideSel = opts.hide || '.share-row, .kd-hist-btn, .preview-footer, .btn-group';
    var restore = [];
    try {
      toast('이미지 만드는 중...');
      await KD._loadH2C();
      var hideEls = target.querySelectorAll ? target.querySelectorAll(hideSel) : [];
      Array.prototype.forEach.call(hideEls, function (el) {
        restore.push([el, el.style.visibility]);
        el.style.visibility = 'hidden';
      });
      var bg = opts.bg;
      if (!bg) {
        try { bg = getComputedStyle(target).backgroundColor; } catch (e) {}
        if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') {
          try { bg = getComputedStyle(document.body).backgroundColor; } catch (e) {}
        }
        if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') bg = '#ffffff';
      }
      var canvas = await global.html2canvas(target, {
        backgroundColor: bg, scale: 2, useCORS: true, logging: false,
      });
      restore.forEach(function (r) { r[0].style.visibility = r[1]; });
      restore = [];
      var blob = await new Promise(function (res) { canvas.toBlob(res, 'image/png'); });
      try {
        if (!global.ClipboardItem || !navigator.clipboard || !navigator.clipboard.write) {
          throw new Error('clipboard image unsupported');
        }
        await navigator.clipboard.write([new global.ClipboardItem({ 'image/png': blob })]);
        toast('이미지로 복사됐어요! 📋');
      } catch (e) {
        var a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = opts.filename || 'kidikidi_result.png';
        a.click();
        toast('이미지로 저장했어요! 💾');
      }
    } catch (err) {
      restore.forEach(function (r) { r[0].style.visibility = r[1]; });
      toast('이미지 복사에 실패했어요 😢');
    }
  };

  /**
   * 여러 연령 이미지를 하나의 세로 카드로 합성해 스크린샷 저장/복사.
   * (미래 얼굴 예측: 3·5·8·12·18세 전체를 한 장으로)
   * @param {Object} opts - images:{age:src}, ages:[..], title, subtitle, filename, toast
   */
  KD.copyAgesShot = async function (opts) {
    opts = opts || {};
    var images = opts.images || {};
    var ages = opts.ages && opts.ages.length ? opts.ages : Object.keys(images)
      .map(function (k) { return parseInt(k, 10); })
      .filter(function (n) { return !isNaN(n); })
      .sort(function (a, b) { return a - b; });
    var toast = opts.toast || KD.toast;
    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;left:-10000px;top:0;width:420px;background:#fff;padding:22px;box-sizing:border-box;font-family:inherit;color:#1E293B;';
    var html = '<div style="text-align:center;font-weight:800;font-size:18px;margin-bottom:4px;">' + (opts.title || '결과 모음') + '</div>';
    if (opts.subtitle) html += '<div style="text-align:center;font-size:13px;color:#64748B;margin-bottom:16px;">' + opts.subtitle + '</div>';
    html += '<div style="display:flex;flex-direction:column;gap:16px;margin-top:12px;">';
    ages.forEach(function (age) {
      var src = images[String(age)] || images[age];
      if (!src) return;
      html += '<div style="text-align:center;"><div style="font-weight:800;font-size:14px;color:#FF7043;margin-bottom:6px;">' + age + '세</div>'
        + '<img src="' + src + '" style="width:100%;border-radius:14px;display:block;"></div>';
    });
    html += '</div><div style="text-align:center;font-size:11px;color:#94A3B8;margin-top:16px;">키디키디 · KIDIKIDI</div>';
    wrap.innerHTML = html;
    document.body.appendChild(wrap);
    try {
      var imgs = wrap.querySelectorAll('img');
      await Promise.all(Array.prototype.map.call(imgs, function (im) {
        return im.complete ? Promise.resolve() : new Promise(function (r) { im.onload = im.onerror = r; });
      }));
    } catch (e) {}
    try {
      await KD.copyShot({ target: wrap, bg: '#ffffff', filename: opts.filename || 'kidikidi-ages.png', toast: toast });
    } finally {
      wrap.remove();
    }
  };

  // ── 간이 로그인 / 회원가입 (현재 버전 임시; 추후 베베박스 uid 연동으로 대체) ──
  // 회원 자격증명은 로컬에 보관(간이). 로그인 시 uid = 회원 아이디로 설정되어
  // 회원별로 결과/이용이력이 적치된다. 기본 계정: test / test
  function getAccts() {
    var a = {};
    try { a = JSON.parse(localStorage.getItem('kd_accounts') || '{}'); } catch (e) {}
    if (!a.test) { a.test = 'test'; try { localStorage.setItem('kd_accounts', JSON.stringify(a)); } catch (e2) {} }
    return a;
  }
  KD.user = function () {
    try { return localStorage.getItem('kd_user') || null; } catch (e) { return null; }
  };
  KD.login = function (id, pw) {
    id = (id || '').trim();
    var accts = getAccts();
    if (!id || accts[id] === undefined || accts[id] !== pw) return false;
    try { localStorage.setItem('kd_user', id); localStorage.setItem('kd_uid', id); } catch (e) {}
    KD._uid = id;
    return true;
  };
  KD.signup = function (id, pw) {
    id = (id || '').trim();
    if (!id || !pw) return { ok: false, error: '아이디와 비밀번호를 입력하세요.' };
    var accts = getAccts();
    if (accts[id] !== undefined) return { ok: false, error: '이미 존재하는 아이디예요.' };
    accts[id] = pw;
    try { localStorage.setItem('kd_accounts', JSON.stringify(accts)); } catch (e) {}
    KD.login(id, pw);
    return { ok: true };
  };
  KD.logout = function () {
    var g = 'guest_' + Math.random().toString(36).slice(2, 14);
    try { localStorage.removeItem('kd_user'); localStorage.setItem('kd_uid', g); } catch (e) {}
    KD._uid = g;
  };

  KD.mountAuth = function () {
    if (document.getElementById('kd-auth-root')) return;
    injectCss();
    var root = document.createElement('div');
    root.className = 'kd-auth';
    root.id = 'kd-auth-root';
    document.body.appendChild(root);

    var modal = document.createElement('div');
    modal.className = 'kd-modal';
    modal.innerHTML =
      '<div class="kd-sheet">' +
      '<div class="kd-sheet-top"><b id="kd-auth-title">로그인 / 회원가입</b><button class="kd-x" type="button">\u00D7</button></div>' +
      '<div class="kd-sheet-body">' +
      '<div class="kd-auth-tabs"><button class="kd-auth-tab on" data-m="login">로그인</button><button class="kd-auth-tab" data-m="signup">회원가입</button></div>' +
      '<div class="kd-auth-form">' +
      '<input id="kd-auth-id" type="text" placeholder="아이디" autocomplete="username">' +
      '<input id="kd-auth-pw" type="password" placeholder="비밀번호" autocomplete="current-password">' +
      '<div class="kd-auth-msg" id="kd-auth-msg"></div>' +
      '<button class="kd-auth-go" id="kd-auth-go">로그인</button>' +
      '<div style="font-size:11px;color:#94A3B8;text-align:center;margin-top:2px;">체험 계정 : test / test</div>' +
      '</div></div></div>';
    document.body.appendChild(modal);

    var mode = 'login';
    var blocking = false;
    var msg = modal.querySelector('#kd-auth-msg');
    var titleEl = modal.querySelector('#kd-auth-title');
    var xBtn = modal.querySelector('.kd-x');
    function close() { if (blocking) return; modal.classList.remove('on'); }
    xBtn.onclick = close;
    modal.onclick = function (e) { if (e.target === modal) close(); };
    modal.querySelectorAll('.kd-auth-tab').forEach(function (t) {
      t.onclick = function () {
        mode = t.getAttribute('data-m');
        modal.querySelectorAll('.kd-auth-tab').forEach(function (x) { x.classList.remove('on'); });
        t.classList.add('on');
        modal.querySelector('#kd-auth-go').textContent = mode === 'login' ? '로그인' : '가입하고 시작하기';
        msg.textContent = '';
      };
    });
    modal.querySelector('#kd-auth-go').onclick = function () {
      var id = modal.querySelector('#kd-auth-id').value;
      var pw = modal.querySelector('#kd-auth-pw').value;
      var ok = false;
      if (mode === 'login') {
        ok = KD.login(id, pw);
        if (!ok) { msg.style.color = '#EF4444'; msg.textContent = '아이디 또는 비밀번호가 올바르지 않아요.'; }
      } else {
        var r = KD.signup(id, pw);
        ok = r.ok;
        if (!ok) { msg.style.color = '#EF4444'; msg.textContent = r.error; }
      }
      if (ok) {
        var wasBlocking = blocking; blocking = false;
        if (wasBlocking) { location.reload(); return; }  // 게이트 통과 → 회원 세션으로 재시작
        close(); render();
        KD.toast(mode === 'login' ? '로그인됐어요! 👋' : '가입 완료! 환영해요 🎉');
        if (typeof KD.onAuth === 'function') KD.onAuth();
      }
    };

    function open(opts) {
      opts = (opts && opts.blocking) ? opts : (opts === true ? { blocking: true } : {});
      blocking = !!opts.blocking;
      titleEl.textContent = blocking ? '로그인이 필요해요' : '로그인 / 회원가입';
      xBtn.style.display = blocking ? 'none' : '';
      msg.textContent = blocking ? '15개 미니앱은 로그인 후 이용할 수 있어요.' : '';
      msg.style.color = blocking ? '#64748B' : '#EF4444';
      modal.querySelector('#kd-auth-id').value = '';
      modal.querySelector('#kd-auth-pw').value = '';
      modal.classList.add('on');
    }
    KD.openAuth = open;

    function render() {
      var u = KD.user();
      root.innerHTML = '';
      var btn = document.createElement('button');
      btn.className = 'kd-auth-btn';
      btn.type = 'button';
      if (u) {
        btn.innerHTML = '\uD83D\uDC64 <b>' + u + '</b> 님 · 로그아웃';
        btn.onclick = function () { KD.logout(); render(); KD.toast('로그아웃됐어요.'); if (typeof KD.onAuth === 'function') KD.onAuth(); };
      } else {
        btn.innerHTML = '\uD83D\uDC64 로그인 / 회원가입';
        btn.onclick = open;
      }
      root.appendChild(btn);
    }
    render();
    KD._renderAuth = render;
  };

  // 로그인 게이트: 미로그인 시 차단 모달을 띄워 앱 사용을 막는다.
  KD.gate = function () {
    if (KD.user()) return true;
    KD.mountAuth();
    if (KD.openAuth) KD.openAuth({ blocking: true });
    return false;
  };

  // 모든 앱에 자동으로 로그인 위젯 부착 + 로그인 게이트 적용
  //  - data-no-auth="1" : 위젯/게이트 모두 생략
  //  - data-no-gate="1" : 위젯은 띄우되 게이트는 적용 안 함(허브 런처용)
  function autoMountAuth() {
    var html = document.documentElement;
    if (html.getAttribute('data-no-auth') === '1') return;
    // 허브 임베드(?kdview=1)는 결과만 표시 → 위젯/게이트 생략
    try { if (new URLSearchParams(location.search).get('kdview')) return; } catch (e) {}
    KD.mountAuth();
    if (html.getAttribute('data-no-gate') !== '1' && !KD.user()) {
      KD.gate();
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMountAuth);
  } else {
    autoMountAuth();
  }

  global.KD = KD;
})(window);
