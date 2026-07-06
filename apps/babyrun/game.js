/* ==========================================================
   핀핀 정글 등원 대작전 v2 — FUN OVERHAUL
   시바견 × FINFIN 밸런스바이크 × 호랑이 추격 러닝 게임
   슬라이드 · 패턴 스포너 · 콤보/피버 · 파워업 · 스테이지 ·
   부활 · 도전과제 · 니어미스 · 일시정지 · 공유
   ========================================================== */
(() => {
'use strict';

// ---------- DOM ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);
const ui = {
  hud: $('hud'), score: $('score'), bones: $('bones'), combo: $('combo'),
  tigerFill: $('tigerbar-fill'), tigerIcon: $('tigerIcon'), tigerWrap: $('tigerbar-wrap'),
  feverFill: $('feverbar-fill'),
  feverWrap: $('feverbar-wrap'), effects: $('effects'), toast: $('toast'),
  pauseBtn: $('pauseBtn'), zones: $('zones'),
  start: $('start'), startBtn: $('startBtn'), posterVideo: $('posterVideo'),
  titleMeta: $('titleMeta'), achBtn: $('achBtn'), muteBtn: $('muteBtn'),
  intro: $('intro'), introVideo: $('introVideo'), skipBtn: $('skipBtn'),
  countdown: $('countdown'), countNum: $('countNum'),
  gameover: $('gameover'), goScore: $('goScore'), goBones: $('goBones'),
  goBest: $('goBest'), goCombo: $('goCombo'), goFever: $('goFever'),
  goNew: $('goNew'), goAch: $('goAch'), retryBtn: $('retryBtn'), introBtn: $('introBtn'),
  shareBtn: $('shareBtn'), goAchBtn: $('goAchBtn'),
  pause: $('pause'), resumeBtn: $('resumeBtn'), quitBtn: $('quitBtn'), pMuteBtn: $('pMuteBtn'),
  revive: $('revive'), reviveBtn: $('reviveBtn'), reviveCnt: $('reviveCnt'), reviveSkip: $('reviveSkip'),
  achPanel: $('achPanel'), achList: $('achList'), achClose: $('achClose'),
  event: $('event'), garage: $('garage'), garageBtn: $('garageBtn'),
  bikeList: $('bikeList'), garageClose: $('garageClose'),
  ending: $('ending'), endRestartBtn: $('endRestartBtn'), endShareBtn: $('endShareBtn'),
  contBtn: $('contBtn'), journeyFill: $('journey-fill'),
};

// ---------- 저장 ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};
let best = store.get('finfin_best', 0);
let totals = store.get('finfin_tot', { runs: 0, bones: 0, slides: 0 });
let achState = store.get('finfin_ach', {});
let muted = store.get('finfin_mute', false);

// ---------- 외부 연동 브리지 (커뮤니티 앱 통합용) ----------
// 게임 이벤트를 CustomEvent('finfin:*') + parent postMessage 로 발행.
// 로그인/보상/분석 연동은 이 이벤트를 구독하면 됨 (docs/INTEGRATION.md 참조).
const Bridge = {
  emit(type, detail) {
    try {
      const payload = Object.assign({ game: 'finfin-runner', type, ts: Date.now() }, detail || {});
      window.dispatchEvent(new CustomEvent('finfin:' + type, { detail: payload }));
      if (window.parent && window.parent !== window) window.parent.postMessage(payload, '*');
      if (typeof window.FinFinGameCallback === 'function') window.FinFinGameCallback(payload);
    } catch (e) {}
  },
};
window.FinFinGame = {
  version: 11,
  config: { user: null },   // 커뮤니티 앱이 로그인 유저 컨텍스트 주입 가능
  getState() {
    return {
      state, best,
      distance: G.worldX ? Math.floor(G.worldX) : 0,
      stage: G.stage || 0,
      bones: G.bonesCnt || 0,
    };
  },
};

// ---------- 에셋 ----------
const IMG_SRC = {
  shiba1: 'assets/sprites/shiba_1.png',
  shiba2: 'assets/sprites/shiba_2.png',
  shiba3: 'assets/sprites/shiba_3.png',
  shiba4: 'assets/sprites/shiba_4.png',
  shibaSlide: 'assets/sprites/shiba_slide.png',
  tiger1: 'assets/sprites/tiger_1.png',
  tiger2: 'assets/sprites/tiger_2.png',
  tiger3: 'assets/sprites/tiger_3.png',
  tiger4: 'assets/sprites/tiger_4.png',
  rock:  'assets/sprites/obs_1.png',
  log:   'assets/sprites/obs_2.png',
  plant: 'assets/sprites/obs_3.png',
  bone:  'assets/sprites/obs_4.png',
  branch:'assets/sprites/obs_branch.png',
  toucan1:'assets/sprites/toucan_1.png',
  toucan2:'assets/sprites/toucan_2.png',
  powHelmet:'assets/sprites/pow_1.png',
  powMagnet:'assets/sprites/pow_2.png',
  powBoost:'assets/sprites/pow_3.png',
  powGold:'assets/sprites/pow_4.png',
  snake1:'assets/sprites/snake_1.png',
  snake2:'assets/sprites/snake_2.png',
  monkey:'assets/sprites/monkey.png',
  crab:  'assets/sprites/obsA_1.png',
  cactus:'assets/sprites/obsA_2.png',
  frog:  'assets/sprites/obsA_3.png',
  hedge: 'assets/sprites/obsA_4.png',
  scarecrow:'assets/sprites/obsB_1.png',
  cone:  'assets/sprites/obsB_2.png',
  trashcan:'assets/sprites/obsB_3.png',
  lantern:'assets/sprites/obsB_4.png',
  faceShiba:'assets/sprites/face_shiba.png',
  faceTiger:'assets/sprites/face_tiger.png',
  ground:'assets/sprites/ground.png',
  bg:    'assets/sprites/bg_jungle.jpg',
  bgSunset:'assets/sprites/bg_sunset.jpg',
  bgNight:'assets/sprites/bg_night.jpg',
  bgRiver:'assets/sprites/bg_river.jpg',
  bgBeach:'assets/sprites/bg_beach.jpg',
  bgBamboo:'assets/sprites/bg_bamboo.jpg',
  bgVillage:'assets/sprites/bg_village.jpg',
  bgCanyon:'assets/sprites/bg_canyon.jpg',
  bgCity:'assets/sprites/bg_city.jpg',
  bgKinder:'assets/sprites/bg_kinder.jpg',
};

// ---------- 10 스테이지 여정 (등원길: 정글 → 유치원) ----------
const STAGE_LEN = 1000;          // 스테이지당 미터
const TOTAL_M = 10000;           // 완주 거리 (10 스테이지)
// 각 스테이지는 2~3종의 전용 장애물을 독점 배치 (다양성 + 스테이지 정체성)
const STAGES = [
  { name: '아침 정글',   icon: '🌿', bg: 'bg',        tint: null,                      amb: 'leaf',
    set: ['rock','log','plant','branch','snake','stomp','spring_fun','bones_line','bones_arc','pow','gold','hole','double_obs','snake_branch','jump_slide'] },
  { name: '폭포 강가',   icon: '💧', bg: 'bgRiver',   tint: 'rgba(120,200,255,0.07)',  amb: 'mist',
    set: ['log','hole','mud','toucan','frog','geyser','bones_arc','bones_line','pow','gold','arc_hole','mud_rock','slide_jump','double_hole','long_hole'] },
  { name: '반짝 해변',   icon: '🏖️', bg: 'bgBeach',   tint: 'rgba(255,230,150,0.08)',  amb: 'mist',
    set: ['rock','boulder','hole','mud','bees','crab','ball','bones_line','bones_arc','pow','gold','hole_rock','double_obs','bees_rock','long_hole'] },
  { name: '대나무 숲',   icon: '🎋', bg: 'bgBamboo',  tint: 'rgba(120,255,140,0.07)',  amb: 'leaf',
    set: ['branch','snake','plant','wisp','pend','stomp','spring_fun','bones_line','bones_arc','pow','gold','branch_tunnel','snake_branch','jump_slide','double_obs'] },
  { name: '시골 마을',   icon: '🏡', bg: 'bgVillage', tint: null,                      amb: 'none',
    set: ['mud','log','plant','monkey','rock','scare','hedge','wall','bones_line','bones_arc','pow','gold','mud_rock','double_obs','hole','toucan_rock'] },
  { name: '노을 들판',   icon: '🌇', bg: 'bgSunset',  tint: 'rgba(255,140,60,0.10)',   amb: 'pollen',
    set: ['bees','boulder','snake','hole','hedge','wall','scare','bones_arc','bones_line','pow','gold','bees_rock','boulder_hole','arc_hole','double_hole'] },
  { name: '반딧불 숲',   icon: '🌙', bg: 'bgNight',   tint: 'rgba(30,50,140,0.17)',    amb: 'glow',
    set: ['wisp','branch','toucan','hole','pend','geyser','spring_fun','bones_arc','bones_line','pow','gold','branch_tunnel','slide_jump','long_hole','jump_slide'] },
  { name: '붉은 협곡',   icon: '🏜️', bg: 'bgCanyon',  tint: 'rgba(255,120,50,0.09)',   amb: 'pollen',
    set: ['boulder','rock','hole','snake','cactus','geyser','wall','geyser_pair','wall_hole','bones_line','bones_arc','pow','gold','boulder_hole','hole_rock','double_hole','triple','long_hole'] },
  { name: '도시 거리',   icon: '🏙️', bg: 'bgCity',    tint: null,                      amb: 'none',
    set: ['rock','log','toucan','boulder','cone_row','trash','wall','ball','wall_hole','double_obs','bones_line','bones_arc','pow','gold','toucan_rock','triple','jump_slide','hole'] },
  { name: '유치원 길',   icon: '🏫', bg: 'bgKinder',  tint: 'rgba(255,190,220,0.07)',  amb: 'petal',
    set: ['bones_line','bones_arc','pow','gold','rock','plant','mud','spring_fun','cone_row','double_obs'] },
];
const img = {};
let assetsReady = false;
function loadAssets() {
  const keys = Object.keys(IMG_SRC);
  let n = 0;
  return new Promise(res => {
    keys.forEach(k => {
      img[k] = new Image();
      img[k].onload = img[k].onerror = () => { if (++n === keys.length) { assetsReady = true; res(); } };
      img[k].src = IMG_SRC[k];
    });
  });
}

// ---------- 바이크 로스터 (도전과제로 해금, 로그라이크 특성) ----------
const BIKES = {
  pink:   { name: '핑크 핀핀',   icon: '🚲', hue: null, jumps: 2, desc: '밸런스형 기본 바이크 · 2단 점프', unlock: null },
  rocket: { name: '로켓 핀핀',   icon: '🚀', hue: 18,  jumps: 3, desc: '3단 점프 부스터 프레임!', unlock: 'm1000', speedMult: 1.02 },
  low:    { name: '로우라이더',  icon: '🐍', hue: 275, jumps: 2, desc: '낮은 차체 — 가지·새 밑 자동 통과', unlock: 'slide50', jumpMult: 0.95 },
  wing:   { name: '날개 핀핀',   icon: '🪽', hue: 205, jumps: 2, desc: '구덩이 위 활공! 대신 살짝 느림', unlock: 'm2000', speedMult: 0.93 },
  tank:   { name: '탱크 핀핀',   icon: '🛡️', hue: 120, jumps: 2, desc: '새를 튕겨냄 · 피격 반감 · 느림', unlock: 'nohit700', speedMult: 0.88 },
};
let bikeId = store.get('finfin_bike', 'pink');
function bike() { return BIKES[bikeId] || BIKES.pink; }
function bikeUnlocked(id) { const b = BIKES[id]; return !b.unlock || !!achState[b.unlock]; }
if (!bikeUnlocked(bikeId)) bikeId = 'pink';

// 스프라이트 색상 리매핑: 핑크 프레임(hue 300~360)만 바이크 색으로 변경
const SHIBA_KEYS = ['shiba1', 'shiba2', 'shiba3', 'shiba4', 'shibaSlide'];
const tinted = {};
function buildTint(id) {
  const b = BIKES[id];
  if (!b || b.hue === null || tinted[id]) return;
  for (const k of SHIBA_KEYS) if (!img[k] || !img[k].width) return; // 로딩 전이면 다음에
  tinted[id] = {};
  for (const k of SHIBA_KEYS) {
    const src = img[k];
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const cc = c.getContext('2d');
    cc.drawImage(src, 0, 0);
    try {
      const d = cc.getImageData(0, 0, c.width, c.height);
      const px = d.data;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3] < 10) continue;
        const r = px[i] / 255, g = px[i + 1] / 255, bl = px[i + 2] / 255;
        const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl);
        const l = (mx + mn) / 2, dl = mx - mn;
        if (dl < 0.06) continue;
        const s = dl / (1 - Math.abs(2 * l - 1));
        let h;
        if (mx === r) h = ((g - bl) / dl) % 6;
        else if (mx === g) h = (bl - r) / dl + 2;
        else h = (r - g) / dl + 4;
        h = (h * 60 + 360) % 360;
        // 핑크/로즈 프레임 픽셀만 (강아지 주황 털 hue ~15-45 제외)
        if ((h >= 300 || h < 8) && s > 0.12 && l > 0.25 && l < 0.92) {
          const nh = b.hue / 60;
          const cch = (1 - Math.abs(2 * l - 1)) * s;
          const xx = cch * (1 - Math.abs((nh % 2) - 1));
          const m = l - cch / 2;
          let rr, gg, bb;
          if (nh < 1) { rr = cch; gg = xx; bb = 0; }
          else if (nh < 2) { rr = xx; gg = cch; bb = 0; }
          else if (nh < 3) { rr = 0; gg = cch; bb = xx; }
          else if (nh < 4) { rr = 0; gg = xx; bb = cch; }
          else if (nh < 5) { rr = xx; gg = 0; bb = cch; }
          else { rr = cch; gg = 0; bb = xx; }
          px[i] = Math.round((rr + m) * 255);
          px[i + 1] = Math.round((gg + m) * 255);
          px[i + 2] = Math.round((bb + m) * 255);
        }
      }
      cc.putImageData(d, 0, 0);
    } catch (e) { /* CORS 등 실패 시 원본 사용 */ }
    tinted[id][k] = c;
  }
}
function bikeImg(k) {
  const t = tinted[bikeId];
  return (t && t[k] && t[k].width) ? t[k] : img[k];
}

// ---------- 사운드 (WebAudio 합성음) ----------
let actx = null;
function audioInit() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (actx && actx.state === 'suspended') actx.resume();
}
function blip(freq, dur, type = 'square', vol = 0.12, slide = 0, delay = 0) {
  if (!actx || muted) return;
  const t0 = actx.currentTime + delay;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(actx.destination);
  o.start(t0); o.stop(t0 + dur);
}
function swish(dur, vol, f0, f1) {
  if (!actx || muted) return;
  const n = actx.sampleRate * dur;
  const buf = actx.createBuffer(1, n, actx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = actx.createBufferSource(); src.buffer = buf;
  const f = actx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
  f.frequency.setValueAtTime(f0, actx.currentTime);
  f.frequency.exponentialRampToValueAtTime(f1, actx.currentTime + dur);
  const g = actx.createGain(); g.gain.value = vol;
  src.connect(f).connect(g).connect(actx.destination);
  src.start();
}
const sfx = {
  jump()    { blip(420, 0.18, 'square', 0.10, +380); },
  djump()   { blip(560, 0.16, 'square', 0.10, +420); },
  slide()   { swish(0.22, 0.30, 900, 260); },
  collect() { blip(880, 0.10, 'sine', 0.13, +220); blip(1320, 0.12, 'sine', 0.11, 0, 0.06); },
  combo10() { blip(740, 0.09, 'sine', 0.13); blip(980, 0.09, 'sine', 0.13, 0, 0.08); blip(1240, 0.14, 'sine', 0.13, 0, 0.16); },
  near()    { blip(1560, 0.08, 'sine', 0.12, +300); },
  hit()     { blip(160, 0.25, 'sawtooth', 0.16, -90); },
  shield()  { blip(500, 0.12, 'square', 0.14, -180); blip(330, 0.2, 'square', 0.10, -120, 0.08); },
  caught()  { blip(300, 0.5, 'sawtooth', 0.16, -220); blip(180, 0.6, 'sawtooth', 0.14, -120, 0.18); },
  power()   { blip(660, 0.1, 'sine', 0.12); blip(880, 0.1, 'sine', 0.12, 0, 0.08); blip(1100, 0.14, 'sine', 0.12, 0, 0.16); },
  gold()    { blip(1040, 0.09, 'sine', 0.14); blip(1320, 0.09, 'sine', 0.14, 0, 0.07); blip(1660, 0.16, 'sine', 0.14, 0, 0.14); },
  boost()   { swish(0.5, 0.4, 300, 2400); blip(320, 0.4, 'sawtooth', 0.08, +500); },
  fever()   { [523, 659, 784, 1046, 1318].forEach((f, i) => blip(f, 0.14, 'sine', 0.14, 0, i * 0.07)); },
  feverEnd(){ blip(880, 0.2, 'sine', 0.10, -300); },
  roar()    { blip(90, 0.55, 'sawtooth', 0.20, +40); swish(0.5, 0.5, 200, 90); },
  heart()   { blip(64, 0.12, 'sine', 0.20, -14); blip(58, 0.10, 'sine', 0.13, -10, 0.14); },
  swipeAtk(){ swish(0.28, 0.55, 1400, 300); blip(140, 0.16, 'sawtooth', 0.10, -60); },
  relief()  { blip(520, 0.12, 'sine', 0.12, +140); blip(780, 0.16, 'sine', 0.12, 0, 0.1); },
  revive()  { blip(440, 0.12, 'sine', 0.14); blip(660, 0.2, 'sine', 0.14, 0, 0.12); },
  record()  { [659, 784, 1046, 1318, 1568].forEach((f, i) => blip(f, 0.16, 'square', 0.10, 0, i * 0.09)); },
  stage()   { blip(784, 0.12, 'sine', 0.12); blip(988, 0.16, 'sine', 0.12, 0, 0.1); },
  count()   { blip(700, 0.09, 'sine', 0.12); },
  go()      { blip(1000, 0.3, 'sine', 0.14, +200); },
  click()   { blip(520, 0.06, 'sine', 0.08); },
};
function vib(p) { if (!muted && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} } }

// ---------- BGM (프로시저럴 칩튠 — 스테이지별 10곡) ----------
// 각 곡: bpm, 파형, 스케일(midi), bass/lead 16스텝(스케일 인덱스, -1=쉼), hat 16스텝
const MUSIC = [
  { bpm: 128, wave: 'square',   scale: [60, 62, 64, 67, 69],          // 1 정글: 통통 튀는 정글 그루브
    bass: [0,-1,0,-1, 3,-1,0,-1, 0,-1,0,-1, 4,-1,3,-1],
    lead: [4,-1,2,4, -1,7,-1,4, 2,-1,0,2, -1,4,2,0],
    hat:  [1,0,1,0, 1,0,1,1, 1,0,1,0, 1,0,1,1] },
  { bpm: 100, wave: 'triangle', scale: [55, 57, 59, 60, 62, 64, 66],  // 2 폭포강: 흐르는 물결
    bass: [0,-1,-1,4, -1,-1,0,-1, 3,-1,-1,5, -1,-1,3,-1],
    lead: [7,6,5,-1, 4,-1,2,-1, 5,4,3,-1, 2,-1,4,-1],
    hat:  [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0] },
  { bpm: 118, wave: 'square',   scale: [53, 55, 57, 60, 62],          // 3 해변: 칼립소 오프비트
    bass: [0,-1,-1,0, -1,3,-1,-1, 0,-1,-1,0, -1,4,-1,3],
    lead: [-1,4,-1,5, -1,4,-1,2, -1,5,-1,7, -1,5,4,2],
    hat:  [0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,1,1] },
  { bpm: 108, wave: 'triangle', scale: [50, 52, 55, 57, 60],          // 4 대나무숲: 동양풍 펜타토닉
    bass: [0,-1,-1,-1, 2,-1,-1,-1, 0,-1,-1,-1, 3,-1,2,-1],
    lead: [4,-1,5,4, 2,-1,-1,4, 5,-1,7,5, 4,2,-1,-1],
    hat:  [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0] },
  { bpm: 122, wave: 'square',   scale: [60, 62, 64, 65, 67, 69, 71],  // 5 시골마을: 유쾌한 포크
    bass: [0,-1,4,-1, 0,-1,4,-1, 3,-1,5,-1, 4,-1,4,-1],
    lead: [0,2,4,-1, 4,5,4,2, 0,2,4,-1, 2,1,0,-1],
    hat:  [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,1,0,1] },
  { bpm: 92,  wave: 'triangle', scale: [57, 60, 62, 64, 67],          // 6 노을들판: 따뜻하고 느긋
    bass: [0,-1,-1,-1, -1,-1,3,-1, 2,-1,-1,-1, -1,-1,4,-1],
    lead: [4,-1,-1,5, -1,4,-1,-1, 2,-1,-1,4, -1,2,0,-1],
    hat:  [0,0,1,0, 0,0,0,0, 0,0,1,0, 0,0,0,0] },
  { bpm: 100, wave: 'sine',     scale: [52, 55, 57, 59, 62, 64],      // 7 반딧불숲: 신비로운 밤
    bass: [0,-1,-1,-1, 2,-1,-1,-1, 1,-1,-1,-1, 3,-1,-1,-1],
    lead: [-1,5,-1,7, -1,-1,5,-1, -1,4,-1,5, -1,-1,-1,-1],
    hat:  [0,0,0,1, 0,0,0,0, 0,0,0,1, 0,0,0,0] },
  { bpm: 132, wave: 'sawtooth', scale: [50, 53, 55, 57, 60],          // 8 붉은협곡: 서부극 질주
    bass: [0,0,-1,0, -1,0,3,-1, 0,0,-1,0, -1,4,3,2],
    lead: [4,-1,4,-1, 5,4,2,-1, 4,-1,7,-1, 5,-1,4,2],
    hat:  [1,0,1,1, 1,0,1,0, 1,0,1,1, 1,0,1,1] },
  { bpm: 140, wave: 'square',   scale: [52, 55, 57, 59, 62, 64],      // 9 도시거리: 에너제틱 시티팝
    bass: [0,-1,0,3, -1,3,0,-1, 2,-1,2,5, -1,5,4,3],
    lead: [7,-1,5,7, -1,5,4,-1, 5,-1,4,5, -1,4,2,4],
    hat:  [1,1,0,1, 1,0,1,1, 1,1,0,1, 1,0,1,1] },
  { bpm: 138, wave: 'square',   scale: [60, 62, 64, 65, 67, 69, 71, 72], // 10 유치원길: 개선 행진 피날레
    bass: [0,-1,4,-1, 0,-1,4,-1, 5,-1,3,-1, 4,4,-1,-1],
    lead: [7,-1,7,-1, 9,-1,7,5, 4,5,7,-1, 9,-1,11,-1],
    hat:  [1,0,1,1, 1,0,1,0, 1,0,1,1, 1,1,1,1] },
];
const midiHz = n => 440 * Math.pow(2, (n - 69) / 12);
const BGM = {
  cur: -1, iv: null, step: 0, nextT: 0,
  tone(t, freq, dur, type, vol) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(actx.destination);
    o.start(t); o.stop(t + dur);
  },
  hat(t, vol) {
    if (!this.nbuf) {
      const n = actx.sampleRate * 0.06;
      this.nbuf = actx.createBuffer(1, n, actx.sampleRate);
      const d = this.nbuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    }
    const s = actx.createBufferSource(); s.buffer = this.nbuf;
    const f = actx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
    const g = actx.createGain(); g.gain.value = vol;
    s.connect(f).connect(g).connect(actx.destination);
    s.start(t);
  },
  start(i) {
    this.stop();
    this.cur = i;
    if (!actx || muted) return;
    this.step = 0;
    this.nextT = actx.currentTime + 0.08;
    this.iv = setInterval(() => this.tick(), 90);
  },
  stop() { if (this.iv) { clearInterval(this.iv); this.iv = null; } },
  tick() {
    if (!actx || muted) { this.stop(); return; }
    const m = MUSIC[((this.cur % 10) + 10) % 10];
    const spb = 60 / m.bpm / 4;
    while (this.nextT < actx.currentTime + 0.24) {
      const s = this.step % 16, t = this.nextT;
      const deg = (arr, idx) => midiHz(m.scale[idx % m.scale.length] + 12 * Math.floor(idx / m.scale.length));
      if (m.bass[s] >= 0) this.tone(t, deg(m.scale, m.bass[s]) / 2, spb * 1.8, 'triangle', 0.055);
      if (m.lead[s] >= 0) this.tone(t, deg(m.scale, m.lead[s]), spb * 1.4, m.wave, m.wave === 'sawtooth' ? 0.028 : 0.04);
      if (m.hat[s]) this.hat(t, 0.018);
      this.nextT += spb;
      this.step++;
    }
  },
};

// ---------- 캔버스/스케일 (세로/가로 모두 지원) ----------
let W = 0, H = 0, DPR = 1, SC = 1, groundY = 0;
function resize() {
  const oldW = W, oldH = H, oldSC = SC, oldGroundY = groundY;
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * DPR; canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  SC = W > H ? H / 560 : Math.min(W / 420, H / 760);
  groundY = H * 0.78;
  if (oldW && (oldW !== W || oldH !== H)) rescaleWorld(oldW, oldSC, oldGroundY);
}
function rescaleWorld(oldW, oldSC, oldGroundY) {
  if (!G.player) return;
  const rx = W / oldW, rs = SC / oldSC;
  const p = G.player;
  p.x = W * 0.30;
  p.w = 128 * SC; p.h = 128 * SC;
  if (p.onGround) { p.y = groundY; p.vy = 0; }
  else { p.y = groundY - (oldGroundY - p.y) * rs; p.vy *= rs; }
  for (const o of G.obstacles) {
    o.x *= rx; o.dw *= rs; o.dh *= rs;
    if (o.barBottom !== undefined) o.barBottom = groundY - (oldGroundY - o.barBottom) * rs;
    if (o.y0 !== undefined) o.y0 = groundY - (oldGroundY - o.y0) * rs;
    if (o.y !== undefined) o.y = groundY - (oldGroundY - o.y) * rs;
    if (o.fy !== undefined) o.fy = groundY - (oldGroundY - o.fy) * rs;
    if (o.pivY !== undefined) { o.pivY = groundY - 300 * SC; o.len = 224 * SC; }
  }
  for (const h of G.holes) { h.x *= rx; h.w *= rs; }
  for (const b of G.bones) { b.x *= rx; b.y = groundY - (oldGroundY - b.y) * rs; }
  for (const w of G.pows) { w.x *= rx; w.y = groundY - (oldGroundY - w.y) * rs; }
  if (G.shots) for (const s of G.shots) { s.x *= rx; s.y = groundY - (oldGroundY - s.y) * rs; s.vy *= rs; s.vx *= rs; }
  for (const s of G.signs) s.x *= rx;
  for (const t of G.hints) t.x *= rx;
  G.speed *= rs; G.baseSpeed *= rs; G.maxSpeed = 1045 * SC;
  G.spawnPx *= rx;
  G.parts = []; G.pops = [];
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 60));
resize();

// ---------- 게임 상태 ----------
const ST = { MENU: 0, INTRO: 1, COUNT: 2, RUN: 3, CAUGHT: 4, OVER: 5, PAUSE: 6, REVIVE: 7, EVENT: 8, CLEAR: 9, FIN: 10 };
let state = ST.MENU;

const G = {};
let runFrom = 0; // 체크포인트 시작 지점 (m)

// ---------- 다이내믹 카메라 / 슬로모션 / 컷인 (레이싱 연출 코어) ----------
const cam = { z: 1, punchZ: 1, punchT: 0, punchDur: 0.5, y: 0 };
function camPunch(z, dur = 0.55) { cam.punchZ = z; cam.punchT = dur; cam.punchDur = dur; }
function camTick(dt) {
  // 기본 줌: 속도가 붙을수록 살짝 와이드 (질주감)
  let target = G.maxSpeed ? 1.02 - (G.speed / G.maxSpeed) * 0.07 : 1;
  // 위기 긴장 줌: 호랑이 초근접 시 미세하게 조여오는 스로브
  if (state === ST.RUN && G.tigerDist < 12) {
    target += 0.03 + Math.sin(performance.now() * 0.009) * 0.014;
  }
  if (cam.punchT > 0) {
    cam.punchT -= dt;
    const k = Math.max(0, cam.punchT / cam.punchDur);
    target = target + (cam.punchZ - target) * (k * k * (3 - 2 * k)); // smoothstep 감쇠
  }
  cam.z += (target - cam.z) * Math.min(1, dt * 7);
  // 점프 상하 팔로우 (부드러운 수직 시차 — 위 46SC, 낙하 시 아래 80SC 한도)
  const ty = G.player ? Math.max(-80 * SC, Math.min(46 * SC, (groundY - G.player.y) * 0.12)) : 0;
  cam.y += (ty - cam.y) * Math.min(1, dt * 6);
}
function applyCam() {
  if (!G.player) return;
  if (Math.abs(cam.y) > 0.5) ctx.translate(0, cam.y);
  if (Math.abs(cam.z - 1) < 0.001) return;
  const p = G.player;
  // 플레이어 상체를 초점으로 줌 (화면 중심과 블렌드해 과도한 시프트 방지)
  const fx = p.x * 0.7 + W * 0.5 * 0.3;
  const fy = (p.y - p.h * 0.55) * 0.7 + H * 0.5 * 0.3;
  ctx.translate(fx, fy);
  ctx.scale(cam.z, cam.z);
  ctx.translate(-fx, -fy);
}
// 슬로모션: ts가 1로 서서히 복귀
let ts = 1, tsHold = 0;
function slowmo(v, hold = 0.3) { ts = v; tsHold = hold; }
// 컷인 (격투게임식 캐릭터 클로즈업 패널)
function cutIn(imgKey, txt, col = '#ffd75e', dur = 0.85) {
  G.cutIn = { imgKey, txt, col, t: 0, dur };
}
function drawCutIn() {
  const c = G.cutIn;
  if (!c) return;
  const u = c.t / c.dur;
  // 진입 easeOutBack / 퇴장 ease-in
  const ein = u < 0.22 ? (t => { const s = 1.7; const x = t / 0.22; return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); })(u) : 1;
  const eout = u > 0.78 ? 1 - (u - 0.78) / 0.22 : 1;
  const a = Math.max(0, Math.min(ein, 1) * eout);
  if (a <= 0) return;
  const bandH = Math.min(H * 0.24, 170 * SC);
  const cy = H * 0.34;
  ctx.save();
  ctx.globalAlpha = a;
  // 대각 컬러 밴드
  ctx.save();
  ctx.translate(0, cy);
  ctx.transform(1, -0.06, 0, 1, 0, 0);
  const bg = ctx.createLinearGradient(0, 0, W, 0);
  bg.addColorStop(0, 'rgba(10,8,4,0.0)');
  bg.addColorStop(0.18, 'rgba(12,10,5,0.88)');
  bg.addColorStop(0.85, 'rgba(12,10,5,0.88)');
  bg.addColorStop(1, 'rgba(10,8,4,0.0)');
  ctx.fillStyle = bg;
  ctx.fillRect(-20, -bandH / 2, W + 40, bandH);
  ctx.strokeStyle = c.col;
  ctx.lineWidth = 3 * SC;
  ctx.beginPath();
  ctx.moveTo(-20, -bandH / 2); ctx.lineTo(W + 40, -bandH / 2);
  ctx.moveTo(-20, bandH / 2); ctx.lineTo(W + 40, bandH / 2);
  ctx.stroke();
  // 스피드 라인 장식
  ctx.strokeStyle = `rgba(255,255,255,0.25)`;
  ctx.lineWidth = 2 * SC;
  for (let i = 0; i < 5; i++) {
    const ly = -bandH / 2 + bandH * (0.15 + i * 0.17);
    const off = ((c.t * (900 + i * 240)) % (W + 300)) - 150;
    ctx.beginPath();
    ctx.moveTo(W - off, ly);
    ctx.lineTo(W - off + (70 + i * 26) * SC, ly);
    ctx.stroke();
  }
  // 얼굴 슬라이드 인
  const im = img[c.imgKey];
  const slideX = (1 - Math.min(1, ein)) * -W * 0.4;
  if (im && im.width) {
    const fh = bandH * 1.28;
    const fw = fh * (im.width / im.height);
    ctx.drawImage(im, W * 0.13 + slideX, -fh * 0.56, fw, fh);
  }
  // 텍스트
  const fs = Math.min(40 * SC, W * 0.075);
  ctx.font = `900 ${fs}px 'Apple SD Gothic Neo','Malgun Gothic',sans-serif`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.lineWidth = fs * 0.2;
  ctx.strokeStyle = 'rgba(15,10,4,0.9)';
  const tx = W * 0.13 + bandH * 1.15 + slideX * 0.5;
  ctx.strokeText(c.txt, tx, 2);
  ctx.fillStyle = c.col;
  ctx.fillText(c.txt, tx, 2);
  ctx.restore();
  ctx.restore();
  ctx.globalAlpha = 1;
}
function resetGame(fromM = runFrom) {
  G.maxSpeed = 1045 * SC;
  // 체크포인트 시작 시 해당 지점의 자연스러운 주행 속도로 (저속 점프 리치 부족 방지)
  const natural = Math.min(G.maxSpeed, (450 + fromM * 0.8) * SC);
  G.speed = natural;
  G.baseSpeed = natural;
  cam.z = 1; cam.punchT = 0; cam.y = 0;
  ts = 1; tsHold = 0;
  G.cutIn = null;
  G.score = 0;
  G.bonesCnt = 0;
  G.tigerDist = 62;
  G.player = {
    x: W * 0.30, y: groundY, vy: 0,
    onGround: true, jumps: 0, anim: 0, invuln: 0, falling: false,
    sliding: false, slideLock: 0, fastFall: false, gliding: false,
    w: 128 * SC, h: 128 * SC,
  };
  buildTint(bikeId);
  // 로그라이크 런 상태
  G.perks = {};
  G.shots = [];        // 코코넛 등 투사체
  G.eventCnt = 0;
  G.rainT = 0; G.rainNext = fromM + 550 + Math.random() * 500;
  G.tiger = { anim: 0, lunge: 0 };
  G.obstacles = [];   // {kind, x, dw, dh, ...} branch: barBottom / toucan: y0,t
  G.holes = [];
  G.bones = [];
  G.pows = [];        // {kind:'helmet'|'magnet'|'boost'|'gold', x, y, t}
  G.parts = [];
  G.pops = [];        // 떠오르는 점수 텍스트 {x,y,txt,t,life,c,big}
  G.signs = [];
  G.hints = [];       // 튜토리얼 말풍선 {x,y,txt}
  G.worldX = fromM;
  G.nextMilestone = fromM + 500;
  G.shake = 0; G.flash = 0; G.caughtT = 0;
  G.slowRecover = 0;
  // 콤보/피버
  G.combo = 0; G.comboMax = 0;
  G.fever = 0;        // 게이지 0..1
  G.feverT = 0;       // 피버 남은 시간
  G.feverCnt = 0;
  // 파워업
  G.magT = 0; G.boostT = 0; G.shield = false;
  // 스포너
  G.spawnPx = 620 * SC;
  G.lastChunk = '';
  G.powCd = 2;
  G.queue = (totals.runs === 0 && fromM === 0) ? ['bones_line', 'rock', 'bones_arc', 'log', 'branch_intro', 'bones_line'] : [];
  // 기록
  G.nearCnt = 0; G.slideCnt = 0; G.noHitDist = 0; G.newAch = []; G.hitCnt = 0; G.hitByKind = {};
  G.reviveUsed = false; G.reviveT = 0;
  // 스테이지 (체크포인트 시작 반영)
  G.stage = Math.min(9, Math.floor(fromM / STAGE_LEN));
  G.stagePrev = G.stage; G.stageFade = 1;
  G.pendingStage = null; G.clearT = 0; G.clearShown = false; G.finT = 0; G.finShown = false;
  G.roarT = 0.5;
  // 연출
  G.hitStop = 0; G.banner = null; G.bestBroken = fromM > 0; G.deathBy = '';
  G.player.squash = 0;
  updateHUD(true);
}

// ---------- 도전과제 ----------
const ACH = [
  { id: 'first_run', name: '첫 등원',           desc: '첫 게임을 완주했다멍!', icon: '🎒' },
  { id: 'm500',      name: '동네 한 바퀴',      desc: '한 판에 500m 달리기', icon: '🚲' },
  { id: 'm1000',     name: '정글 탐험가',       desc: '한 판에 1,000m 달리기', icon: '🌴' },
  { id: 'm2000',     name: '질주 본능',         desc: '한 판에 2,000m 달리기', icon: '⚡' },
  { id: 'm3000',     name: '등원왕 시바',       desc: '한 판에 3,000m 달리기', icon: '👑' },
  { id: 'bones30',   name: '간식 부자',         desc: '한 판에 뼈다귀 30개', icon: '🦴' },
  { id: 'combo15',   name: '콤보 마스터',       desc: '콤보 15 달성', icon: '🔥' },
  { id: 'fever3',    name: '피버 타임!',        desc: '한 판에 피버 3번', icon: '🌈' },
  { id: 'near10',    name: '아슬아슬 곡예사',   desc: '한 판에 니어미스 10번', icon: '😎' },
  { id: 'nohit700',  name: '무결점 라이더',     desc: '부딪히지 않고 700m', icon: '🛡️' },
  { id: 'bones300',  name: '뼈다귀 콜렉터',     desc: '누적 뼈다귀 300개', icon: '💎' },
  { id: 'slide50',   name: '림보의 달인',       desc: '누적 슬라이드 50번', icon: '🐍' },
  { id: 'stage5',    name: '절반 돌파',         desc: '5번째 스테이지 도달', icon: '🚩' },
  { id: 'finish',    name: '등원 완주!',        desc: '10,000m — 유치원 도착!', icon: '🏫' },
];
function unlock(id) {
  if (achState[id]) return;
  achState[id] = true;
  store.set('finfin_ach', achState);
  const a = ACH.find(a => a.id === id);
  G.newAch && G.newAch.push(a);
  Bridge.emit('achievement', { id, name: a.name });
  const bk = Object.keys(BIKES).find(k => BIKES[k].unlock === id);
  showToast(bk ? `🏅 ${a.name}! 🚲 차고에 [${BIKES[bk].name}] 해금!` : `🏅 도전과제 달성 — ${a.name}!`);
  sfx.record(); vib([30, 40, 60]);
}
function achCount() { return ACH.filter(a => achState[a.id]).length; }

// ---------- 카툰 약올리기 이벤트 + 로그라이크 퍼크 ----------
const GAGS = [
  { s: '메롱~ 🐕 못 잡지롱!', t: '어흥!! 오늘은 꼭 잡는다!!' },
  { s: '난 밥이 아니라 등원생이다멍!', t: '거기 서!! 아침밥아!!' },
  { s: '페달? 없어도 씽씽~ 발이 모터거든!', t: '그거 반칙 아니냐고!!!' },
  { s: '호랑이도 지치는구나~ 메롱!', t: '헥헥… 자, 잠깐 타임…' },
  { s: '유치원 늦겠다! 비켜비켜~', t: '지각시키는 게 내 오늘 목표다!!' },
  { s: '이 바이크? 핀핀! 어른들한테 물어봐~', t: '그 자전거… 나도 하나 사줘…' },
  { s: '꼬리 밟을 뻔했잖아! 조심해!', t: '그건 내 대사라고!!' },
  { s: '뼈다귀 하나 나눠줄까? 히히', t: '어흥!! (배에서 꼬르르륵…)' },
];
const PERKS = [
  { id: 'boneUp',    icon: '🦴', name: '간식의 힘',     desc: '뼈 8개 콤보 시 호랑이를 더 멀리!', apply() { G.perks.boneUp = true; } },
  { id: 'feverFast', icon: '🌈', name: '피버 부스트',   desc: '피버 게이지가 더 빨리 참',      apply() { G.perks.feverNeed = 12; } },
  { id: 'miniMag',   icon: '🧲', name: '자석 코팅',     desc: '약한 자석 효과가 계속 유지',    apply() { G.perks.miniMag = true; } },
  { id: 'helmet',    icon: '⛑️', name: '안전모 지급',   desc: '지금 바로 헬멧 장착!',          apply() { G.shield = true; } },
  { id: 'tigerPush', icon: '💨', name: '전력 질주',     desc: '호랑이와의 거리가 확 벌어짐',   apply() { G.tigerDist = Math.min(100, G.tigerDist + 28); } },
  { id: 'near2',     icon: '😎', name: '곡예사의 혼',   desc: '아슬아슬 통과 시 피버 게이지 2배', apply() { G.perks.near2 = true; } },
  { id: 'slideTurbo',icon: '🐍', name: '림보 터보',     desc: '슬라이드 중 피버 게이지 충전',  apply() { G.perks.slideTurbo = true; } },
  { id: 'boostLong', icon: '🚀', name: '오래가는 부스터', desc: '부스터 지속시간 1.5배',      apply() { G.perks.boostLong = true; } },
  { id: 'tigerRegen',icon: '🐾', name: '지구력 훈련',   desc: '호랑이가 더 빨리 뒤처짐',       apply() { G.perks.tigerRegen = true; } },
];
// ---------- 스테이지 클리어 (폭죽 페이즈 → 퍼크 선택) ----------
function fireworks() {
  const cols = ['255,90,90', '255,200,80', '120,220,255', '190,140,255', '140,255,160', '255,150,220'];
  const x = W * (0.12 + Math.random() * 0.76), y = H * (0.12 + Math.random() * 0.42);
  const c = cols[(Math.random() * cols.length) | 0];
  sparkle(x, y, 22, c);
  ring(x, y, c, 320);
}
function startStageClear(newStg) {
  state = ST.CLEAR;
  G.clearT = 0; G.clearShown = false; G.pendingStage = newStg;
  // 필드 정리: 세리머니·재개 중 불공정 사망 방지 (공중/구덩이 위 교차 케이스)
  const p = G.player;
  G.obstacles = []; G.holes = []; G.shots = [];
  if (p.falling || p.y > groundY) {
    p.falling = false; p.y = groundY; p.vy = 0; p.onGround = true; p.jumps = 0;
  }
  p.sliding = false; p.fastFall = false;
  G.spawnPx = Math.max(G.spawnPx, 600 * SC);
  const saved = store.get('finfin_stage', 0);
  if (newStg > saved) store.set('finfin_stage', newStg);
  if (newStg >= 4) unlock('stage5');
  Bridge.emit('stageclear', { stage: newStg, distance: Math.floor(G.worldX), bones: G.bonesCnt });
  showBanner(`STAGE ${newStg} 클리어!! 🎉`);
  camPunch(1.15, 1.2);
  sfx.record(); sfx.fever(); vib([40, 40, 90]);
  G.flash = 0.25;
  updateHUD(true); // 세리머니 중 HUD가 경계 직전 값(999m)으로 멈춰 보이지 않게
}
function startFinish() {
  state = ST.FIN;
  G.finT = 0; G.finShown = false;
  unlock('finish');
  const score = Math.floor(G.score);
  best = Math.max(score, best);
  store.set('finfin_best', best);
  totals.runs++;
  store.set('finfin_tot', totals);
  showBanner('🏫 유치원 도착!!! 🎉');
  Bridge.emit('finish', {
    distance: TOTAL_M, bones: G.bonesCnt, comboMax: G.comboMax, fevers: G.feverCnt, best,
  });
  camPunch(1.22, 1.1); slowmo(0.4, 0.5);
  cutIn('faceShiba', '등원 성공!! 🎉');
  sfx.record(); sfx.fever(); vib([60, 50, 60, 50, 140]);
  G.flash = 0.35;
  BGM.stop();
}
function startEvent() {
  state = ST.EVENT;
  G.eventCnt++;
  const gag = GAGS[(Math.random() * GAGS.length) | 0];
  $('gagShiba').textContent = gag.s;
  $('gagTiger').textContent = gag.t;
  // 중복 없는 퍼크 3장 (이미 가진 지속 퍼크 제외)
  const pool = PERKS.filter(pk => !G.perks[pk.id] && !(pk.id === 'helmet' && G.shield));
  const cards = [];
  while (cards.length < 3 && pool.length) {
    cards.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
  }
  const wrap = $('perkCards');
  wrap.innerHTML = cards.map((pk, i) =>
    `<button class="perk-card" data-i="${i}">
      <span class="perk-icon">${pk.icon}</span>
      <b>${pk.name}</b><small>${pk.desc}</small>
    </button>`).join('');
  wrap.querySelectorAll('.perk-card').forEach(btn => {
    btn.onclick = () => { sfx.power(); pickPerk(cards[+btn.dataset.i]); };
  });
  // 스테이지 클리어 헤더 (진행 도트 + 다음 스테이지 미리보기)
  const head = $('clearHead');
  if (G.pendingStage != null) {
    const n = G.pendingStage;
    $('clearTitle').textContent = `🎉 STAGE ${n} 클리어!`;
    $('clearNext').innerHTML = `다음 — ${STAGES[n].icon} <b>${STAGES[n].name}</b>`;
    $('clearDots').innerHTML = STAGES.map((s, i) =>
      `<span class="dot${i < n ? ' on' : ''}${i === n ? ' cur' : ''}"></span>`).join('');
    head.classList.remove('hidden');
    ui.event.classList.add('clear-mode');
  } else {
    head.classList.add('hidden');
    ui.event.classList.remove('clear-mode');
  }
  ui.event.classList.remove('hidden');
  sfx.stage(); vib(30);
}
function pickPerk(pk) {
  if (state !== ST.EVENT) return;
  pk.apply();
  showToast(`${pk.icon} ${pk.name}!`);
  endEvent();
}
function endEvent() {
  ui.event.classList.add('hidden');
  // 스테이지 전환 적용 (배경 크로스페이드 + 새 BGM)
  if (G.pendingStage != null) {
    const ns = G.pendingStage;
    G.pendingStage = null;
    G.stagePrev = G.stage; G.stage = ns; G.stageFade = 0;
    BGM.start(ns);
    showBanner(`${STAGES[ns].icon} ${STAGES[ns].name}`);
    showToast(`${STAGES[ns].icon} ${STAGES[ns].name} — 출발!`);
    sfx.go();
  }
  state = ST.RUN;
  const p = G.player;
  p.invuln = Math.max(p.invuln, 1.2);
  G.tigerDist = Math.min(100, G.tigerDist + 8);  // 숨 고르기: 호랑이도 잠깐 쉼
  G.spawnPx = Math.max(G.spawnPx, 550 * SC);     // 복귀 여유
}

// ---------- 입력 (오른쪽 탭=점프 · 왼쪽 홀드=슬라이드) ----------
const input = { slidePointers: new Set(), keySlide: false };
function slideHeld() { return input.slidePointers.size > 0 || input.keySlide; }
function jumpInput() {
  if (state !== ST.RUN) return;
  const p = G.player;
  if (p.falling) return;
  if (p.sliding) { p.sliding = false; p.slideLock = 0; }
  const jm = bike().jumpMult || 1;
  if (p.onGround) {
    p.vy = -1120 * SC * jm; p.onGround = false; p.jumps = 1;
    sfx.jump(); dust(p.x, groundY, 8);
  } else if (p.jumps < bike().jumps) {
    p.vy = -(p.jumps >= 2 ? 900 : 980) * SC * jm; p.jumps++;
    sfx.djump(); dust(p.x, p.y, 6, true);
    if (p.jumps >= 3) { // 로켓 3단 점프 화염
      sparkle(p.x, p.y + 10 * SC, 10, '255,150,60');
      camPunch(1.10, 0.3);
      sfx.boost();
    }
  }
}
function slidePress() {
  if (state !== ST.RUN) return;
  const p = G.player;
  p.slideLock = 0.30;
  if (!p.onGround && !p.fastFall && !p.falling) {
    p.fastFall = true;
    p.vy = Math.max(p.vy, 1500 * SC);
    dust(p.x, p.y, 4, true);
  }
}
canvas.addEventListener('pointerdown', e => {
  e.preventDefault(); audioInit();
  if (e.clientX < W * 0.38) { input.slidePointers.add(e.pointerId); slidePress(); }
  else jumpInput();
}, { passive: false });
const releaseSlide = e => input.slidePointers.delete(e.pointerId);
window.addEventListener('pointerup', releaseSlide);
window.addEventListener('pointercancel', releaseSlide);
window.addEventListener('keydown', e => {
  if (e.repeat) return;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); audioInit(); jumpInput(); }
  if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); audioInit(); input.keySlide = true; slidePress(); }
  if (e.code === 'Escape' || e.code === 'KeyP') { if (state === ST.RUN) doPause(); else if (state === ST.PAUSE) doResume(); }
});
window.addEventListener('keyup', e => {
  if (e.code === 'ArrowDown' || e.code === 'KeyS') input.keySlide = false;
});

// ---------- 파티클 / 팝업 ----------
function dust(x, y, n, air = false) {
  for (let i = 0; i < n; i++) {
    G.parts.push({
      x: x - 30 * SC + Math.random() * 24 * SC,
      y: y - (air ? 10 : 4) * SC + Math.random() * 8 * SC,
      vx: -(60 + Math.random() * 120) * SC,
      vy: -(20 + Math.random() * 90) * SC * (air ? 0.4 : 1),
      r: (3 + Math.random() * 5) * SC,
      life: 0.5 + Math.random() * 0.3, t: 0,
      c: air ? '255,255,255' : '164,124,88', grav: 1,
    });
  }
}
function sparkle(x, y, n, c) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = (60 + Math.random() * 160) * SC;
    G.parts.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40 * SC,
      r: (2.5 + Math.random() * 4) * SC, life: 0.45 + Math.random() * 0.35, t: 0,
      c, grav: 0.4,
    });
  }
}
function rainbow(x, y) {
  const hue = (performance.now() * 0.35) % 360;
  const [r, g, b] = hsl2rgb(hue, 90, 62);
  G.parts.push({
    x: x - 30 * SC, y: y - 40 * SC + Math.random() * 30 * SC,
    vx: -(140 + Math.random() * 60) * SC, vy: (Math.random() - 0.5) * 60 * SC,
    r: (4 + Math.random() * 6) * SC, life: 0.5, t: 0, c: `${r},${g},${b}`, grav: 0,
  });
}
function hsl2rgb(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
function pop(x, y, txt, c = '#ffe9a8', big = false) {
  G.pops.push({ x, y, txt, t: 0, life: big ? 1.1 : 0.8, c, big });
}
// 파티클/팝업/배너만 진행 (클리어·완주 연출용)
function fxTick(dt) {
  for (const pa of G.parts) {
    pa.t += dt; pa.x += pa.vx * dt; pa.y += pa.vy * dt;
    pa.vy += 300 * SC * dt * (pa.grav !== undefined ? pa.grav : 1);
  }
  G.parts = G.parts.filter(pa => pa.t < pa.life);
  for (const pp of G.pops) { pp.t += dt; pp.y -= 46 * SC * dt; }
  G.pops = G.pops.filter(pp => pp.t < pp.life);
  if (G.banner) { G.banner.t += dt; if (G.banner.t > G.banner.life) G.banner = null; }
  if (G.flash > 0) G.flash -= dt;
  if (G.shake > 0) G.shake -= dt;
}
// 확장 링 이펙트 (피격/수집 임팩트)
function ring(x, y, c, growth = 260) {
  G.parts.push({ ring: 1, x, y, vx: 0, vy: 0, r: 10 * SC, life: 0.35, t: 0, c, grav: 0, growth: growth * SC });
}
// 대형 배너 (피버/스테이지/신기록 등 빅 모먼트)
function showBanner(txt, c = '#ffd75e') {
  G.banner = { txt, c, t: 0, life: 1.7 };
}

// ---------- 토스트 ----------
function showToast(txt) {
  const t = ui.toast;
  t.textContent = txt;
  t.classList.remove('hidden');
  t.style.animation = 'none';
  void t.offsetWidth;
  t.style.animation = '';
}

// ---------- 장애물/아이템 정의 ----------
// 히트박스는 시각보다 관대하게 (플랫포머 공정성 원칙)
const OBS_DEF = {
  rock:  { dw: 96,  hbx: 0.20, hby: 0.76 },
  log:   { dw: 128, hbx: 0.18, hby: 0.74 },
  plant: { dw: 88,  hbx: 0.24, hby: 0.79 },
  // 신규 정적 장애물 (스테이지 전용)
  cactus:    { dw: 76, hbx: 0.30, hby: 0.92 },  // 협곡 — 키가 커서 정확한 점프 필요
  scarecrow: { dw: 88, hbx: 0.30, hby: 0.84 },  // 시골마을
  cone:      { dw: 54, hbx: 0.20, hby: 0.78 },  // 도시 — 작아서 연속 배치
  trashcan:  { dw: 74, hbx: 0.20, hby: 0.80 },  // 도시
};
function addObstacle(kind, x) {
  const def = OBS_DEF[kind];
  const dw = def.dw * SC * (0.92 + Math.random() * 0.18);
  const ratio = img[kind] && img[kind].height / img[kind].width || 0.75;
  G.obstacles.push({ kind, x, dw, dh: dw * ratio, minClear: 1e9 });
}
function addBranch(x) {
  const dw = 175 * SC * (0.95 + Math.random() * 0.1);
  const ratio = img.branch && img.branch.width ? img.branch.height / img.branch.width : 0.9;
  G.obstacles.push({ kind: 'branch', x, dw, dh: dw * ratio, barBottom: groundY - 64 * SC, minClear: 1e9 });
}
function addToucan(x) {
  const dw = 96 * SC;
  const ratio = img.toucan1 && img.toucan1.width ? img.toucan1.height / img.toucan1.width : 0.8;
  G.obstacles.push({ kind: 'toucan', x, dw, dh: dw * ratio, y0: groundY - 104 * SC, t: 0, minClear: 1e9 });
}
function addPow(kind, x, y) {
  G.pows.push({ kind, x, y: y || groundY - 150 * SC, t: Math.random() * 6 });
}
function addSnake(x) {
  const dw = 118 * SC;
  const ratio = img.snake1 && img.snake1.width ? img.snake1.height / img.snake1.width : 0.85;
  G.obstacles.push({ kind: 'snake', x, dw, dh: dw * ratio, t: Math.random() * 6, minClear: 1e9 });
}
function addBoulder(x) {
  const dw = 92 * SC;
  G.obstacles.push({ kind: 'boulder', x, dw, dh: dw, rot: 0, minClear: 1e9 });
}
function addBees(x) {
  G.obstacles.push({ kind: 'bees', x, dw: 84 * SC, dh: 60 * SC, y0: groundY - 102 * SC, t: Math.random() * 6, minClear: 1e9 });
}
function addMud(x) {
  G.obstacles.push({ kind: 'mud', x, dw: 150 * SC, dh: 16 * SC, mudCd: 0, minClear: 1e9 });
}
function addMonkey(x) {
  const dw = 110 * SC;
  const ratio = img.monkey && img.monkey.width ? img.monkey.height / img.monkey.width : 1.9;
  G.obstacles.push({ kind: 'monkey', x, dw, dh: dw * ratio, thrown: false, t: 0, minClear: 1e9 });
}
function addWisp(x) {
  G.obstacles.push({ kind: 'wisp', x, dw: 52 * SC, dh: 52 * SC, y0: groundY - 92 * SC, t: Math.random() * 6, minClear: 1e9 });
}
// ---------- 신규 메커니즘 장애물 ----------
function addCrab(x) { // 옆걸음으로 다가오는 게 (해변)
  const r = img.crab && img.crab.width ? img.crab.height / img.crab.width : 0.8;
  G.obstacles.push({ kind: 'crab', x, dw: 76 * SC, dh: 76 * SC * r, t: Math.random() * 6, minClear: 1e9 });
}
function addFrog(x) { // 주기적으로 폴짝 뛰는 개구리 (강가)
  const r = img.frog && img.frog.width ? img.frog.height / img.frog.width : 0.8;
  G.obstacles.push({ kind: 'frog', x, dw: 72 * SC, dh: 72 * SC * r, y: groundY, vy: 0, hopT: 0.9 + Math.random() * 0.8, minClear: 1e9 });
}
function addHedge(x) { // 빠르게 굴러오는 고슴도치 (마을/들판)
  G.obstacles.push({ kind: 'hedge', x, dw: 62 * SC, dh: 62 * SC, rot: 0, minClear: 1e9 });
}
function addBall(x) { // 튀는 비치볼 (해변/도시)
  G.obstacles.push({ kind: 'ball', x, dw: 64 * SC, dh: 64 * SC, y: groundY - 220 * SC, vy: 0, minClear: 1e9 });
}
function addGeyser(x) { // 간헐천: 경고(거품) → 분출(위험) 사이클
  G.obstacles.push({ kind: 'geyser', x, dw: 78 * SC, dh: 20 * SC, t: Math.random() * 1.2, minClear: 1e9 });
}
function addStomper(x) { // 낙하물: 접근 시 그림자 경고 후 떨어짐
  G.obstacles.push({ kind: 'stomper', x, dw: 58 * SC, dh: 58 * SC, fy: -140 * SC, vy: 0, falling: false, landed: -1, minClear: 1e9 });
}
function addPend(x) { // 진자 등불: 흔들림 아래로 슬라이드 통과
  G.obstacles.push({ kind: 'pend', x, dw: 50 * SC, dh: 50 * SC, t: Math.random() * 6, pivY: groundY - 300 * SC, len: 224 * SC, minClear: 1e9 });
}
function addWall(x) { // 높은 벽: 2단 점프 필요 (스테이지별 스킨)
  G.obstacles.push({ kind: 'wall', x, dw: 88 * SC, dh: 190 * SC, minClear: 1e9 });
}
function addSpring(x) { // 점프 버섯: 밟으면 크게 도약 (무해 + 재미)
  G.obstacles.push({ kind: 'spring', x, dw: 60 * SC, dh: 44 * SC, t: 0, minClear: 1e9 });
}
function boneArc(x, arc) {
  const n = 3 + (Math.random() * 3 | 0);
  const baseY = groundY - (arc ? 150 : 70) * SC - Math.random() * 60 * SC;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const yOff = arc ? -Math.sin(t * Math.PI) * 90 * SC : 0;
    G.bones.push({ x: x + i * 64 * SC, y: baseY + yOff, t: Math.random() * 6 });
  }
  return n * 64 * SC;
}

// ---------- 패턴 청크 (난이도 밴드 스포너) ----------
const CHUNKS = [
  { id: 'rock', d: 1, fn(x) { addObstacle('rock', x); if (Math.random() < 0.5) boneArc(x + 20 * SC, true); return 140 * SC; } },
  { id: 'log', d: 1, fn(x) { addObstacle('log', x); if (Math.random() < 0.5) boneArc(x + 30 * SC, true); return 170 * SC; } },
  { id: 'plant', d: 1, fn(x) { addObstacle('plant', x); return 130 * SC; } },
  { id: 'bones_line', d: 1, fn(x) { return boneArc(x, false); } },
  { id: 'bones_arc', d: 1, fn(x) { return boneArc(x, true); } },
  { id: 'pow', d: 1, tag: 'pow', fn(x) {
      const r = Math.random();
      addPow(r < 0.4 ? 'helmet' : r < 0.72 ? 'magnet' : 'boost', x);
      return 90 * SC;
  } },
  { id: 'hole', d: 2, fn(x) {
      const w = (130 + Math.random() * 55) * SC + G.speed * 0.08;
      G.holes.push({ x, w });
      if (Math.random() < 0.55) boneArc(x + w * 0.15, true);
      return w;
  } },
  { id: 'branch', d: 2, fn(x) { addBranch(x); return 200 * SC; } },
  { id: 'gold', d: 2, fn(x) { addPow('gold', x, groundY - 200 * SC); return 90 * SC; } },
  { id: 'toucan', d: 3, fn(x) { addToucan(x + 300 * SC); return 200 * SC; } },
  { id: 'double_obs', d: 3, fn(x) {
      const k1 = Math.random() < 0.5 ? 'rock' : 'plant';
      const k2 = Math.random() < 0.5 ? 'log' : 'rock';
      addObstacle(k1, x);
      const gap = 230 * SC + G.speed * 0.26;
      addObstacle(k2, x + gap);
      return gap + 160 * SC;
  } },
  { id: 'hole_rock', d: 3, fn(x) {
      const w = 140 * SC + G.speed * 0.08;
      G.holes.push({ x, w });
      const gap = 200 * SC + G.speed * 0.24;
      addObstacle('rock', x + w + gap);
      return w + gap + 140 * SC;
  } },
  { id: 'arc_hole', d: 3, fn(x) {
      const w = (160 + Math.random() * 50) * SC + G.speed * 0.10;
      G.holes.push({ x, w });
      boneArc(x - 30 * SC, true);
      return w + 40 * SC;
  } },
  { id: 'jump_slide', d: 4, fn(x) {
      addObstacle('rock', x);
      const gap = 300 * SC + G.speed * 0.40;
      addBranch(x + gap);
      return gap + 220 * SC;
  } },
  { id: 'slide_jump', d: 4, fn(x) {
      addBranch(x);
      const gap = 310 * SC + G.speed * 0.40;
      const w = 130 * SC + G.speed * 0.08;
      G.holes.push({ x: x + gap, w });
      return gap + w + 50 * SC;
  } },
  { id: 'double_hole', d: 4, fn(x) {
      const w = 120 * SC + G.speed * 0.06;
      const gap = 235 * SC + G.speed * 0.26;
      G.holes.push({ x, w });
      G.holes.push({ x: x + w + gap, w });
      boneArc(x + w + gap * 0.28, true);
      return w * 2 + gap + 60 * SC;
  } },
  { id: 'toucan_rock', d: 4, fn(x) {
      addObstacle('rock', x);
      const gap = 390 * SC + G.speed * 0.30;
      addToucan(x + gap);
      return gap + 180 * SC;
  } },
  { id: 'triple', d: 5, fn(x) {
      const gap = 245 * SC + G.speed * 0.26;
      addObstacle('rock', x);
      addObstacle('plant', x + gap);
      addObstacle('log', x + gap * 2);
      boneArc(x + gap * 0.4, true);
      return gap * 2 + 170 * SC;
  } },
  { id: 'long_hole', d: 5, fn(x) {
      const w = (220 + Math.random() * 55) * SC + G.speed * 0.13;
      G.holes.push({ x, w });
      boneArc(x + w * 0.1, true);
      return w + 60 * SC;
  } },
  { id: 'branch_tunnel', d: 5, fn(x) {
      addBranch(x);
      const gap = 340 * SC + G.speed * 0.32;
      addBranch(x + gap);
      return gap + 220 * SC;
  } },
  // ---- 신규 장애물 청크 (stg: 등장 스테이지 제한) ----
  { id: 'snake', d: 2, fn(x) { addSnake(x); if (Math.random() < 0.4) boneArc(x + 20 * SC, true); return 160 * SC; } },
  { id: 'mud', d: 2, stg: [0, 1], fn(x) { addMud(x); boneArc(x + 10 * SC, true); return 190 * SC; } },
  { id: 'bees', d: 3, fn(x) { addBees(x + 60 * SC); return 170 * SC; } },
  { id: 'boulder', d: 3, stg: [1, 2], fn(x) { addBoulder(x + 170 * SC); return 220 * SC; } },
  { id: 'monkey', d: 4, stg: [1], fn(x) { addMonkey(x + 80 * SC); return 230 * SC; } },
  { id: 'wisp', d: 4, stg: [2], fn(x) { addWisp(x + 40 * SC); return 170 * SC; } },
  { id: 'snake_branch', d: 4, fn(x) {
      addSnake(x);
      const gap = 300 * SC + G.speed * 0.38;
      addBranch(x + gap);
      return gap + 220 * SC;
  } },
  { id: 'mud_rock', d: 3, stg: [0, 1], fn(x) {
      addMud(x);
      const gap = 200 * SC + G.speed * 0.22;
      addObstacle('rock', x + 150 * SC + gap);
      return 150 * SC + gap + 140 * SC;
  } },
  { id: 'boulder_hole', d: 5, stg: [1, 2], fn(x) {
      const w = 130 * SC + G.speed * 0.07;
      G.holes.push({ x, w });
      addBoulder(x + w + 320 * SC + G.speed * 0.28);
      return w + 320 * SC + G.speed * 0.28 + 150 * SC;
  } },
  { id: 'bees_rock', d: 5, fn(x) {
      addObstacle('rock', x);
      const gap = 340 * SC + G.speed * 0.30;
      addBees(x + gap);
      return gap + 170 * SC;
  } },
  // ---------- 신규 장애물 청크 ----------
  { id: 'crab', d: 2, fn(x) { addCrab(x + 90 * SC); return 170 * SC; } },
  { id: 'cactus', d: 3, fn(x) { addObstacle('cactus', x); if (Math.random() < 0.4) boneArc(x + 10 * SC, true); return 150 * SC; } },
  { id: 'frog', d: 3, fn(x) { addFrog(x + 70 * SC); return 180 * SC; } },
  { id: 'hedge', d: 3, fn(x) { addHedge(x + 160 * SC); return 200 * SC; } },
  { id: 'scare', d: 2, fn(x) { addObstacle('scarecrow', x); if (Math.random() < 0.4) boneArc(x + 20 * SC, true); return 150 * SC; } },
  { id: 'trash', d: 2, fn(x) { addObstacle('trashcan', x); return 150 * SC; } },
  { id: 'cone_row', d: 2, fn(x) {
      const g = 150 * SC + G.speed * 0.10;
      addObstacle('cone', x); addObstacle('cone', x + g); addObstacle('cone', x + g * 2);
      return g * 2 + 100 * SC;
  } },
  { id: 'geyser', d: 3, fn(x) { addGeyser(x); if (Math.random() < 0.5) boneArc(x - 20 * SC, true); return 180 * SC; } },
  { id: 'geyser_pair', d: 5, fn(x) {
      addGeyser(x);
      const g = 330 * SC + G.speed * 0.30;
      addGeyser(x + g);
      G.obstacles[G.obstacles.length - 1].t = G.obstacles[G.obstacles.length - 2].t + 1.2; // 위상 엇갈림
      return g + 180 * SC;
  } },
  { id: 'stomp', d: 3, fn(x) { addStomper(x); return 170 * SC; } },
  { id: 'pend', d: 3, fn(x) { addPend(x + 50 * SC); return 240 * SC; } },
  { id: 'wall', d: 3, fn(x) { addWall(x); if (Math.random() < 0.5) boneArc(x - 30 * SC, true); return 210 * SC; } },
  { id: 'wall_hole', d: 5, fn(x) {
      addWall(x);
      const g = 290 * SC + G.speed * 0.36;
      const w = 128 * SC + G.speed * 0.07;
      G.holes.push({ x: x + g, w });
      return g + w + 60 * SC;
  } },
  { id: 'ball', d: 3, fn(x) { addBall(x + 170 * SC); return 220 * SC; } },
  { id: 'spring_fun', d: 1, fn(x) {
      addSpring(x);
      // 높은 뼈다귀 보상 아치 (버섯 도약으로만 닿음)
      const n = 5;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        G.bones.push({ x: x + 100 * SC + i * 62 * SC, y: groundY - 260 * SC - Math.sin(t * Math.PI) * 70 * SC, t: Math.random() * 6 });
      }
      return 420 * SC;
  } },
  // 튜토리얼 전용
  { id: 'branch_intro', d: 9, fn(x) {
      addBranch(x);
      G.hints.push({ x: x + 40 * SC, y: groundY - 260 * SC, txt: '왼쪽 꾹! ⬇ 슬라이드' });
      return 220 * SC;
  } },
];
const CHUNK_MAP = {}; CHUNKS.forEach(c => CHUNK_MAP[c.id] = c);
// 난이도 밴드: 10,000m 여정 전체에 걸쳐 상승
function bandFor(m) { return m < 600 ? 1 : m < 2200 ? 2 : m < 4500 ? 3 : m < 7000 ? 4 : 5; }
function spawnChunk() {
  const x = W + 80 * SC;
  let chunk;
  if (G.queue.length) {
    chunk = CHUNK_MAP[G.queue.shift()];
    if (chunk.id === 'rock' && totals.runs === 0) {
      G.hints.push({ x: x + 10 * SC, y: groundY - 250 * SC, txt: '오른쪽 탭! ⬆ 점프' });
    }
  } else {
    let maxD = bandFor(G.worldX);
    // 체크포인트 이어달리기 직후 웜업 (퍼크 없이 최고 밴드 직행 방지)
    if (runFrom > 0 && G.worldX - runFrom < 250) maxD = Math.min(maxD, 3);
    const stageSet = STAGES[Math.min(G.stage, 9)].set;
    let pool = CHUNKS.filter(c =>
      c.d <= maxD && c.id !== G.lastChunk && (c.tag !== 'pow' || G.powCd <= 0) &&
      stageSet.indexOf(c.id) >= 0);
    if (!pool.length) pool = CHUNKS.filter(c => c.d <= 1 && c.id !== G.lastChunk);
    let total = 0;
    const weights = pool.map(c => {
      let w = c.d === maxD ? 2.2 : c.d === maxD - 1 ? 1.6 : 1;
      if (c.tag === 'pow') w = 0.9;
      if (c.id === 'gold') w = 0.5;
      if (c.id.indexOf('bones') === 0) w = 0.8;
      total += w; return w;
    });
    let r = Math.random() * total;
    chunk = pool[0];
    for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) { chunk = pool[i]; break; } }
  }
  const w = chunk.fn(x);
  G.lastChunk = chunk.id;
  if (chunk.tag === 'pow') G.powCd = 5 + (Math.random() * 4 | 0); else G.powCd--;
  const gap = G.speed * (0.48 + Math.random() * 0.40) + 165 * SC;
  G.spawnPx = w + gap;
}

// ---------- 충돌 ----------
function rectsHit(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function playerBox() {
  const p = G.player;
  if (p.sliding) return { x: p.x - p.w * 0.28, y: p.y - p.h * 0.38, w: p.w * 0.58, h: p.h * 0.34 };
  return { x: p.x - p.w * 0.22, y: p.y - p.h * 0.72, w: p.w * 0.44, h: p.h * 0.68 };
}
function obstacleBoxes(o) {
  if (o.kind === 'branch') {
    const barH = o.dh * 0.30;
    const barTop = o.barBottom - barH;
    // 바 뒤쪽(잎사귀)은 관대하게 — 슬라이드를 조금 일찍 풀어도 안 걸리게
    return [
      { x: o.x + o.dw * 0.10, y: barTop, w: o.dw * 0.66, h: barH },
      { x: o.x + o.dw * 0.36, y: 0, w: o.dw * 0.28, h: Math.max(0, barTop) },
    ];
  }
  if (o.kind === 'toucan') {
    const y = o.y0 + Math.sin(o.t * 3) * 10 * SC;
    return [{ x: o.x + o.dw * 0.18, y: y - o.dh * 0.30, w: o.dw * 0.64, h: o.dh * 0.60 }];
  }
  if (o.kind === 'snake') {
    const up = Math.floor(o.t * 1.6) % 2 === 1; // 머리 올린 프레임은 살짝 높음
    const hh = o.dh * (up ? 0.62 : 0.45);
    return [{ x: o.x + o.dw * 0.16, y: groundY - hh, w: o.dw * 0.68, h: hh }];
  }
  if (o.kind === 'boulder') {
    return [{ x: o.x + o.dw * 0.14, y: groundY - o.dh * 0.74, w: o.dw * 0.72, h: o.dh * 0.72 }];
  }
  if (o.kind === 'bees') {
    const y = o.y0 + Math.sin(o.t * 2.4) * 26 * SC;
    return [{ x: o.x + o.dw * 0.12, y: y - o.dh * 0.34, w: o.dw * 0.76, h: o.dh * 0.68 }];
  }
  if (o.kind === 'mud') {
    return []; // 진흙은 밟기 판정만 (충돌 데미지 없음)
  }
  if (o.kind === 'monkey') {
    return [{ x: o.x + o.dw * 0.18, y: groundY - o.dh * 0.72, w: o.dw * 0.64, h: o.dh * 0.72 }];
  }
  if (o.kind === 'wisp') {
    const y = o.y0 + Math.sin(o.t * 4.2) * 44 * SC;
    return [{ x: o.x + o.dw * 0.15, y: y - o.dh * 0.35, w: o.dw * 0.7, h: o.dh * 0.7 }];
  }
  if (o.kind === 'crab') {
    return [{ x: o.x + o.dw * 0.16, y: groundY - o.dh * 0.60, w: o.dw * 0.68, h: o.dh * 0.60 }];
  }
  if (o.kind === 'hedge') {
    return [{ x: o.x + o.dw * 0.15, y: groundY - o.dh * 0.62, w: o.dw * 0.70, h: o.dh * 0.62 }];
  }
  if (o.kind === 'frog') {
    return [{ x: o.x + o.dw * 0.18, y: o.y - o.dh * 0.60, w: o.dw * 0.64, h: o.dh * 0.60 }];
  }
  if (o.kind === 'ball') {
    return [{ x: o.x + o.dw * 0.12, y: o.y - o.dw * 0.76, w: o.dw * 0.76, h: o.dw * 0.76 }];
  }
  if (o.kind === 'geyser') {
    const ph = o.t % 2.4;
    if (ph > 0.85 && ph < 1.75) { // 분출 중에만 위험
      return [{ x: o.x + o.dw * 0.24, y: groundY - 152 * SC, w: o.dw * 0.52, h: 152 * SC }];
    }
    return [];
  }
  if (o.kind === 'stomper') {
    if (o.falling) return [{ x: o.x + o.dw * 0.12, y: o.fy - o.dw * 0.72, w: o.dw * 0.76, h: o.dw * 0.72 }];
    if (o.landed > 0.3) return [{ x: o.x + o.dw * 0.15, y: groundY - o.dw * 0.5, w: o.dw * 0.7, h: o.dw * 0.5 }];
    return [];
  }
  if (o.kind === 'pend') {
    const ang = Math.sin(o.t * 2.35) * 0.85;
    const bx = o.x + Math.sin(ang) * o.len;
    const by = o.pivY + Math.cos(ang) * o.len;
    return [{ x: bx - 22 * SC, y: by - 22 * SC, w: 44 * SC, h: 44 * SC }];
  }
  if (o.kind === 'wall') {
    return [{ x: o.x + o.dw * 0.18, y: groundY - o.dh, w: o.dw * 0.64, h: o.dh }];
  }
  if (o.kind === 'spring') return []; // 무해
  const def = OBS_DEF[o.kind];
  return [{
    x: o.x + o.dw * def.hbx, y: groundY - o.dh * def.hby,
    w: o.dw * (1 - def.hbx * 2), h: o.dh * def.hby,
  }];
}

// ---------- 피격/포획/부활 ----------
function hitObstacle(kind) {
  const p = G.player;
  if (p.invuln > 0 || G.feverT > 0 || G.boostT > 0) return;
  if (G.shield) {
    G.shield = false;
    p.invuln = 1.2;
    sfx.shield(); vib(40);
    sparkle(p.x, p.y - p.h * 0.5, 14, '255,215,120');
    pop(p.x, p.y - p.h * 1.1, '헬멧이 지켜줬다! ⛑️', '#ffd75e', true);
    return;
  }
  p.invuln = 1.5;
  G.combo = 0;
  G.hitCnt++;
  G.hitByKind[kind || '?'] = (G.hitByKind[kind || '?'] || 0) + 1;
  G.noHitDist = G.worldX;
  G.tigerDist = Math.max(0, G.tigerDist - (bikeId === 'tank' ? 13 : 26));
  G.slowRecover = 0.85;
  G.shake = 0.45; G.flash = 0.35;
  G.hitStop = 0.09;
  ring(p.x, p.y - p.h * 0.5, '255,120,80');
  sfx.hit(); vib(80);
  showToast('부딪혔다멍! 🐯 호랑이가 가까워진다!');
  if (G.tigerDist <= 0) { G.deathBy = 'tiger'; startCaught(); }
}
function startCaught() {
  if (state !== ST.RUN) return;
  state = ST.CAUGHT;
  G.caughtT = 0;
  G.tiger.lunge = 1;
  G.hitStop = 0.16; G.flash = 0.55; G.shake = 0.6;
  const p = G.player;
  ring(p.x, p.y - p.h * 0.5, '255,90,60');
  sparkle(p.x, p.y - p.h * 0.5, 18, '255,150,90');
  camPunch(1.32, 0.9); slowmo(0.42, 0.45);
  cutIn('faceTiger', '잡았다 어흥!!', '#ff8a66');
  sfx.caught(); vib([60, 40, 120]);
}
function offerRevive() {
  state = ST.REVIVE;
  G.reviveT = 3.5;
  ui.revive.classList.remove('hidden');
  ui.reviveCnt.textContent = '4';
}
function doRevive() {
  G.reviveUsed = true;
  ui.revive.classList.add('hidden');
  const p = G.player;
  p.falling = false; p.fastFall = false; p.y = groundY; p.vy = 0;
  p.onGround = true; p.jumps = 0; p.invuln = 2.2; p.sliding = false;
  G.tigerDist = 70;
  G.tiger.lunge = 0;
  G.obstacles = []; G.holes = []; G.slowRecover = 0;
  G.speed = G.baseSpeed * 0.7;
  G.spawnPx = 700 * SC;
  state = ST.RUN;
  camPunch(1.35, 0.8); slowmo(0.32, 0.4);
  cutIn('faceShiba', '포기란 없다멍!!', '#8ff0ff');
  sfx.revive(); vib(30);
  sparkle(p.x, p.y - p.h * 0.5, 20, '255,240,150');
  showToast('🦴 다시 달린다멍!! 포기란 없다!');
  updateHUD(true);
}

// ---------- 피버/파워업 ----------
function startFever() {
  G.feverT = 6.5;
  G.fever = 1;
  G.feverCnt++;
  G.flash = 0.22;
  const p = G.player;
  ring(p.x, p.y - p.h * 0.5, '255,220,120', 420);
  sparkle(p.x, p.y - p.h * 0.5, 20, '255,220,120');
  camPunch(1.30, 0.7); slowmo(0.35, 0.28);
  cutIn('faceShiba', '피버 타임!! 🌈');
  sfx.fever(); vib(40);
  if (G.feverCnt >= 3) unlock('fever3');
}
function collectPow(w) {
  const p = G.player;
  if (w.kind === 'helmet') {
    G.shield = true;
    sfx.power(); pop(w.x, w.y - 30 * SC, '⛑️ 안전모 장착!', '#8ff0ff', true);
  } else if (w.kind === 'magnet') {
    G.magT = 8;
    sfx.power(); pop(w.x, w.y - 30 * SC, '🧲 뼈다귀 자석!', '#ffb0f0', true);
  } else if (w.kind === 'boost') {
    G.boostT = G.perks.boostLong ? 3.5 : 2.3;
    G.tigerDist = Math.min(100, G.tigerDist + 10);
    camPunch(1.22, 0.5);
    sfx.boost(); vib(50); pop(w.x, w.y - 30 * SC, '🚀 부스터!!', '#ffcf5e', true);
  } else if (w.kind === 'gold') {
    G.bonesCnt += 5;
    G.combo += 5;
    G.comboMax = Math.max(G.comboMax, G.combo);
    if (G.feverT <= 0) G.fever = Math.min(1, G.fever + 5 / (G.perks.feverNeed || 16));
    sfx.gold(); pop(w.x, w.y - 30 * SC, '💛 황금 뼈다귀 +5!', '#ffd75e', true);
  }
  sparkle(w.x, w.y, 16, w.kind === 'gold' ? '255,214,90' : '160,230,255');
}

// ---------- 업데이트 ----------
function update(dt) {
  const p = G.player;
  camTick(dt);

  if (state === ST.CLEAR || state === ST.FIN) {
    // 폭죽 페이즈: 월드는 정지, 이펙트만 진행
    const isFin = state === ST.FIN;
    const tKey = isFin ? 'finT' : 'clearT';
    G[tKey] += dt;
    G.tiger.anim += dt * 8;
    p.anim += dt * 8;
    if (Math.random() < dt * (isFin ? 24 : 15)) fireworks();
    fxTick(dt);
    if (!isFin && G.clearT > 1.6 && !G.clearShown) { G.clearShown = true; startEvent(); }
    if (isFin && G.finT > 2.6 && !G.finShown) { G.finShown = true; showEnding(); }
    return;
  }
  if (state === ST.REVIVE) {
    G.reviveT -= dt;
    const n = Math.ceil(G.reviveT);
    if (ui.reviveCnt.textContent !== String(n)) ui.reviveCnt.textContent = n;
    if (G.reviveT <= 0) { ui.revive.classList.add('hidden'); endGame(); }
    return;
  }
  if (state === ST.CAUGHT) {
    G.caughtT += dt;
    G.tiger.anim += dt * 14;
    G.shake = Math.max(0, 0.4 - G.caughtT * 0.4);
    if (G.flash > 0) G.flash -= dt * 0.6;
    if (p.falling) { p.vy += 3200 * SC * dt; p.y += p.vy * dt; }
    if (G.caughtT > 1.0) {
      if (!G.reviveUsed && G.worldX > 120) offerRevive();
      else endGame();
    }
    return;
  }
  if (state !== ST.RUN) return;

  // 속도 (피버/부스터 배속) — 레이싱 체감 상향
  const ramp = 6.3 * SC;
  G.baseSpeed = Math.min(G.maxSpeed, G.baseSpeed + ramp * dt);
  let target = G.baseSpeed * (bike().speedMult || 1);
  if (G.feverT > 0) target = G.baseSpeed * 1.42;
  if (G.boostT > 0) target = G.baseSpeed * 1.8;
  if (G.slowRecover > 0) { G.slowRecover -= dt; G.speed = G.baseSpeed * 0.55; }
  else G.speed += (target - G.speed) * Math.min(1, dt * 3);
  const dx = G.speed * dt;
  G.worldX += dx / (42 * SC);
  G.score = G.worldX; // 점수 = 순수 거리(m) — 표시 미터와 스테이지 경계 완전 일치

  // 완주!
  if (G.worldX >= TOTAL_M) { startFinish(); return; }

  // 스테이지 클리어 (1,000m마다 — 폭죽 + 퍼크 선택 이벤트)
  const stg = Math.min(9, Math.floor(G.worldX / STAGE_LEN));
  if (stg !== G.stage) { startStageClear(stg); return; }
  if (G.stageFade < 1) G.stageFade = Math.min(1, G.stageFade + dt * 0.8);

  // 소나기 이벤트
  if (G.rainT > 0) G.rainT -= dt;
  else if (G.worldX >= G.rainNext) {
    G.rainNext = G.worldX + 700 + Math.random() * 600;
    if (Math.random() < 0.65) {
      G.rainT = 7;
      G.flash = Math.max(G.flash, 0.18);
      showToast('☔ 소나기다! 정글이 촉촉해진다~');
      sfx.roar(); // 천둥 대용 저음
    }
  }

  // 최고 기록 돌파 연출 (달리는 중 실시간)
  if (!G.bestBroken && best > 0 && G.worldX > best) {
    G.bestBroken = true;
    showBanner('🏆 신기록 돌파!!');
    ring(p.x, p.y - p.h * 0.5, '255,215,90', 420);
    sfx.record(); vib([30, 30, 80]);
  }

  // 마일스톤 (1,000m 배수는 스테이지 세리머니와 겹치므로 조용히 적용)
  if (G.worldX >= G.nextMilestone) {
    const silent = G.nextMilestone % STAGE_LEN === 0;
    G.nextMilestone += 500;
    G.baseSpeed = Math.min(G.maxSpeed, G.baseSpeed + 21 * SC);
    G.tigerDist = Math.min(100, G.tigerDist + 6);
    if (!silent) {
      sfx.power();
      showToast(`🏫 ${Math.floor(G.worldX)}m! 유치원이 가까워진다!`);
      G.signs.push({ x: W + 60 * SC });
    }
  }

  // 도전과제 (거리/노히트)
  if (G.worldX >= 500) unlock('m500');
  if (G.worldX >= 1000) unlock('m1000');
  if (G.worldX >= 2000) unlock('m2000');
  if (G.worldX >= 3000) unlock('m3000');
  if (G.worldX - G.noHitDist >= 700) unlock('nohit700');

  // 퍼크: 슬라이드 터보 / 호랑이 지구력
  if (G.perks.slideTurbo && p.sliding && G.feverT <= 0) {
    G.fever = Math.min(1, G.fever + dt * 0.045);
    if (G.fever >= 1) startFever();
  }

  // 피버/파워업 타이머
  if (G.feverT > 0) {
    G.feverT -= dt;
    G.fever = Math.max(0, G.feverT / 6.5);
    G.tigerDist = Math.min(100, G.tigerDist + 8 * dt);
    if (Math.random() < dt * 40) rainbow(p.x, p.y);
    if (G.feverT <= 0) { G.fever = 0; sfx.feverEnd(); }
  }
  if (G.magT > 0) G.magT -= dt;
  if (G.boostT > 0) {
    G.boostT -= dt;
    if (Math.random() < dt * 30) rainbow(p.x, p.y);
  }

  // 호랑이 게이지 회복
  G.tigerDist = Math.min(100, G.tigerDist + (G.perks.tigerRegen ? 2.3 : 1.5) * dt);

  // 호랑이 으르렁 경고 (근접할수록 잦게, 대사 로테이션)
  if (G.tigerDist < 25) {
    G.roarT -= dt;
    if (G.roarT <= 0) {
      G.roarT = G.tigerDist < 12 ? 2.0 : 2.8;
      sfx.roar(); vib(90);
      const lines = ['으르렁!! 🐯', '바로 뒤다!!', '숨결이 느껴진다…!', '어흥!! 잡힌다!!'];
      pop(p.x - p.w * 1.3, groundY - p.h * 1.2, lines[(Math.random() * lines.length) | 0], '#ff7a5c', true);
    }
  }

  // 심장박동 (긴박 오디오 레이어 — 근접할수록 빨라짐)
  if (G.tigerDist < 45) {
    G.heartT = (G.heartT || 0) - dt;
    if (G.heartT <= 0) {
      G.heartT = G.tigerDist < 12 ? 0.42 : G.tigerDist < 25 ? 0.62 : 0.95;
      sfx.heart();
      if (G.tigerDist < 12) vib(18);
    }
  }

  // 호랑이 발톱 스와이프 (초근접 위협 — 시각 협박, 실피해 없음)
  if (G.tigerDist < 12) {
    G.swipeT = (G.swipeT === undefined ? 1.2 : G.swipeT) - dt;
    if (G.swipeT <= 0) {
      G.swipeT = 2.1 + Math.random() * 0.9;
      G.tiger.swipe = 0.5;
      sfx.swipeAtk(); vib([30, 30, 50]);
      G.shake = Math.max(G.shake, 0.22);
    }
  } else G.swipeT = 1.2;
  if (G.tiger.swipe > 0) G.tiger.swipe -= dt;

  // 위기 탈출 릴리프 모먼트
  if (G.tigerDist < 18) G.wasClose = true;
  else if (G.wasClose && G.tigerDist > 45) {
    G.wasClose = false;
    sfx.relief();
    pop(p.x, p.y - p.h * 1.25, '따돌렸다!! 😮‍💨', '#9fffb0', true);
    showToast('휴… 호랑이가 멀어졌다!');
  }

  // 로우라이더: 머리 위 장애물 접근 시 자동 숙이기
  let autoDuck = false;
  if (bikeId === 'low' && p.onGround && !p.falling) {
    for (const o of G.obstacles) {
      if (o.kind !== 'branch' && o.kind !== 'toucan' && o.kind !== 'bees' && o.kind !== 'wisp') continue;
      const d = o.x - p.x;
      if (d > -(o.dw + p.w) && d < p.w * 1.6) { autoDuck = true; break; }
    }
  }

  // 슬라이드 상태
  const wantSlide = slideHeld() || p.slideLock > 0 || autoDuck;
  if (p.slideLock > 0) p.slideLock -= dt;
  if (p.onGround && !p.falling) {
    const was = p.sliding;
    p.sliding = wantSlide;
    if (p.sliding && !was) {
      sfx.slide();
      dust(p.x + p.w * 0.2, groundY, 5);
      G.slideCnt++;
      totals.slides++;
      if (totals.slides >= 50) unlock('slide50');
    }
  } else p.sliding = false;

  // 플레이어 물리
  p.anim += dt * (8 + G.speed / (90 * SC));
  if (!p.onGround || p.falling) {
    p.vy += 2850 * SC * dt;
    p.y += p.vy * dt;
    if (!p.falling && p.vy > 0 && p.y >= groundY) {
      if (overHole(p.x) && bikeId !== 'wing') {
        p.falling = true;
      } else {
        p.y = groundY; p.vy = 0; p.onGround = true; p.jumps = 0;
        p.squash = p.squashDur = p.fastFall ? 0.16 : 0.11;   // 착지 스쿼시 (내려찍기는 더 강하게)
        if (p.fastFall) { G.shake = Math.max(G.shake, 0.18); dust(p.x, groundY, 10); }
        p.fastFall = false;
        dust(p.x, groundY, 6);
      }
    }
    if (p.falling && p.y - p.h > H + 40) { G.deathBy = 'hole'; startCaught(); p.falling = false; G.caughtT = 0.7; }
  } else {
    if (overHole(p.x)) {
      if (bikeId === 'wing') {
        // 날개 핀핀: 구덩이 위 활공
        p.gliding = true;
        if (Math.random() < dt * 24) sparkle(p.x - p.w * 0.3, p.y + 4 * SC, 1, '190,230,255');
      } else { p.onGround = false; p.falling = true; p.sliding = false; p.vy = 120 * SC; sfx.hit(); }
    } else p.gliding = false;
  }
  if (p.invuln > 0) p.invuln -= dt;
  if (p.squash > 0) p.squash -= dt;

  // 표시 각도 보간 (공중 회전·지상 가속 린 — 스냅 없는 부드러운 모션)
  let targAng = 0;
  if (!p.onGround && !p.sliding) targAng = Math.max(-0.20, Math.min(0.32, p.vy / (2800 * SC)));
  else if (p.sliding) targAng = -0.04;
  else targAng = Math.max(-0.04, Math.min(0.10, (G.speed - G.baseSpeed) / (G.maxSpeed * 1.6)));
  p.dispAng = (p.dispAng || 0) + (targAng - (p.dispAng || 0)) * Math.min(1, dt * 11);

  // 배너 타이머
  if (G.banner) { G.banner.t += dt; if (G.banner.t > G.banner.life) G.banner = null; }

  // 오브젝트 이동
  for (const o of G.obstacles) {
    o.x -= dx;
    if (o.kind === 'toucan') { o.x -= 105 * SC * dt; o.t += dt; }
    else if (o.kind === 'boulder') { o.x -= 150 * SC * dt; o.rot -= dt * 7; }
    else if (o.kind === 'snake' || o.kind === 'bees' || o.kind === 'wisp' || o.kind === 'geyser' || o.kind === 'pend') o.t += dt;
    else if (o.kind === 'crab') { o.x -= 55 * SC * dt; o.t += dt; }
    else if (o.kind === 'hedge') { o.x -= 135 * SC * dt; o.rot -= dt * 10; }
    else if (o.kind === 'frog') {
      o.hopT -= dt;
      if (o.hopT <= 0 && o.y >= groundY) { o.vy = -640 * SC; sfx.slide(); dust(o.x + o.dw / 2, groundY, 3); }
      if (o.vy !== 0 || o.y < groundY) {
        o.vy += 2600 * SC * dt;
        o.y += o.vy * dt;
        o.x -= 95 * SC * dt; // 점프 중 전진
        if (o.y >= groundY) { o.y = groundY; o.vy = 0; o.hopT = 1.3 + Math.random() * 0.7; dust(o.x + o.dw / 2, groundY, 3); }
      }
    }
    else if (o.kind === 'ball') {
      o.vy += 2100 * SC * dt;
      o.y += o.vy * dt;
      o.x -= 60 * SC * dt;
      if (o.y >= groundY - 2) { o.y = groundY - 2; o.vy = -(640 + Math.random() * 100) * SC; dust(o.x + o.dw / 2, groundY, 2); }
    }
    else if (o.kind === 'stomper') {
      if (o.landed < 0 && !o.falling && o.x - p.x < 430 * SC && o.x - p.x > -40 * SC) o.falling = true;
      if (o.falling) {
        o.vy += 3000 * SC * dt;
        o.fy += o.vy * dt;
        if (o.fy >= groundY) {
          o.fy = groundY; o.falling = false; o.landed = 0.5;
          dust(o.x + o.dw / 2, groundY, 8);
          G.shake = Math.max(G.shake, 0.14);
          sfx.hit();
        }
      }
      if (o.landed > 0) { o.landed -= dt; if (o.landed <= 0) o.dead = true; }
    }
    else if (o.kind === 'spring') {
      if (o.t > 0) o.t -= dt;
      // 밟으면 크게 도약 (무해)
      const pb0 = playerBox();
      if (p.vy >= -50 && pb0.x < o.x + o.dw && pb0.x + pb0.w > o.x && p.y > groundY - 70 * SC) {
        if (o.t <= 0) {
          o.t = 0.4;
          p.vy = -1500 * SC; p.onGround = false; p.jumps = 1; p.fastFall = false; p.sliding = false;
          sfx.djump(); blip && 0;
          sparkle(o.x + o.dw / 2, groundY - 30 * SC, 10, '190,255,190');
          pop(p.x, p.y - p.h * 1.2, '슝~!! 🍄', '#b8ffb0');
        }
      }
    }
    else if (o.kind === 'monkey') {
      o.t += dt;
      // 플레이어 접근 시 코코넛 투척 (한 번)
      if (!o.thrown && o.x - p.x < 760 * SC && o.x - p.x > 200 * SC) {
        o.thrown = true;
        G.shots.push({
          x: o.x + o.dw * 0.35, y: groundY - o.dh * 0.9,
          vx: -(G.speed * 0.35 + 260 * SC), vy: -430 * SC, r: 17 * SC,
        });
        pop(o.x + o.dw * 0.4, groundY - o.dh * 1.05, '이거나 받아라! 🥥', '#ffd9a8');
      }
    }
    else if (o.kind === 'mud') {
      if (o.mudCd > 0) o.mudCd -= dt;
      // 진흙 밟기: 잠깐 감속 (데미지 없음)
      if (p.onGround && !p.falling && o.mudCd <= 0 &&
          p.x > o.x && p.x < o.x + o.dw) {
        o.mudCd = 0.8;
        G.slowRecover = Math.max(G.slowRecover, 0.5);
        dust(p.x, groundY, 8);
        pop(p.x, p.y - p.h * 1.05, '질퍽질퍽…! 🟤', '#d8b48a');
        sfx.slide();
      }
    }
  }
  // 투사체 (코코넛)
  for (const s of G.shots) {
    s.x += s.vx * dt - dx * 0.15;
    s.vy += 2400 * SC * dt;
    s.y += s.vy * dt;
    s.rot = (s.rot || 0) - dt * 9;
    if (s.y >= groundY - s.r * 0.4 && !s.dead) {
      s.dead = true;
      dust(s.x, groundY, 6);
      sfx.hit();
    }
    // 플레이어 명중
    if (!s.dead && p.invuln <= 0) {
      const pb0 = playerBox();
      const cx = Math.max(pb0.x, Math.min(s.x, pb0.x + pb0.w));
      const cy = Math.max(pb0.y, Math.min(s.y, pb0.y + pb0.h));
      if ((s.x - cx) ** 2 + (s.y - cy) ** 2 < s.r * s.r) { s.dead = true; hitObstacle('coconut'); }
    }
  }
  G.shots = G.shots.filter(s => !s.dead && s.x > -60 && s.y < H + 80);
  for (const h of G.holes) h.x -= dx;
  for (const b of G.bones) { b.x -= dx; b.t += dt * 4; }
  for (const w of G.pows) { w.x -= dx; w.t += dt * 3; }
  for (const s of G.signs) {
    s.x -= dx;
    if (!s.passed && s.x < p.x) {   // 표지판 통과 — 나뭇잎 축포
      s.passed = true;
      sparkle(s.x, groundY - 110 * SC, 14, '140,220,90');
      sparkle(s.x, groundY - 130 * SC, 8, '255,232,140');
    }
  }
  for (const t of G.hints) t.x -= dx;
  G.obstacles = G.obstacles.filter(o => o.x + o.dw > -80 && !o.dead);
  G.holes = G.holes.filter(h => h.x + h.w > -60);
  G.bones = G.bones.filter(b => b.x > -60 && !b.got);
  G.pows = G.pows.filter(w => w.x > -60 && !w.got);
  G.signs = G.signs.filter(s => s.x > -160 * SC);
  G.hints = G.hints.filter(t => t.x > -300 * SC);

  // 자석/피버/자석 코팅 퍼크: 뼈 끌어오기
  if (G.magT > 0 || G.feverT > 0 || G.perks.miniMag) {
    const R = G.feverT > 0 ? 280 * SC : G.magT > 0 ? 200 * SC : 120 * SC;
    for (const b of G.bones) {
      const ddx = p.x - b.x, ddy = (p.y - p.h * 0.5) - b.y;
      const d2 = ddx * ddx + ddy * ddy;
      if (d2 < R * R) {
        const k = Math.min(1, dt * 9);
        b.x += ddx * k; b.y += ddy * k;
      }
    }
  }

  // 스폰
  G.spawnPx -= dx;
  if (G.spawnPx <= 0) spawnChunk();

  // 충돌 — 장애물 + 니어미스 추적
  const pb = playerBox();
  for (const o of G.obstacles) {
    const boxes = obstacleBoxes(o);
    if (!boxes.length) continue; // 진흙 등 밟기 전용
    let hitNow = false;
    for (const ob of boxes) {
      if (rectsHit(pb, ob)) { hitNow = true; break; }
    }
    if (hitNow) {
      // 탱크 핀핀: 날아다니는 적을 튕겨냄
      if (bikeId === 'tank' && (o.kind === 'toucan' || o.kind === 'bees' || o.kind === 'wisp')) {
        if (!o.hitDone) {
          o.hitDone = true; o.dead = true;
          sparkle(o.x + o.dw * 0.5, (o.y0 || groundY - 100 * SC), 14, '200,255,180');
          pop(p.x, p.y - p.h * 1.15, '튕겨냈다! 🛡️', '#b8ffb0');
          sfx.shield();
        }
        continue;
      }
      if (!o.hitDone) { o.hitDone = true; hitObstacle(o.kind); }
    } else if (!o.hitDone && !o.nearDone) {
      // x축 겹칠 때 세로 간격 추적
      const mb = boxes[0];
      if (pb.x < mb.x + mb.w && pb.x + pb.w > mb.x) {
        const gap = Math.max(mb.y - (pb.y + pb.h), pb.y - (mb.y + mb.h));
        if (gap >= 0) o.minClear = Math.min(o.minClear, gap);
      } else if (mb.x + mb.w < pb.x && o.minClear < 26 * SC) {
        o.nearDone = true;
        G.nearCnt++;
        if (G.feverT <= 0) G.fever = Math.min(1, G.fever + (G.perks.near2 ? 0.07 : 0.035));
        sfx.near();
        pop(p.x, p.y - p.h * 1.15, G.perks.near2 ? '아슬아슬!! 🔥' : '아슬아슬!', '#9fe8ff');
        if (G.nearCnt >= 10) unlock('near10');
      }
    }
  }

  // 수집 — 뼈다귀
  for (const b of G.bones) {
    const dxb = b.x - p.x, dyb = (b.y + Math.sin(b.t) * 6 * SC) - (p.y - p.h * 0.4);
    if (dxb * dxb + dyb * dyb < (56 * SC) ** 2) {
      b.got = true;
      G.bonesCnt++;
      totals.bones++;
      G.combo++;
      G.comboMax = Math.max(G.comboMax, G.combo);
      sfx.collect();
      ring(b.x, b.y, '255,240,180', 130);
      if (G.combo > 0 && G.combo % 10 === 0) {
        sfx.combo10();
        sparkle(p.x, p.y - p.h * 0.7, 12, '255,200,90');
        pop(p.x, p.y - p.h * 1.2, `콤보 x${G.combo}!! 🔥`, '#ffb84d', true);
      }
      if (G.feverT <= 0) {
        G.fever = Math.min(1, G.fever + 1 / (G.perks.feverNeed || 16));
        if (G.fever >= 1) startFever();
      }
      if (G.bonesCnt === 30) unlock('bones30');
      if (totals.bones >= 300) unlock('bones300');
      if (G.combo >= 15) unlock('combo15');
      if (G.bonesCnt % 8 === 0) {
        G.tigerDist = Math.min(100, G.tigerDist + (G.perks.boneUp ? 20 : 12));
        sfx.power();
        showToast('간식 파워!! 🦴 호랑이를 따돌렸다!');
      }
    }
  }

  // 수집 — 파워업
  for (const w of G.pows) {
    const dxw = w.x - p.x, dyw = (w.y + Math.sin(w.t) * 8 * SC) - (p.y - p.h * 0.4);
    if (dxw * dxw + dyw * dyw < (66 * SC) ** 2) { w.got = true; collectPow(w); }
  }

  // 호랑이 애니
  G.tiger.anim += dt * (10 + G.speed / (60 * SC));

  // 근접 위협 파티클 (거친 입김 + 흙먼지 튀김)
  if (G.tigerDist < 26) {
    const dwT = p.w * 1.9;
    const txT = p.x - ((G.tigerDist / 100) * W * 0.92 + dwT * 0.15);
    if (Math.random() < dt * 6) {
      G.parts.push({
        x: txT + dwT * 0.30, y: groundY - dwT * 0.32,
        vx: (20 + Math.random() * 40) * SC, vy: -(8 + Math.random() * 22) * SC,
        r: (5 + Math.random() * 7) * SC, life: 0.65, t: 0, c: '228,230,235', grav: 0,
      });
    }
    if (Math.random() < dt * 16) dust(txT - dwT * 0.15, groundY, 1);
  }

  // 파티클/팝업
  if (p.onGround && !p.sliding && Math.random() < dt * 18) dust(p.x - p.w * 0.3, groundY, 1);
  if (p.sliding && Math.random() < dt * 30) dust(p.x + p.w * 0.25, groundY, 1);
  for (const pa of G.parts) {
    pa.t += dt; pa.x += pa.vx * dt; pa.y += pa.vy * dt; pa.vy += 300 * SC * dt * (pa.grav !== undefined ? pa.grav : 1);
  }
  G.parts = G.parts.filter(pa => pa.t < pa.life);
  for (const pp of G.pops) { pp.t += dt; pp.y -= 46 * SC * dt; }
  G.pops = G.pops.filter(pp => pp.t < pp.life);

  // 스테이지 앰비언트 (STAGES.amb: leaf/petal/glow/pollen/mist)
  const amb = STAGES[Math.min(G.stage, 9)].amb;
  if (amb === 'glow' && Math.random() < dt * 6) {
    G.parts.push({
      x: W + 20, y: groundY - (60 + Math.random() * 380) * SC,
      vx: -(G.speed * 0.4 + Math.random() * 40 * SC), vy: (Math.random() - 0.5) * 30 * SC,
      r: (2 + Math.random() * 2.5) * SC, life: 3.5, t: 0, c: '190,255,120', grav: 0, glow: 1,
    });
  } else if ((amb === 'leaf' || amb === 'petal') && Math.random() < dt * 4.5) {
    G.parts.push({
      x: W * (0.3 + Math.random() * 0.8), y: -20,
      vx: -(G.speed * 0.3 + 30 * SC), vy: (60 + Math.random() * 50) * SC,
      r: (3 + Math.random() * 3) * SC, life: 4, t: 0,
      c: amb === 'petal' ? '255,185,215' : '110,190,80', grav: 0, leaf: 1,
    });
  } else if (amb === 'pollen' && Math.random() < dt * 5) {
    G.parts.push({
      x: W + 20, y: groundY - (40 + Math.random() * 420) * SC,
      vx: -(G.speed * 0.35 + Math.random() * 30 * SC), vy: (Math.random() - 0.3) * 26 * SC,
      r: (1.6 + Math.random() * 2) * SC, life: 3.2, t: 0, c: '255,214,140', grav: 0, glow: 1,
    });
  } else if (amb === 'mist' && Math.random() < dt * 2.2) {
    G.parts.push({
      x: W + 40, y: groundY - (20 + Math.random() * 200) * SC,
      vx: -(G.speed * 0.25 + 20 * SC), vy: -(4 + Math.random() * 10) * SC,
      r: (14 + Math.random() * 22) * SC, life: 5, t: 0, c: '225,242,250', grav: 0, mist: 1,
    });
  }
  // 소나기 빗방울
  if (G.rainT > 0) {
    for (let i = 0; i < 3; i++) {
      G.parts.push({
        x: Math.random() * (W + 100), y: -10,
        vx: -(G.speed * 0.5 + 120 * SC), vy: (900 + Math.random() * 300) * SC,
        r: 1, life: 0.9, t: 0, c: '170,205,240', grav: 0, rain: 1,
      });
    }
  }

  if (G.shake > 0) G.shake -= dt;
  if (G.flash > 0) G.flash -= dt;

  updateHUD();
}
function overHole(x) {
  for (const h of G.holes) if (x > h.x + 14 * SC && x < h.x + h.w - 14 * SC) return true;
  return false;
}

// ---------- HUD ----------
let hudCache = {};
function updateHUD(force) {
  const s = Math.floor(G.score) + 'm';
  if (force || hudCache.s !== s) { ui.score.textContent = s; hudCache.s = s; }
  const b = '🦴 ' + G.bonesCnt;
  if (force || hudCache.b !== b) { ui.bones.textContent = b; hudCache.b = b; }
  const tw = Math.round(100 - G.tigerDist) + '%';
  if (force || hudCache.tw !== tw) {
    ui.tigerFill.style.width = tw;
    // 추격 트랙: 호랑이 아이콘이 개(오른쪽 끝)를 향해 이동
    ui.tigerIcon.style.left = `calc(${Math.round(100 - G.tigerDist)}% - 10px)`;
    hudCache.tw = tw;
  }
  const tLv = G.tigerDist < 22 ? 2 : G.tigerDist < 45 ? 1 : 0;
  if (force || hudCache.tLv !== tLv) {
    ui.tigerWrap.classList.toggle('t-warn', tLv === 1);
    ui.tigerWrap.classList.toggle('t-danger', tLv === 2);
    hudCache.tLv = tLv;
  }
  const jw = Math.min(100, G.worldX / TOTAL_M * 100).toFixed(1) + '%';
  if (force || hudCache.jw !== jw) { ui.journeyFill.style.width = jw; hudCache.jw = jw; }
  const fv = Math.round(G.fever * 100) + '%';
  if (force || hudCache.fv !== fv) { ui.feverFill.style.width = fv; hudCache.fv = fv; }
  const fa = G.feverT > 0;
  if (force || hudCache.fa !== fa) { ui.feverWrap.classList.toggle('fever-on', fa); hudCache.fa = fa; }
  // 콤보 배지
  const cb = G.combo >= 3 ? `x${G.combo} 콤보` : '';
  if (force || hudCache.cb !== cb) {
    ui.combo.textContent = cb;
    ui.combo.classList.toggle('hidden', !cb);
    hudCache.cb = cb;
  }
  // 활성 효과 아이콘
  const fx = (G.shield ? '⛑️ ' : '') + (G.magT > 0 ? `🧲${Math.ceil(G.magT)} ` : '') + (G.boostT > 0 ? '🚀 ' : '');
  if (force || hudCache.fx !== fx) {
    ui.effects.textContent = fx.trim();
    ui.effects.classList.toggle('hidden', !fx.trim());
    hudCache.fx = fx;
  }
}

// ---------- 그리기 ----------
function stageBg(i) {
  const im = img[STAGES[Math.min(i, 9)].bg];
  return (im && im.width) ? im : img.bg;
}
function draw() {
  ctx.clearRect(0, 0, W, H);
  // 카메라 이동/줌아웃 시 노출되는 가장자리를 어두운 베이스로 커버
  ctx.fillStyle = '#0a1a0e';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  applyCam();
  if (G.shake > 0) ctx.translate((Math.random() - 0.5) * 14 * G.shake, (Math.random() - 0.5) * 14 * G.shake);

  drawBG();
  drawGround();
  drawSigns();
  drawBones();
  drawPows();
  drawObstacles();
  drawTiger();
  drawPlayer();
  drawParts();
  drawPops();
  drawHints();

  ctx.restore();

  // 스크린 공간 연출 (줌 영향 없음)
  drawSpeedLines();
  drawBanner();
  drawCutIn();

  // 스테이지 틴트
  const tint = STAGES[Math.min(G.stage, 9)].tint;
  if (tint) { ctx.fillStyle = tint; ctx.fillRect(0, 0, W, H); }
  // 소나기 톤
  if (G.rainT > 0) {
    const ra = Math.min(0.14, G.rainT > 6.4 ? (7 - G.rainT) * 0.25 : G.rainT < 1 ? G.rainT * 0.14 : 0.14);
    ctx.fillStyle = `rgba(60,80,110,${ra})`;
    ctx.fillRect(0, 0, W, H);
  }
  // 피버 골드 글로우
  if (G.feverT > 0) {
    const a = 0.10 + Math.sin(performance.now() * 0.012) * 0.04;
    ctx.fillStyle = `rgba(255,200,60,${a})`;
    ctx.fillRect(0, 0, W, H);
  }
  // 피격 플래시
  if (G.flash > 0) {
    ctx.fillStyle = `rgba(255,60,30,${Math.min(0.32, G.flash * 0.32)})`;
    ctx.fillRect(0, 0, W, H);
  }
  // 호랑이 근접 경고 (붉은 테두리 펄스)
  if (state === ST.RUN && G.tigerDist < 25) {
    const a = ((25 - G.tigerDist) / 25) * (0.22 + Math.sin(performance.now() * 0.008) * 0.10);
    const wg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.7);
    wg.addColorStop(0, 'rgba(255,30,10,0)');
    wg.addColorStop(1, `rgba(255,30,10,${Math.max(0, a)})`);
    ctx.fillStyle = wg;
    ctx.fillRect(0, 0, W, H);
  }
  // 비네트
  const vg = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.3, W / 2, H * 0.55, H * 0.85);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(4,14,7,0.38)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

function tileLoop(dw, scrollPx, fn) {
  const k0 = Math.floor(scrollPx / dw);
  const off = scrollPx - k0 * dw;
  for (let i = 0, bx = -off; bx < W; i++, bx += dw) fn(bx, (k0 + i) & 1);
}
function drawMirrorTile(im, bx, y, dw, dh, mirror) {
  ctx.save();
  if (mirror) { ctx.translate(bx + dw / 2, 0); ctx.scale(-1, 1); ctx.translate(-(bx + dw / 2), 0); }
  ctx.drawImage(im, bx - 0.5, y, dw + 1, dh);
  ctx.restore();
}
function drawBG() {
  const cur = stageBg(G.stage);
  if (!cur || !cur.width) { ctx.fillStyle = '#12331d'; ctx.fillRect(0, 0, W, H); return; }
  const bh = groundY + 30 * SC;
  const oh = 70 * SC; // 상단 오버스캔 (카메라 팔로우/줌아웃 대비)
  const drawOne = (im, alpha) => {
    if (!im || !im.width) return;
    const bw = bh * (im.width / im.height);
    ctx.globalAlpha = alpha;
    tileLoop(bw, G.worldX * 42 * SC * 0.30, (bx, m) => drawMirrorTile(im, bx, -oh, bw, bh + oh, m));
    ctx.globalAlpha = 1;
  };
  if (G.stageFade < 1) {
    drawOne(stageBg(G.stagePrev), 1);
    drawOne(cur, G.stageFade);
  } else drawOne(cur, 1);
  // 중경 실루엣 패럴랙스 (덤불/수풀 층 — 깊이감)
  const mw = 250 * SC;
  const si = Math.min(G.stage, 9);
  const mCol = si === 6 ? 'rgba(6,12,24,0.55)'
    : (si === 5 || si === 7) ? 'rgba(30,14,8,0.45)'
    : (si === 2) ? 'rgba(10,24,30,0.35)'
    : (si === 8 || si === 9) ? 'rgba(12,14,20,0.35)'
    : 'rgba(7,22,12,0.5)';
  ctx.fillStyle = mCol;
  tileLoop(mw, G.worldX * 42 * SC * 0.64, (bx, m) => {
    const seed = ((Math.round(bx + G.worldX * 42 * SC * 0.64) / mw) | 0);
    const h1 = 46 + ((seed * 2654435761 >>> 8) % 70);
    const h2 = 30 + ((seed * 40503 >>> 4) % 52);
    ctx.beginPath();
    ctx.ellipse(bx + mw * 0.3, groundY - 2 * SC, mw * 0.34, h1 * SC, 0, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(bx + mw * 0.74, groundY - 2 * SC, mw * 0.26, h2 * SC, 0, Math.PI, 0);
    ctx.fill();
  });
  const gr = ctx.createLinearGradient(0, groundY - 160 * SC, 0, groundY);
  gr.addColorStop(0, 'rgba(8,20,10,0)');
  gr.addColorStop(1, 'rgba(8,20,10,0.45)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, groundY - 160 * SC, W, 160 * SC);
}

function drawGround() {
  const g = img.ground;
  const soil = '#3d2a1a';
  const depth = H - groundY;
  const gw = 430 * SC;
  const gh = g.width ? gw * (g.height / g.width) : 150 * SC;
  const surfOff = gh * 0.10;
  const sg = ctx.createLinearGradient(0, groundY, 0, H);
  sg.addColorStop(0, soil);
  sg.addColorStop(1, '#1c120a');
  ctx.fillStyle = sg;
  ctx.fillRect(0, groundY, W, depth);
  if (g.width) {
    tileLoop(gw, G.worldX * 42 * SC, (bx, m) => drawMirrorTile(g, bx, groundY - surfOff, gw, gh, m));
    if (gh - surfOff < depth) {
      const fg = ctx.createLinearGradient(0, groundY - surfOff + gh - 8, 0, H);
      fg.addColorStop(0, '#33200f');
      fg.addColorStop(1, '#1a1008');
      ctx.fillStyle = fg;
      ctx.fillRect(0, groundY - surfOff + gh - 1, W, depth - gh + surfOff + 1);
    }
  }
  for (const h of G.holes) {
    const grd = ctx.createLinearGradient(0, groundY - surfOff, 0, H);
    grd.addColorStop(0, '#160d06');
    grd.addColorStop(1, '#050302');
    ctx.fillStyle = grd;
    ctx.fillRect(h.x, groundY - surfOff - 2, h.w, H - groundY + surfOff + 2);
    ctx.fillStyle = 'rgba(255,220,160,0.18)';
    ctx.fillRect(h.x - 2, groundY - surfOff - 2, 4, 10 * SC);
    ctx.fillRect(h.x + h.w - 2, groundY - surfOff - 2, 4, 10 * SC);
  }
  // 고속 지면 스트릭 (노면이 흐르는 레이싱 체감)
  const spdK2 = G.maxSpeed ? G.speed / G.maxSpeed : 0;
  if (spdK2 > 0.5) {
    const sa = 0.14 * (spdK2 - 0.5) / 0.5;
    ctx.strokeStyle = `rgba(255,240,210,${sa})`;
    ctx.lineWidth = 2 * SC;
    const scroll = G.worldX * 42 * SC;
    for (let i = 0; i < 6; i++) {
      const seg = 340 * SC + i * 57 * SC;
      const x = W - ((scroll * (1.1 + i * 0.06)) % (W + seg));
      const y = groundY + (4 + (i % 3) * 9) * SC;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (60 + i * 18) * SC, y);
      ctx.stroke();
    }
  }
}

function drawSigns() {
  for (const s of G.signs) {
    const x = s.x, ph = 96 * SC, bw = 128 * SC, bh = 46 * SC;
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(x - 5 * SC, groundY - ph, 10 * SC, ph);
    ctx.fillStyle = '#8a5f36';
    ctx.strokeStyle = '#5d3f22';
    ctx.lineWidth = 3 * SC;
    const bx = x - bw / 2, by = groundY - ph - bh + 6 * SC;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 8 * SC); else ctx.rect(bx, by, bw, bh);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff3d9';
    ctx.font = `800 ${19 * SC}px 'Apple SD Gothic Neo','Malgun Gothic',sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('유치원 →', x, by + bh / 2 + 1);
  }
}

function drawObstacles() {
  for (const o of G.obstacles) {
    if (o.kind === 'branch') {
      const im = img.branch;
      const top = o.barBottom - o.dh;
      // 덩굴 로프 (스프라이트 위 → 화면 상단)
      if (top > 0) {
        ctx.strokeStyle = 'rgba(38,52,24,0.95)';
        ctx.lineWidth = 5 * SC;
        ctx.beginPath();
        ctx.moveTo(o.x + o.dw * 0.32, 0); ctx.lineTo(o.x + o.dw * 0.32, top + 12 * SC);
        ctx.moveTo(o.x + o.dw * 0.66, 0); ctx.lineTo(o.x + o.dw * 0.66, top + 12 * SC);
        ctx.stroke();
      }
      if (im && im.width) ctx.drawImage(im, o.x, top, o.dw, o.dh);
      else { ctx.fillStyle = '#4a3418'; ctx.fillRect(o.x, o.barBottom - 40 * SC, o.dw, 40 * SC); }
    } else if (o.kind === 'toucan') {
      const im = (Math.floor(o.t * 7) % 2 === 0 ? img.toucan1 : img.toucan2) || img.toucan1;
      const y = o.y0 + Math.sin(o.t * 3) * 10 * SC;
      if (im && im.width) {
        // 급강하 기울기 (상하 이동 방향으로 부드럽게 틸트)
        ctx.save();
        ctx.translate(o.x + o.dw / 2, y);
        ctx.rotate(Math.cos(o.t * 3) * 0.12 - 0.06);
        ctx.drawImage(im, -o.dw / 2, -o.dh * 0.5, o.dw, o.dh);
        ctx.restore();
      }
      else { ctx.fillStyle = '#222'; ctx.beginPath(); ctx.ellipse(o.x + o.dw / 2, y, o.dw * 0.4, o.dh * 0.3, 0, 0, Math.PI * 2); ctx.fill(); }
      // 접근 경고
      if (o.x > W - 40 * SC) {
        ctx.fillStyle = 'rgba(255,80,60,0.9)';
        ctx.font = `900 ${26 * SC}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('❗', W - 26 * SC, o.y0 - 10 * SC);
      }
    } else if (o.kind === 'snake') {
      const up = Math.floor(o.t * 1.6) % 2 === 1;
      const im = up ? (img.snake2 || img.snake1) : img.snake1;
      if (im && im.width) {
        const fh = o.dw * (im.height / im.width); // 프레임별 고유 비율 (바닥 기준 정렬)
        ctx.drawImage(im, o.x, groundY - fh + 4 * SC, o.dw, fh);
      } else { ctx.fillStyle = '#3f8f3a'; ctx.fillRect(o.x, groundY - 34 * SC, o.dw, 34 * SC); }
    } else if (o.kind === 'boulder') {
      const im = img.rock;
      ctx.save();
      ctx.translate(o.x + o.dw / 2, groundY - o.dh / 2 + 4 * SC);
      ctx.rotate(o.rot);
      if (im && im.width) ctx.drawImage(im, -o.dw / 2, -o.dh / 2, o.dw, o.dh);
      ctx.restore();
      // 구름 먼지
      if (Math.random() < 0.3) dust(o.x + o.dw, groundY, 1);
    } else if (o.kind === 'bees') {
      const y = o.y0 + Math.sin(o.t * 2.4) * 26 * SC;
      // 벌떼: 윙윙거리는 점 군집
      for (let i = 0; i < 9; i++) {
        const a = o.t * 6 + i * 2.4;
        const bx = o.x + o.dw * 0.5 + Math.cos(a + i) * o.dw * 0.34;
        const by = y + Math.sin(a * 1.3 + i * 1.7) * o.dh * 0.4;
        ctx.fillStyle = i % 3 === 0 ? '#2b2416' : '#ffd23e';
        ctx.beginPath();
        ctx.arc(bx, by, (3.2 + (i % 3)) * SC, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.arc(bx + 2 * SC, by - 3 * SC, 2.2 * SC, 0, Math.PI * 2);
        ctx.fill();
      }
      // 경고
      if (o.x > W - 60 * SC) {
        ctx.fillStyle = 'rgba(255,210,60,0.95)';
        ctx.font = `900 ${22 * SC}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('🐝❗', W - 40 * SC, o.y0 - 30 * SC);
      }
    } else if (o.kind === 'mud') {
      // 진흙 웅덩이
      ctx.fillStyle = '#4a3320';
      ctx.beginPath();
      ctx.ellipse(o.x + o.dw / 2, groundY + 2 * SC, o.dw / 2, 10 * SC, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(120,86,52,0.85)';
      ctx.beginPath();
      ctx.ellipse(o.x + o.dw / 2, groundY, o.dw / 2 - 6 * SC, 7 * SC, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.ellipse(o.x + o.dw * 0.38, groundY - 2 * SC, o.dw * 0.16, 2.5 * SC, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (o.kind === 'monkey') {
      const im = img.monkey;
      const wob = Math.sin(o.t * 3) * 2 * SC;
      if (im && im.width) ctx.drawImage(im, o.x, groundY - o.dh + 4 * SC + wob, o.dw, o.dh);
      else { ctx.fillStyle = '#7a5230'; ctx.fillRect(o.x, groundY - 90 * SC, o.dw * 0.6, 90 * SC); }
    } else if (o.kind === 'wisp') {
      const y = o.y0 + Math.sin(o.t * 4.2) * 44 * SC;
      const r = o.dw * 0.42;
      ctx.save();
      ctx.shadowColor = 'rgba(120,255,220,0.9)';
      ctx.shadowBlur = 22 * SC;
      const wg = ctx.createRadialGradient(o.x + o.dw / 2, y, 2, o.x + o.dw / 2, y, r);
      wg.addColorStop(0, 'rgba(230,255,250,0.95)');
      wg.addColorStop(0.5, 'rgba(110,240,205,0.75)');
      wg.addColorStop(1, 'rgba(60,200,170,0)');
      ctx.fillStyle = wg;
      ctx.beginPath();
      ctx.arc(o.x + o.dw / 2, y, r, 0, Math.PI * 2);
      ctx.fill();
      // 꼬리
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.arc(o.x + o.dw / 2 + 18 * SC, y - Math.cos(o.t * 4.2) * 18 * SC, r * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    } else if (o.kind === 'crab') {
      const im = img.crab;
      const wig = Math.sin(o.t * 9) * 4 * SC;
      if (im && im.width) {
        ctx.save();
        ctx.translate(o.x + o.dw / 2 + wig, groundY);
        ctx.rotate(Math.sin(o.t * 9) * 0.06);
        ctx.drawImage(im, -o.dw / 2, -o.dh + 3 * SC, o.dw, o.dh);
        ctx.restore();
      }
    } else if (o.kind === 'hedge') {
      const im = img.hedge;
      if (im && im.width) {
        ctx.save();
        ctx.translate(o.x + o.dw / 2, groundY - o.dh * 0.45);
        ctx.rotate(o.rot);
        ctx.drawImage(im, -o.dw / 2, -o.dh / 2, o.dw, o.dh);
        ctx.restore();
      }
    } else if (o.kind === 'frog') {
      const im = img.frog;
      if (im && im.width) {
        const crouch = o.y >= groundY && o.hopT < 0.35 ? 1 - o.hopT / 0.35 : 0; // 도약 전 웅크림
        ctx.save();
        ctx.translate(o.x + o.dw / 2, o.y);
        ctx.scale(1 + crouch * 0.12, 1 - crouch * 0.18);
        ctx.drawImage(im, -o.dw / 2, -o.dh + 3 * SC, o.dw, o.dh);
        ctx.restore();
      }
    } else if (o.kind === 'ball') {
      // 비치볼 (스트라이프 원)
      const r = o.dw * 0.42;
      ctx.save();
      ctx.translate(o.x + o.dw / 2, o.y - r);
      ctx.rotate(-(G.worldX * 0.05 + o.x * 0.01));
      const cols = ['#ff5c5c', '#fff', '#4db8ff', '#fff', '#ffd75e', '#fff'];
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = cols[i];
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r, i * Math.PI / 3, (i + 1) * Math.PI / 3);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.3, r * 0.28, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (o.kind === 'geyser') {
      const ph = o.t % 2.4;
      const si2 = Math.min(G.stage, 9);
      const col = si2 === 7 ? ['255,190,90', '255,120,40'] : si2 === 6 ? ['150,255,220', '60,220,180'] : ['170,220,255', '90,170,255'];
      // 바닥 웅덩이
      ctx.fillStyle = `rgba(${col[1]},0.35)`;
      ctx.beginPath();
      ctx.ellipse(o.x + o.dw / 2, groundY + 2 * SC, o.dw * 0.5, 8 * SC, 0, 0, Math.PI * 2);
      ctx.fill();
      if (ph < 0.85) { // 경고: 끓는 거품
        for (let i = 0; i < 3; i++) {
          const bt = (ph * 3 + i * 0.7) % 1;
          ctx.fillStyle = `rgba(${col[0]},${0.5 * (1 - bt)})`;
          ctx.beginPath();
          ctx.arc(o.x + o.dw * (0.3 + i * 0.2), groundY - bt * 18 * SC, (3 + bt * 4) * SC, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (ph < 1.75) { // 분출!
        const k = Math.sin((ph - 0.85) / 0.9 * Math.PI);
        const jh = 158 * SC * Math.min(1, k * 1.6);
        const jg = ctx.createLinearGradient(0, groundY, 0, groundY - jh);
        jg.addColorStop(0, `rgba(${col[1]},0.9)`);
        jg.addColorStop(1, `rgba(${col[0]},0.15)`);
        ctx.fillStyle = jg;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(o.x + o.dw * 0.22, groundY - jh, o.dw * 0.56, jh, 10 * SC);
        else ctx.rect(o.x + o.dw * 0.22, groundY - jh, o.dw * 0.56, jh);
        ctx.fill();
        ctx.fillStyle = `rgba(${col[0]},0.8)`;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.arc(o.x + o.dw * (0.25 + Math.random() * 0.5), groundY - jh + (Math.random() - 0.2) * 16 * SC, (2.5 + Math.random() * 3) * SC, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (o.kind === 'stomper') {
      const si3 = Math.min(G.stage, 9);
      // 그림자 경고 (떨어지는 중 커짐)
      if (o.falling || o.landed < 0) {
        const prox = o.falling ? Math.min(1, (o.fy + 140 * SC) / (groundY + 140 * SC)) : 0.25;
        ctx.fillStyle = `rgba(0,0,0,${0.14 + prox * 0.22})`;
        ctx.beginPath();
        ctx.ellipse(o.x + o.dw / 2, groundY + 3 * SC, o.dw * (0.30 + prox * 0.25), 7 * SC, 0, 0, Math.PI * 2);
        ctx.fill();
        if (!o.falling) {
          ctx.fillStyle = 'rgba(255,80,60,0.85)';
          ctx.font = `900 ${22 * SC}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText('❗', o.x + o.dw / 2, groundY - 40 * SC - Math.sin(performance.now() * 0.008) * 5 * SC);
        }
      }
      // 낙하물 본체 (스테이지 스킨: 코코넛/화분/대나무)
      const oy = o.landed > 0 ? groundY : o.fy;
      if (o.landed < 0 && !o.falling) { /* 대기 중엔 화면 밖 */ }
      else {
        ctx.save();
        ctx.translate(o.x + o.dw / 2, oy - o.dw * 0.36);
        if (si3 === 4) { // 화분
          ctx.fillStyle = '#c96f4a';
          ctx.beginPath();
          ctx.moveTo(-o.dw * 0.34, -o.dw * 0.3); ctx.lineTo(o.dw * 0.34, -o.dw * 0.3);
          ctx.lineTo(o.dw * 0.24, o.dw * 0.34); ctx.lineTo(-o.dw * 0.24, o.dw * 0.34);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#7dbb52';
          ctx.beginPath(); ctx.arc(0, -o.dw * 0.4, o.dw * 0.22, 0, Math.PI * 2); ctx.fill();
        } else if (si3 === 3) { // 대나무 토막
          ctx.fillStyle = '#79b95c';
          if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(-o.dw * 0.18, -o.dw * 0.5, o.dw * 0.36, o.dw, 6 * SC); ctx.fill(); }
          else ctx.fillRect(-o.dw * 0.18, -o.dw * 0.5, o.dw * 0.36, o.dw);
          ctx.strokeStyle = '#4e8a3a'; ctx.lineWidth = 2.5 * SC;
          ctx.beginPath(); ctx.moveTo(-o.dw * 0.18, 0); ctx.lineTo(o.dw * 0.18, 0); ctx.stroke();
        } else { // 코코넛
          ctx.fillStyle = '#6b4a28';
          ctx.beginPath(); ctx.arc(0, 0, o.dw * 0.36, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.22)';
          ctx.beginPath(); ctx.arc(-o.dw * 0.12, -o.dw * 0.12, o.dw * 0.14, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
    } else if (o.kind === 'pend') {
      const ang = Math.sin(o.t * 2.35) * 0.85;
      const bx = o.x + Math.sin(ang) * o.len;
      const by = o.pivY + Math.cos(ang) * o.len;
      // 로프 + 지지대
      ctx.strokeStyle = 'rgba(60,45,25,0.95)';
      ctx.lineWidth = 3.5 * SC;
      ctx.beginPath();
      ctx.moveTo(o.x, Math.max(0, o.pivY));
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(o.x, 0); ctx.lineTo(o.x, Math.max(0, o.pivY));
      ctx.stroke();
      const im = img.lantern;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(ang * 0.5);
      if (im && im.width) {
        const lw = 46 * SC, lh = lw * (im.height / im.width);
        ctx.shadowColor = 'rgba(255,180,80,0.8)';
        ctx.shadowBlur = 16 * SC;
        ctx.drawImage(im, -lw / 2, -lh * 0.4, lw, lh);
      } else {
        ctx.fillStyle = '#ff8a3d';
        ctx.beginPath(); ctx.arc(0, 0, 20 * SC, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    } else if (o.kind === 'wall') {
      const si4 = Math.min(G.stage, 9);
      ctx.save();
      ctx.translate(o.x, groundY);
      if (si4 === 8) { // 도시: 상자 3단
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = i % 2 ? '#a5773f' : '#8a6234';
          ctx.strokeStyle = '#5d3f22'; ctx.lineWidth = 2.5 * SC;
          const bw2 = o.dw * (0.94 - i * 0.06), bh2 = o.dh / 3;
          const bx2 = (o.dw - bw2) / 2, by2 = -bh2 * (i + 1);
          ctx.fillRect(bx2, by2, bw2, bh2);
          ctx.strokeRect(bx2, by2, bw2, bh2);
          ctx.beginPath();
          ctx.moveTo(bx2, by2); ctx.lineTo(bx2 + bw2, by2 + bh2);
          ctx.moveTo(bx2 + bw2, by2); ctx.lineTo(bx2, by2 + bh2);
          ctx.stroke();
        }
      } else if (si4 === 4 || si4 === 5) { // 마을/들판: 건초 더미
        ctx.fillStyle = '#d9b64e';
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(o.dw * 0.05, -o.dh, o.dw * 0.9, o.dh, 16 * SC); ctx.fill(); }
        else ctx.fillRect(o.dw * 0.05, -o.dh, o.dw * 0.9, o.dh);
        ctx.strokeStyle = 'rgba(150,110,30,0.7)'; ctx.lineWidth = 2 * SC;
        for (let i = 1; i < 5; i++) {
          ctx.beginPath(); ctx.moveTo(o.dw * 0.1, -o.dh * i / 5); ctx.lineTo(o.dw * 0.9, -o.dh * i / 5); ctx.stroke();
        }
      } else { // 협곡 등: 바위 첨탑
        ctx.fillStyle = si4 === 7 ? '#c9663f' : '#8a7a6a';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(o.dw * 0.18, -o.dh * 0.85);
        ctx.lineTo(o.dw * 0.5, -o.dh);
        ctx.lineTo(o.dw * 0.82, -o.dh * 0.8);
        ctx.lineTo(o.dw, 0);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.moveTo(o.dw * 0.5, -o.dh); ctx.lineTo(o.dw * 0.82, -o.dh * 0.8); ctx.lineTo(o.dw, 0); ctx.lineTo(o.dw * 0.5, 0);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    } else if (o.kind === 'spring') {
      // 점프 버섯
      const sq = o.t > 0 ? Math.sin(o.t / 0.4 * Math.PI) : 0;
      ctx.save();
      ctx.translate(o.x + o.dw / 2, groundY);
      ctx.scale(1 + sq * 0.25, 1 - sq * 0.3);
      ctx.fillStyle = '#e8dcc8';
      ctx.fillRect(-o.dw * 0.12, -o.dh * 0.5, o.dw * 0.24, o.dh * 0.5);
      const cg = ctx.createRadialGradient(0, -o.dh * 0.55, 3, 0, -o.dh * 0.55, o.dw * 0.55);
      cg.addColorStop(0, '#ff8a8a');
      cg.addColorStop(1, '#e04848');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.ellipse(0, -o.dh * 0.55, o.dw * 0.52, o.dh * 0.42, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (const [dxs, dys, rs2] of [[-0.25, -0.72, 0.09], [0.15, -0.85, 0.07], [0.3, -0.6, 0.06]]) {
        ctx.beginPath();
        ctx.arc(o.dw * dxs, o.dh * dys, o.dw * rs2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else {
      const im = img[o.kind];
      if (im && im.width) ctx.drawImage(im, o.x, groundY - o.dh + 4 * SC, o.dw, o.dh);
    }
  }
  // 코코넛 투사체
  for (const s of G.shots) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot || 0);
    ctx.fillStyle = '#6b4a28';
    ctx.beginPath();
    ctx.arc(0, 0, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(-s.r * 0.3, -s.r * 0.3, s.r * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#40301a';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(Math.cos(i * 2.1) * s.r * 0.35, Math.sin(i * 2.1) * s.r * 0.35, s.r * 0.11, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawBones() {
  const im = img.bone;
  if (!im.width) return;
  for (const b of G.bones) {
    const s = 44 * SC, bob = Math.sin(b.t) * 6 * SC;
    ctx.save();
    ctx.translate(b.x, b.y + bob);
    ctx.rotate(Math.sin(b.t * 0.7) * 0.15);
    ctx.drawImage(im, -s / 2, -s / 2, s, s * (im.height / im.width));
    ctx.restore();
  }
}

const POW_IMG = { helmet: 'powHelmet', magnet: 'powMagnet', boost: 'powBoost', gold: 'powGold' };
const POW_EMOJI = { helmet: '⛑️', magnet: '🧲', boost: '🚀', gold: '🦴' };
function drawPows() {
  for (const w of G.pows) {
    const bob = Math.sin(w.t) * 8 * SC;
    const s = 62 * SC;
    const im = img[POW_IMG[w.kind]];
    ctx.save();
    ctx.translate(w.x, w.y + bob);
    // 글로우 링
    const gl = ctx.createRadialGradient(0, 0, s * 0.2, 0, 0, s * 0.75);
    gl.addColorStop(0, w.kind === 'gold' ? 'rgba(255,215,80,0.35)' : 'rgba(140,230,255,0.30)');
    gl.addColorStop(1, 'rgba(140,230,255,0)');
    ctx.fillStyle = gl;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.75, 0, Math.PI * 2); ctx.fill();
    if (im && im.width) {
      const dh = s * (im.height / im.width);
      ctx.drawImage(im, -s / 2, -dh / 2, s, dh);
    } else {
      ctx.font = `${40 * SC}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(POW_EMOJI[w.kind], 0, 0);
    }
    ctx.restore();
  }
}

const SHIBA_RUN = ['shiba3', 'shiba4', 'shiba2'];
function drawPlayer() {
  const p = G.player;
  const im = pickShiba();
  if (!im || !im.width) return;
  const dw = p.w * 1.12, dh = dw * (im.height / im.width);
  const ang = p.dispAng || 0;
  // 고스트 잔상 (고속/부스터/피버 — 레이싱 스피드감)
  const spdK = G.maxSpeed ? G.speed / G.maxSpeed : 0;
  if ((spdK > 0.62 || G.boostT > 0 || G.feverT > 0) && p.invuln <= 0) {
    const gN = G.boostT > 0 ? 3 : 2;
    for (let gi = gN; gi >= 1; gi--) {
      ctx.save();
      ctx.globalAlpha = 0.05 + 0.05 * (gN - gi);
      ctx.translate(p.x - gi * (10 + spdK * 14) * SC, p.y);
      ctx.rotate(ang);
      ctx.drawImage(im, -dw * 0.52, -dh * 0.94, dw, dh);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  // 부드러운 무적 점멸 (사인파 페이드 — 딱딱한 토글 제거)
  if (p.invuln > 0) ctx.globalAlpha = 0.55 + 0.35 * Math.sin(p.invuln * 26);
  // 주행 바운스 (지면 캐던스 라이딩감)
  const rideBob = (p.onGround && !p.sliding && !p.falling)
    ? Math.sin(p.anim * 5.2) * 2.4 * SC * Math.min(1, G.speed / (G.maxSpeed * 0.55)) : 0;
  ctx.save();
  ctx.translate(p.x, p.y + rideBob);
  ctx.rotate(ang + (rideBob ? Math.sin(p.anim * 5.2 + 0.9) * 0.016 : 0));
  if (p.onGround || p.y > groundY - 240 * SC) {
    const sh = Math.max(0.25, 1 - (groundY - p.y) / (260 * SC));
    ctx.save();
    ctx.rotate(-ang);
    ctx.fillStyle = `rgba(0,0,0,${0.28 * sh})`;
    ctx.beginPath();
    ctx.ellipse(0, groundY - p.y + 6 * SC, dw * 0.36 * sh + dw * 0.1, 10 * SC * sh + 3 * SC, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // 스쿼시 & 스트레치 (스프링 곡선: 눌림 → 복원 오버슈트) — 발 기준 앵커
  let sx = 1, sy = 1;
  if (p.squash > 0) {
    const k = Math.min(1, p.squash / (p.squashDur || 0.11));
    const s = Math.sin(k * Math.PI * 0.5);
    sx = 1 + 0.16 * s; sy = 1 - 0.22 * s;
    if (k < 0.32) { // 복원 반동 (통통 튀는 느낌)
      const o = Math.sin((0.32 - k) / 0.32 * Math.PI);
      sy += 0.06 * o; sx -= 0.045 * o;
    }
  } else if (!p.onGround && p.vy < -260 * SC) {
    const st = Math.min(1, -p.vy / (1200 * SC));
    sx = 1 - 0.07 * st; sy = 1 + 0.09 * st;
  }
  if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
  // 피버/부스터 오라
  if (G.feverT > 0 || G.boostT > 0) {
    const hue = (performance.now() * 0.35) % 360;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.shadowColor = G.boostT > 0 ? '#ffcf5e' : `hsl(${hue},95%,60%)`;
    ctx.shadowBlur = 34 * SC;
    ctx.drawImage(im, -dw * 0.52, -dh * 0.94, dw, dh);
    ctx.restore();
  }
  // 날개 핀핀: 펄럭이는 날개 (스프라이트 뒤)
  if (bikeId === 'wing') {
    const flap = (!p.onGround || p.gliding) ? Math.sin(performance.now() * 0.02) * 0.5 : Math.sin(performance.now() * 0.008) * 0.15;
    ctx.save();
    ctx.translate(-dw * 0.34, -dh * 0.52);
    ctx.rotate(-0.5 + flap);
    ctx.fillStyle = 'rgba(235,246,255,0.92)';
    ctx.strokeStyle = 'rgba(140,180,220,0.9)';
    ctx.lineWidth = 2 * SC;
    ctx.beginPath();
    ctx.ellipse(0, -dh * 0.18, dw * 0.30, dh * 0.13, -0.25, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(-dw * 0.06, -dh * 0.10, dw * 0.22, dh * 0.10, -0.4, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.drawImage(im, -dw * 0.52, -dh * 0.94, dw, dh);
  // 로켓 핀핀: 3단 점프 화염
  if (bikeId === 'rocket' && !p.onGround && p.jumps >= 3) {
    const fl = 0.7 + Math.random() * 0.5;
    const fg = ctx.createRadialGradient(-dw * 0.1, dh * 0.02, 2, -dw * 0.1, dh * 0.02, 26 * SC * fl);
    fg.addColorStop(0, 'rgba(255,240,170,0.95)');
    fg.addColorStop(0.5, 'rgba(255,150,50,0.8)');
    fg.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(-dw * 0.1, dh * 0.02, 26 * SC * fl, 0, Math.PI * 2);
    ctx.fill();
  }
  // 헬멧 표시
  if (G.shield) {
    ctx.font = `${30 * SC}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('⛑️', dw * 0.06, -dh * 1.02);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
function pickShiba() {
  const p = G.player;
  if (p.sliding && img.shibaSlide && img.shibaSlide.width) return bikeImg('shibaSlide');
  if (state === ST.CAUGHT || state === ST.REVIVE) return bikeImg('shiba2');
  if (!p.onGround) return p.jumps >= 2 ? bikeImg('shiba2') : bikeImg('shiba1');
  return bikeImg(SHIBA_RUN[Math.floor(p.anim) % SHIBA_RUN.length]);
}

const TIGER_RUN = ['tiger1', 'tiger3', 'tiger2', 'tiger4'];
function drawTiger() {
  const p = G.player;
  const im = img[TIGER_RUN[Math.floor(G.tiger.anim) % TIGER_RUN.length]];
  if (!im.width) return;
  const dw = p.w * 1.9, dh = dw * (im.height / im.width);
  let gap;
  if ((state === ST.CAUGHT || state === ST.REVIVE) && G.tiger.lunge) {
    gap = Math.max(-dw * 0.15, (1 - Math.min(1, G.caughtT) * 2.4) * W * 0.35);
  } else {
    gap = (G.tigerDist / 100) * W * 0.92 + dw * 0.15;
  }
  // 발톱 스와이프 런지 (앞으로 확 달려드는 위협 동작)
  const lungeF = G.tiger.swipe > 0
    ? Math.sin(Math.min(1, (0.5 - G.tiger.swipe) / 0.5) * Math.PI) : 0;
  const tx = p.x - gap - dw * 0.5 + lungeF * 64 * SC;
  if (tx + dw < -30) return;
  // 근접할수록 야성적으로 (바운스 증폭)
  const close = Math.max(0, (30 - G.tigerDist) / 30);
  const bob = Math.sin(G.tiger.anim * 0.9) * 5 * SC * (1 + close * 1.3);
  ctx.save();
  ctx.translate(tx + dw / 2, groundY + bob - 2 * SC);
  ctx.rotate(Math.sin(G.tiger.anim * 0.9) * 0.035 + lungeF * 0.10); // 스웨이 + 런지 틸트
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 6 * SC, dw * 0.4, 11 * SC, 0, 0, Math.PI * 2);
  ctx.fill();
  // 근접 시 위협 글로우
  if (state === ST.RUN && G.tigerDist < 16) {
    ctx.shadowColor = 'rgba(255,50,20,0.85)';
    ctx.shadowBlur = (18 + Math.sin(performance.now() * 0.012) * 8) * SC;
  }
  ctx.drawImage(im, -dw / 2, -dh * 0.96, dw, dh);
  // 클로 슬래시 (스와이프 순간 하얀 발톱 궤적 3줄)
  if (lungeF > 0.08) {
    ctx.strokeStyle = `rgba(255,255,255,${0.8 * lungeF})`;
    ctx.lineWidth = 3.5 * SC;
    ctx.lineCap = 'round';
    for (let ci = 0; ci < 3; ci++) {
      ctx.beginPath();
      ctx.arc(dw * 0.40, -dh * 0.40, (24 + ci * 9) * SC, -0.95, 0.45);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }
  ctx.restore();
}

function drawParts() {
  for (const pa of G.parts) {
    const a = 1 - pa.t / pa.life;
    if (pa.ring) {
      ctx.strokeStyle = `rgba(${pa.c},${a * 0.85})`;
      ctx.lineWidth = 3.5 * SC * a + 1;
      ctx.beginPath();
      ctx.arc(pa.x, pa.y, pa.r + pa.growth * pa.t, 0, Math.PI * 2);
      ctx.stroke();
    } else if (pa.rain) {
      ctx.strokeStyle = `rgba(${pa.c},${a * 0.5})`;
      ctx.lineWidth = 1.4 * SC;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pa.x - pa.vx * 0.016, pa.y - pa.vy * 0.016);
      ctx.stroke();
      if (pa.y > groundY) pa.t = pa.life; // 지면 도달 시 제거
    } else if (pa.mist) {
      ctx.fillStyle = `rgba(${pa.c},${a * 0.08})`;
      ctx.beginPath();
      ctx.arc(pa.x, pa.y, pa.r, 0, Math.PI * 2);
      ctx.fill();
    } else if (pa.leaf) {
      ctx.save();
      ctx.translate(pa.x, pa.y);
      ctx.rotate(pa.t * 3 + pa.x * 0.01);
      ctx.fillStyle = `rgba(${pa.c},${a * 0.8})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, pa.r * 1.6, pa.r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (pa.glow) {
      ctx.save();
      ctx.shadowColor = `rgba(${pa.c},0.9)`;
      ctx.shadowBlur = 8 * SC;
      ctx.fillStyle = `rgba(${pa.c},${a * 0.9})`;
      ctx.beginPath();
      ctx.arc(pa.x, pa.y + Math.sin((pa.t * 3 + pa.x) * 0.8) * 6 * SC, pa.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = `rgba(${pa.c},${a * 0.7})`;
      ctx.beginPath();
      ctx.arc(pa.x, pa.y, pa.r * (0.6 + a * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPops() {
  for (const pp of G.pops) {
    const a = 1 - pp.t / pp.life;
    const size = (pp.big ? 24 : 17) * SC * (pp.t < 0.12 ? 0.6 + pp.t * 3.3 : 1);
    ctx.font = `900 ${size}px 'Apple SD Gothic Neo','Malgun Gothic',sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4 * SC;
    ctx.strokeStyle = `rgba(20,16,8,${a * 0.8})`;
    ctx.strokeText(pp.txt, pp.x, pp.y);
    ctx.fillStyle = pp.c;
    ctx.globalAlpha = a;
    ctx.fillText(pp.txt, pp.x, pp.y);
    ctx.globalAlpha = 1;
  }
}

function drawHints() {
  for (const t of G.hints) {
    ctx.font = `800 ${17 * SC}px 'Apple SD Gothic Neo','Malgun Gothic',sans-serif`;
    const tw = ctx.measureText(t.txt).width + 28 * SC;
    ctx.fillStyle = 'rgba(8,26,14,0.85)';
    ctx.strokeStyle = 'rgba(255,232,168,0.6)';
    ctx.lineWidth = 2 * SC;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(t.x - tw / 2, t.y - 20 * SC, tw, 40 * SC, 20 * SC);
    else ctx.rect(t.x - tw / 2, t.y - 20 * SC, tw, 40 * SC);
    ctx.fill(); ctx.stroke();
    // 꼬리
    ctx.beginPath();
    ctx.moveTo(t.x - 8 * SC, t.y + 19 * SC);
    ctx.lineTo(t.x + 8 * SC, t.y + 19 * SC);
    ctx.lineTo(t.x, t.y + 34 * SC);
    ctx.closePath();
    ctx.fillStyle = 'rgba(8,26,14,0.85)';
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t.txt, t.x, t.y + 1);
  }
}

function drawBanner() {
  const b = G.banner;
  if (!b) return;
  // 등장: 오버슈트 팝 / 퇴장: 축소 페이드
  let k;
  if (b.t < 0.28) { const u = b.t / 0.28; k = 1 + 0.35 * Math.sin(u * Math.PI) * (1 - u); k *= u < 0.5 ? u * 2 : 1; }
  else if (b.t > b.life - 0.3) k = Math.max(0, (b.life - b.t) / 0.3);
  else k = 1;
  const fs = Math.min(46 * SC, W * 0.09);
  ctx.save();
  ctx.translate(W / 2, H * 0.28);
  ctx.scale(Math.max(0.01, k), Math.max(0.01, k));
  ctx.globalAlpha = Math.min(1, k);
  ctx.font = `900 ${fs}px 'Apple SD Gothic Neo','Malgun Gothic',sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = fs * 0.22;
  ctx.strokeStyle = 'rgba(20,14,4,0.85)';
  ctx.strokeText(b.txt, 0, 0);
  const gr = ctx.createLinearGradient(0, -fs * 0.6, 0, fs * 0.6);
  gr.addColorStop(0, '#fff6d8');
  gr.addColorStop(0.5, b.c);
  gr.addColorStop(1, '#ff8a3d');
  ctx.fillStyle = gr;
  ctx.fillText(b.txt, 0, 0);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawSpeedLines() {
  // 부스터/피버 + 고속 주행 시 상시 윈드라인 (속도 비례 강도)
  let a = 0;
  if (G.boostT > 0 || G.feverT > 0) a = 0.16;
  else if (G.maxSpeed && G.speed > G.maxSpeed * 0.68) {
    a = 0.11 * (G.speed / G.maxSpeed - 0.68) / 0.32;
  }
  if (a <= 0.005) return;
  ctx.strokeStyle = `rgba(255,255,255,${a})`;
  ctx.lineWidth = 2.5 * SC;
  for (let i = 0; i < 7; i++) {
    const y = ((performance.now() * 0.05 + i * 137) % 1) * H * 0.8 + H * 0.05;
    const x = W - ((performance.now() * (1.4 + i * 0.13)) % (W * 1.4));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (90 + i * 22) * SC, y);
    ctx.stroke();
  }
}

// ---------- 메인 루프 ----------
// 프레임 본체 — 실제 rAF 루프와 테스트 훅이 동일 경로를 사용 (상태 게이팅 불일치 방지)
let lastT = 0;
function frame(dt, skipDraw) {
  if (state === ST.PAUSE) return;
  // 히트스톱: 짧은 프레임 정지로 타격감 강조
  if (G.hitStop > 0 && (state === ST.RUN || state === ST.CAUGHT)) {
    G.hitStop -= dt;
    if (assetsReady && !skipDraw) draw();
    return;
  }
  // 슬로모션 (드라마 연출 후 서서히 복귀)
  if (tsHold > 0) tsHold -= dt;
  else if (ts < 1) ts = Math.min(1, ts + dt * 2.1);
  const sdt = dt * ts;
  if (G.cutIn) { G.cutIn.t += dt; if (G.cutIn.t > G.cutIn.dur) G.cutIn = null; }
  if (state === ST.RUN || state === ST.CAUGHT || state === ST.REVIVE ||
      state === ST.CLEAR || state === ST.FIN) update(sdt);
  if (assetsReady && !skipDraw && state !== ST.MENU && state !== ST.INTRO) draw();
}
function loop(t) {
  requestAnimationFrame(loop);
  let dt = (t - lastT) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  dt = Math.min(0.034, dt);
  lastT = t;
  frame(dt, false);
}
requestAnimationFrame(loop);
document.addEventListener('visibilitychange', () => {
  if (window.__test) return; // 테스트 모드: 자동 일시정지 없음
  if (document.hidden) {
    BGM.stop(); // 어떤 상태든 백그라운드에선 음악 정지
    if (state === ST.RUN) doPause();
  }
});

// ---------- 일시정지 ----------
function doPause() {
  if (state !== ST.RUN) return;
  state = ST.PAUSE;
  BGM.stop();
  ui.pause.classList.remove('hidden');
}
function doResume() {
  if (state !== ST.PAUSE) return;
  ui.pause.classList.add('hidden');
  state = ST.RUN;
  BGM.start(G.stage);
  G.player.invuln = Math.max(G.player.invuln, 0.6);
}
ui.pauseBtn.addEventListener('click', () => { sfx.click(); doPause(); });
ui.resumeBtn.addEventListener('click', () => { sfx.click(); doResume(); });
ui.quitBtn.addEventListener('click', () => {
  sfx.click();
  BGM.stop();
  ui.pause.classList.add('hidden');
  ui.hud.classList.add('hidden');
  state = ST.MENU;
  showScreen(ui.start);
  refreshTitle();
  try { ui.posterVideo.play().catch(() => {}); } catch (e) {}
});

// ---------- 음소거 ----------
function refreshMute() {
  const icon = muted ? '🔇' : '🔊';
  ui.muteBtn.textContent = icon;
  ui.pMuteBtn.textContent = icon + (muted ? ' 소리 켜기' : ' 소리 끄기');
}
function toggleMute() {
  muted = !muted;
  store.set('finfin_mute', muted);
  refreshMute();
  if (muted) BGM.stop();
  else { sfx.click(); if (state === ST.RUN) BGM.start(G.stage); }
}
ui.muteBtn.addEventListener('click', toggleMute);
ui.pMuteBtn.addEventListener('click', toggleMute);

// ---------- 화면 전환 ----------
function showScreen(el) {
  [ui.start, ui.intro, ui.countdown, ui.gameover, ui.ending].forEach(s => s.classList.add('hidden'));
  if (el) el.classList.remove('hidden');
}

// ---------- 완주 엔딩 ----------
function showEnding() {
  ui.hud.classList.add('hidden');
  $('endBones').textContent = G.bonesCnt;
  $('endCombo').textContent = G.comboMax;
  $('endFever').textContent = G.feverCnt;
  showScreen(ui.ending);
  if (G.newAch.length) {
    $('endAch').innerHTML = G.newAch.map(a => `<span class="go-badge">${a.icon} ${a.name}</span>`).join('');
    $('endAch').classList.remove('hidden');
  } else $('endAch').classList.add('hidden');
}

function playIntro() {
  state = ST.INTRO;
  showScreen(ui.intro);
  ui.hud.classList.add('hidden');
  try { ui.posterVideo.pause(); } catch (e) {}
  const v = ui.introVideo;
  v.currentTime = 0;
  v.muted = false;
  const done = () => { v.removeEventListener('ended', done); startCountdown(); };
  v.addEventListener('ended', done);
  v.play().catch(() => {});
  ui.skipBtn.onclick = () => { v.removeEventListener('ended', done); v.pause(); startCountdown(); };
}

function startCountdown() {
  state = ST.COUNT;
  resetGame();
  showScreen(ui.countdown);
  ui.hud.classList.remove('hidden');
  // 조작 안내 오버레이 (처음 2판)
  if (totals.runs < 2) {
    ui.zones.classList.remove('hidden');
    ui.zones.style.animation = 'none';
    void ui.zones.offsetWidth;
    ui.zones.style.animation = '';
    setTimeout(() => ui.zones.classList.add('hidden'), 4200);
  }
  let n = 3;
  ui.countNum.textContent = n;
  sfx.count();
  draw();
  const iv = setInterval(() => {
    if (state !== ST.COUNT) { clearInterval(iv); return; }
    n--;
    if (n <= 0) {
      clearInterval(iv);
      showScreen(null);
      sfx.go();
      state = ST.RUN;
      BGM.start(G.stage);
      Bridge.emit('start', { from: runFrom, stage: G.stage, bike: bikeId });
    } else {
      ui.countNum.textContent = n;
      sfx.count();
      ui.countNum.style.animation = 'none';
      void ui.countNum.offsetWidth;
      ui.countNum.style.animation = '';
    }
  }, 850);
}

function endGame() {
  state = ST.OVER;
  BGM.stop();
  const score = Math.floor(G.score);
  const isRecord = score > best && best > 0;
  best = Math.max(score, best);
  store.set('finfin_best', best);
  totals.runs++;
  store.set('finfin_tot', totals);
  unlock('first_run');
  store.set('finfin_ach', achState);

  Bridge.emit('gameover', {
    distance: score, bones: G.bonesCnt, comboMax: G.comboMax, fevers: G.feverCnt,
    stage: G.stage, best, isRecord, reason: G.deathBy || 'tiger',
  });
  ui.goScore.textContent = score;
  ui.goBones.textContent = G.bonesCnt;
  ui.goBest.textContent = best;
  ui.goCombo.textContent = G.comboMax;
  ui.goFever.textContent = G.feverCnt;
  ui.goNew.classList.toggle('hidden', !isRecord);
  if (isRecord) { sfx.record(); vib([30, 30, 80]); }
  // 이번 판 획득 뱃지
  if (G.newAch.length) {
    ui.goAch.innerHTML = G.newAch.map(a => `<span class="go-badge">${a.icon} ${a.name}</span>`).join('');
    ui.goAch.classList.remove('hidden');
  } else ui.goAch.classList.add('hidden');
  ui.hud.classList.add('hidden');
  showScreen(ui.gameover);
}

// ---------- 공유 ----------
ui.shareBtn.addEventListener('click', async () => {
  sfx.click();
  const url = location.origin + location.pathname;
  const text = `🐕🚲 핀핀 정글 등원 대작전에서 ${Math.floor(G.score || 0)}m 달렸어요! 호랑이보다 빨리 유치원까지! 같이 달려볼까요?`;
  try {
    if (navigator.share) await navigator.share({ title: '핀핀 정글 등원 대작전', text, url });
    else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      showToastGlobal('📋 링크가 복사되었어요!');
    }
  } catch (e) {}
});
function showToastGlobal(txt) {
  // 게임오버 화면 등 HUD 밖에서도 보이는 간단 알림
  ui.hud.classList.remove('hidden');
  showToast(txt);
  setTimeout(() => { if (state === ST.OVER || state === ST.MENU) ui.hud.classList.add('hidden'); }, 1700);
}

// ---------- 도전과제 패널 ----------
function openAch() {
  sfx.click();
  ui.achList.innerHTML = ACH.map(a => {
    const on = !!achState[a.id];
    return `<div class="ach-item ${on ? 'on' : ''}">
      <span class="ach-icon">${on ? a.icon : '🔒'}</span>
      <span class="ach-txt"><b>${a.name}</b><small>${a.desc}</small></span>
      ${on ? '<span class="ach-check">✓</span>' : ''}
    </div>`;
  }).join('');
  $('achTitle').textContent = `🏅 도전과제 ${achCount()}/${ACH.length}`;
  ui.achPanel.classList.remove('hidden');
}
ui.achBtn.addEventListener('click', openAch);
ui.goAchBtn.addEventListener('click', openAch);
ui.achClose.addEventListener('click', () => { sfx.click(); ui.achPanel.classList.add('hidden'); });

// ---------- 부활 ----------
ui.reviveBtn.addEventListener('click', () => { if (state === ST.REVIVE) doRevive(); });
ui.reviveSkip.addEventListener('click', () => {
  if (state !== ST.REVIVE) return;
  ui.revive.classList.add('hidden');
  endGame();
});

// ---------- 타이틀 ----------
function refreshTitle() {
  ui.titleMeta.innerHTML =
    (best > 0 ? `🏆 최고 기록 <b>${best}m</b> &nbsp;·&nbsp; ` : '') +
    `🏅 도전과제 <b>${achCount()}/${ACH.length}</b> &nbsp;·&nbsp; ${bike().icon} <b>${bike().name}</b>`;
  // 체크포인트 이어달리기
  const saved = Math.min(store.get('finfin_stage', 0), 9);
  if (saved >= 1) {
    ui.contBtn.textContent = `🚩 이어 등원 — ${STAGES[saved].icon} ${STAGES[saved].name} (${saved + 1}번째)부터`;
    ui.contBtn.classList.remove('hidden');
  } else ui.contBtn.classList.add('hidden');
}
ui.contBtn && ui.contBtn.addEventListener('click', () => {
  audioInit(); sfx.click();
  runFrom = Math.min(store.get('finfin_stage', 0), 9) * STAGE_LEN;
  startCountdown();
});

// ---------- 바이크 차고 ----------
const BIKE_COLOR = { pink: '#f5a8c0', rocket: '#ff8a3d', low: '#b06ff0', wing: '#6fc8f0', tank: '#7fc45e' };
function openGarage() {
  sfx.click();
  ui.bikeList.innerHTML = Object.keys(BIKES).map(id => {
    const b = BIKES[id];
    const on = bikeUnlocked(id);
    const sel = id === bikeId;
    const lockTxt = b.unlock ? (ACH.find(a => a.id === b.unlock) || {}).name : '';
    return `<button class="bike-card ${sel ? 'sel' : ''} ${on ? '' : 'locked'}" data-id="${id}" ${on ? '' : 'disabled'}>
      <span class="bike-chip" style="background:${BIKE_COLOR[id]}"></span>
      <span class="bike-icon">${on ? b.icon : '🔒'}</span>
      <span class="bike-txt"><b>${b.name}</b><small>${on ? b.desc : `잠김 — 도전과제 [${lockTxt}] 달성 시 해금`}</small></span>
      ${sel ? '<span class="bike-sel">✓ 탑승중</span>' : ''}
    </button>`;
  }).join('');
  ui.bikeList.querySelectorAll('.bike-card:not(.locked)').forEach(btn => {
    btn.onclick = () => {
      bikeId = btn.dataset.id;
      store.set('finfin_bike', bikeId);
      buildTint(bikeId);
      sfx.power();
      refreshTitle();
      openGarage(); // 갱신
    };
  });
  ui.garage.classList.remove('hidden');
}
ui.garageBtn.addEventListener('click', openGarage);
ui.garageClose.addEventListener('click', () => { sfx.click(); ui.garage.classList.add('hidden'); });

// ---------- 버튼 ----------
ui.startBtn.addEventListener('click', () => { audioInit(); sfx.click(); runFrom = 0; playIntro(); });
ui.retryBtn.addEventListener('click', () => { audioInit(); sfx.click(); startCountdown(); });
ui.introBtn.addEventListener('click', () => { audioInit(); sfx.click(); runFrom = 0; playIntro(); });
ui.endRestartBtn.addEventListener('click', () => { audioInit(); sfx.click(); runFrom = 0; startCountdown(); });
ui.endShareBtn.addEventListener('click', () => ui.shareBtn.click());

// ---------- 테스트 모드 (?test) ----------
if (location.search.indexOf('test') >= 0) {
  window.__test = {
    go() { resetGame(); showScreen(null); [ui.event, ui.revive, ui.pause].forEach(e => e.classList.add('hidden')); ui.hud.classList.remove('hidden'); state = ST.RUN; },
    sim(ms) { const n = Math.round(ms / 16); for (let i = 0; i < n; i++) frame(0.016, true); draw(); },
    warp(m) { G.worldX = m; G.nextMilestone = Math.ceil(m / 500) * 500 + 500; },
    caught: startCaught,
    state: () => state,
    G: () => G,
    give(k) { collectPow({ kind: k, x: G.player.x, y: G.player.y - 100 }); },
    fever: startFever,
    gauge(v) { G.fever = v; },
    slide(on) { input.keySlide = on; if (on) slidePress(); },
    jump: jumpInput,
    chunk(id) { CHUNK_MAP[id].fn(W + 80 * SC); },
    revive: doRevive,
    resetSave() { localStorage.clear(); },
    bike(id) { bikeId = id; buildTint(id); },
    event: startEvent,
    endEvent,
    rain() { G.rainT = 7; },
    clearNow() { G.worldX = (G.stage + 1) * STAGE_LEN + 1; },
    finNow() { G.worldX = TOTAL_M; },
    from(m) { runFrom = m; },
    bgm: () => BGM,
    // 난이도 계측용 자동 플레이 봇 (reactSec: 반응 속도 — 사람 평균 ~0.42s)
    botRun(reactSec = 0.42, maxMs = 240000) {
      this.go();
      const p = G.player;
      const n = Math.round(maxMs / 16);
      for (let i = 0; i < n; i++) {
        if (state === ST.REVIVE) { ui.revive.classList.add('hidden'); endGame(); }
        if (state === ST.EVENT) { // 이벤트: 첫 퍼크 카드 자동 선택
          const c = ui.event.querySelector('.perk-card');
          if (c) c.click(); else endEvent();
        }
        if (state === ST.CLEAR) { frame(0.016, true); continue; } // 폭죽 페이즈 통과
        if (state === ST.FIN) break; // 완주!
        if (state !== ST.RUN && state !== ST.CAUGHT) break;
        if (state === ST.RUN) {
          const react = G.speed * reactSec + 40 * SC;
          let jumpD = 1e9, slideD = 1e9, slideO = null;
          for (const o of G.obstacles) {
            if (o.hitDone || o.kind === 'mud' || o.kind === 'spring') continue;
            const d = o.x - (p.x + p.w * 0.3);
            if (o.kind === 'branch' || o.kind === 'toucan' || o.kind === 'bees' || o.kind === 'wisp' || o.kind === 'pend') {
              // 사람처럼 장애물이 완전히 지나갈 때까지 숙이기 유지
              if (d > -(o.dw + 60 * SC) && d < slideD) { slideD = d; slideO = o; }
            } else if (d >= -60 * SC) jumpD = Math.min(jumpD, d);
          }
          for (const h of G.holes) {
            const d = h.x - p.x;
            if (d > -h.w) jumpD = Math.min(jumpD, Math.max(0, d));
          }
          for (const s of G.shots) {
            const d = s.x - p.x;
            if (d > 0 && d < G.speed * 0.35) jumpD = Math.min(jumpD, d);
          }
          const wantSlide = slideO !== null && slideD < react * 0.85;
          if (wantSlide && !input.keySlide) { input.keySlide = true; slidePress(); }
          else if (!wantSlide) input.keySlide = false;
          if (!wantSlide && jumpD < G.speed * 0.22 + 24 * SC && p.onGround) jumpInput();
          // 사람처럼: 하강 중 아직 장애물 위를 못 벗어났으면 2단 점프
          if (!p.onGround && p.vy > 150 * SC && p.jumps === 1 &&
              ((jumpD < 1e8 && jumpD > -70 * SC) || overHole(p.x + p.w * 0.8))) jumpInput();
        }
        frame(0.016, true);
        if (G.worldX < 300) G.earlyHits = G.hitCnt;
      }
      input.keySlide = false;
      const res = {
        m: Math.floor(G.worldX), deathBy: G.deathBy || 'none', hits: G.hitCnt,
        bones: G.bonesCnt, fevers: G.feverCnt, byKind: Object.assign({}, G.hitByKind),
        early: G.earlyHits || 0, state,
      };
      if (state === ST.OVER) return res;
      endGame();
      return res;
    },
  };
}

// ---------- 초기화 ----------
loadAssets();
refreshMute();
refreshTitle();
const pv = ui.posterVideo;
pv.muted = true; pv.loop = true; pv.autoplay = true;
pv.play().catch(() => {});

})();
