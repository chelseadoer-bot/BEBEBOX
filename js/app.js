const STORAGE_KEYS={photos:"photoShare_photos",friends:"photoShare_friends",inbox:"photoShare_inbox",profile:"photoShare_profile",wishlist:"photoShare_wishlist",inviteCode:"photoShare_invite_code"};
function generateInviteCode(){
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s="";
  for(let i=0;i<6;i++)s+=chars[Math.floor(Math.random()*chars.length)];
  return s;
}
function getInviteCode(){
  return localStorage.getItem(STORAGE_KEYS.inviteCode)||state.profile?.inviteCode||null;
}
function ensureInviteCode(forceCreate=false){
  let code=getInviteCode();
  if(!code&&forceCreate){
    code=generateInviteCode();
    localStorage.setItem(STORAGE_KEYS.inviteCode,code);
  }
  if(code&&state.profile)state.profile.inviteCode=code;
  return code;
}
function isFamilyCreator(){
  try{
    const raw=localStorage.getItem("photoShare_auth");
    if(!raw)return localStorage.getItem("photoShare_onboarded")==="1";
    const a=JSON.parse(raw);
    if(a.userType==="invited"||a.path==="spouse")return false;
    return a.userType==="parent"&&a.path==="new";
  }catch{return localStorage.getItem("photoShare_onboarded")==="1";}
}
function isValidInviteCode(input){
  const code=String(input||"").trim().toUpperCase();
  if(!code)return false;
  if(code===DEMO_INVITE_CODE||code==="123456")return true;
  const family=getInviteCode()?.toUpperCase();
  return family&&code===family;
}
function copyInviteCode(){
  const code=ensureInviteCode(true)||getInviteCode();
  if(!code){showToast("초대 코드를 불러올 수 없어요");return;}
  if(navigator.clipboard?.writeText){
    navigator.clipboard.writeText(code).then(()=>showToast("초대 코드가 복사됐어요")).catch(()=>fallbackCopyInvite(code));
  }else fallbackCopyInvite(code);
}
function fallbackCopyInvite(code){
  const ta=document.createElement("textarea");
  ta.value=code;
  document.body.appendChild(ta);
  ta.select();
  try{document.execCommand("copy");showToast("초대 코드가 복사됐어요");}catch{showToast(`내 초대 코드: ${code}`);}
  ta.remove();
}
const PHOTO_DIR="public/photos/";
const AI_PHOTOS=["ai-01.jpg","ai-02.jpg","ai-03.jpg","ai-04.jpg","ai-05.jpg"].map(f=>PHOTO_DIR+f);
const AVATAR=AI_PHOTOS[0];
const BACKGROUND=AI_PHOTOS[1];
const DEFAULT_PHOTOS=Array.from({length:18},(_,i)=>AI_PHOTOS[i%AI_PHOTOS.length]);
const DEFAULT_FRIENDS=[{id:"f1",name:"민지"},{id:"f2",name:"준호"},{id:"f3",name:"수연"}];
// 가입 시 배경은 비워둔다(검정). 배경은 설정에서 직접 추가/변경한다.
const DEFAULT_PROFILE={name:"다엘이의 일기",babyName:"다엘이",status:"9개월",currentAge:9,avatar:AVATAR,background:""};
// 연령 칩 단계: 0~24개월은 월 단위, 이후 3~14세는 연 단위(15세 전까지).
const AGE_STEPS=(()=>{
  const s=[];
  for(let m=0;m<=24;m++)s.push({id:"m"+m,month:m,label:m===0?"신생아":m+"개월"});
  for(let y=3;y<=14;y++)s.push({id:"y"+y,month:y*12,label:y+"세"});
  return s;
})();
const AGE_TAB_CHIP_LIMIT=8; // (전체 포함) 칩이 이보다 많으면 드롭다운으로 표시
function stepIndexForMonth(m){
  m=(m==null?0:m);
  let idx=0;
  for(let i=0;i<AGE_STEPS.length;i++){if(AGE_STEPS[i].month<=m)idx=i;else break;}
  return idx;
}
function ageStepById(id){return AGE_STEPS.find(s=>s.id===id);}
function ageChipId(m){return AGE_STEPS[stepIndexForMonth(m)].id;}
function startStepMonth(){return state.profile.startAge??state.profile.currentAge??0;}
function visibleAgeSteps(){
  const a=stepIndexForMonth(startStepMonth());
  const b=stepIndexForMonth(state.profile.currentAge??startStepMonth());
  return AGE_STEPS.slice(Math.min(a,b),Math.max(a,b)+1);
}
function currentTabMonth(){
  if(state.currentAgeTab==="all")return state.profile.currentAge??9;
  const s=ageStepById(state.currentAgeTab);
  return s?s.month:(state.profile.currentAge??9);
}
const STAGES=[
  {id:"s1",name:"임신 초기"},{id:"s2",name:"임신 중기"},{id:"s3",name:"임신 후기"},{id:"s4",name:"출산 전후"},
  {id:"s5",name:"0-3개월"},{id:"s6",name:"4-6개월"},{id:"s7",name:"7-12개월"},{id:"s8",name:"돌 이후"}
];
const PRIORITY_CLASS={필수:"p-required",권장:"p-recommended",선택:"p-optional"};
const TARGET_LABEL={mom:"mom",baby:"baby",mombaby:"mom+baby"};
function getItemProducts(item){
  if(!state.itemProducts[item.id])state.itemProducts[item.id]=[];
  return state.itemProducts[item.id];
}
async function loadKidikidiProducts(item,owned){
  const subtitleEl=owned?null:$("#picker-subtitle");
  await loadKidikidiIntoList($("#product-list"),subtitleEl,item.name,4,(products)=>{
    const customs=(state.itemProducts[item.id]||[]).filter(p=>p.custom);
    state.itemProducts[item.id]=[...products,...customs];
    save();
    renderProductList(item,owned);
  },owned);
}
async function loadKidikidiIntoList(listEl,subtitleEl,keywordOrName,limit,onSuccess,owned=false){
  const displayKw=kidikidiSearchKeyword(keywordOrName);
  if(subtitleEl&&!owned)subtitleEl.innerHTML=`키디키디 추천 <span class="picker-kd-keyword">「${esc(displayKw)}」</span>`;
  listEl.innerHTML=`<div class="product-loading">키디키디에서 상품을 찾는 중...</div>`;
  try{
    const data=await fetchKidikidiProducts(keywordOrName,limit||4);
    if(!data.products.length){
      if(data.proxyUnavailable){
        listEl.innerHTML=`<div class="product-error">키디키디 상품을 불러오지 못했어요.<br><small><code>photo-share-app</code> 폴더에서 <code>python server.py</code> 로 실행해 주세요.<br><code>python -m http.server</code> 는 API가 없어요.</small></div>`;
        return;
      }
      const tried=esc(data.keyword||displayKw);
      listEl.innerHTML=`<div class="product-empty">「${tried}」 검색 결과가 없어요<br><small>아래에서 직접 상품을 추가할 수 있어요</small></div>`;
      return;
    }
    if(onSuccess)onSuccess(data.products);
    else mountKidikidiCards(listEl,data.products);
  }catch(e){
    console.warn("kidikidi fetch failed",e);
    listEl.innerHTML=`<div class="product-error">키디키디 상품을 불러오지 못했어요.<br><small>터미널에서 <code>python server.py</code> 로 실행하거나 새로고침해 주세요</small></div>`;
  }
}
function mountKidikidiCards(listEl,products,{draggable=false,itemId=null}={}){
  listEl.innerHTML=products.map((p,i)=>productCardHtml(p,i,false,{draggable})).join("");
  bindKidikidiCardLinks(listEl);
  if(draggable&&itemId)bindProductDrag(listEl,itemId);
}
function bindKidikidiCardLinks(listEl){
  listEl.querySelectorAll(".product-card").forEach(card=>{
    card.onclick=e=>{
      if(e.target.closest(".product-del-btn,.product-drag-handle"))return;
      const url=card.dataset.url;
      if(url)window.open(url,"_blank","noopener,noreferrer");
    };
  });
}
function reorderItemProducts(itemId,from,to){
  const arr=state.itemProducts[itemId];
  if(!arr||from===to||from<0||to<0||from>=arr.length||to>=arr.length)return;
  const [moved]=arr.splice(from,1);
  arr.splice(to,0,moved);
  save();
}
function fmtPrice(n){return n.toLocaleString("ko-KR")+"원";}
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
let state={photos:[],friends:[],inbox:[],profile:{...DEFAULT_PROFILE},wishlist:{},owned:{},hidden:{},itemProducts:{},funding:{},fundingGauge:{},gaugePuzzles:{},collectQuests:{},contributors:{},journeyGifts:{},journeyMemories:{},parentQuestPhotos:{},points:0,coupons:[],posts:[],giftPuzzles:[],journeyJustCleared:null,viewingPostId:null,currentStage:0,currentAgeTab:"all",pendingGift:null,viewingPhotoId:null,pendingFunding:null,pendingContribute:null,pendingJourneyNode:null,pendingRaidNode:null,pendingJourneyEditNode:null};
function isGuest(){return new URLSearchParams(location.search).has("guest");}
function babyName(){return state.profile.babyName||state.profile.name.replace(/의 일기$/,"")||"다엘이";}
function hasItem(id){return!!state.owned[id];}
const EYE_ON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
const $=(s)=>document.querySelector(s);
const $$=(s)=>document.querySelectorAll(s);
// 데모 사진은 더 이상 시드하지 않는다. 피드는 state.posts(직접 작성한 글)만 보여준다.
function mkPhotos(){
  return [];
}
function ensurePhotoMeta(p){
  if(p.likes==null)p.likes=0;if(p.liked==null)p.liked=false;if(!p.comments)p.comments=[];
  if(p.ageMonth==null)p.ageMonth=9;
  return p;
}
function initFundingGauge(){
  Object.keys(FUNDING_GAUGE).forEach(k=>{
    if(!state.fundingGauge[k])state.fundingGauge[k]={...FUNDING_GAUGE[k],raised:FUNDING_GAUGE[k].raised};
  });
}
function initCollectQuests(){
  Object.keys(COLLECT_QUESTS).forEach(k=>{
    if(!state.collectQuests[k])state.collectQuests[k]={...COLLECT_QUESTS[k]};
  });
}
function getFunding(itemId){
  if(!state.funding[itemId]&&FUNDING_ITEMS[itemId])state.funding[itemId]=FUNDING_ITEMS[itemId].pieces.map(p=>({...p,filled:!!p.from}));
  return state.funding[itemId]||[];
}
function fundingProgress(itemId){
  const pieces=getFunding(itemId);
  if(!pieces.length)return 0;
  return Math.round(pieces.filter(p=>p.filled).length/pieces.length*100);
}
function puzzleBgStyle(image,cols,rows,col,row){
  const x=cols<=1?0:(col/(cols-1))*100;
  const y=rows<=1?0:(row/(rows-1))*100;
  return `background-image:url("${image}");background-size:${cols*100}% ${rows*100}%;background-position:${x}% ${y}%`;
}
function fundingItemStats(fundId){
  const pieces=getFunding(fundId);
  const goal=pieces.reduce((s,p)=>s+(p.price||0),0);
  const raised=pieces.filter(p=>p.filled).reduce((s,p)=>s+(p.price||0),0);
  return {goal,raised,pieces:pieces.length,filled:pieces.filter(p=>p.filled).length};
}
const FUNDING_RACE_PATH="M 24 175 C 55 55, 95 195, 145 115 C 195 40, 245 165, 295 85 C 325 45, 345 100, 336 95";
function positionFundingRunner(svg,pathEl,runnerG,pct){
  if(!pathEl||!runnerG)return;
  const len=pathEl.getTotalLength();
  const t=Math.max(0,Math.min(1,pct/100));
  const at=pathEl.getPointAtLength(len*t);
  const atPrev=pathEl.getPointAtLength(Math.max(0,len*t-3));
  const angle=Math.atan2(at.y-atPrev.y,at.x-atPrev.x)*180/Math.PI;
  runnerG.setAttribute("transform",`translate(${at.x.toFixed(1)},${at.y.toFixed(1)}) rotate(${angle.toFixed(1)})`);
}
function renderFundingRace(elId,{raised,goal,emoji,animate=false}={}){
  const el=typeof elId==="string"?$(elId):elId;
  if(!el)return;
  const gGoal=goal||0;
  const gRaised=Math.min(gGoal,raised||0);
  const pct=gGoal?Math.min(100,Math.round(gRaised/gGoal*100)):0;
  const remain=Math.max(0,gGoal-gRaised);
  const avatar=state.profile?.avatar||AVATAR;
  const icon=emoji||"🎁";
  const running=pct>0&&pct<100;
  const uid="fr"+Math.random().toString(36).slice(2,8);
  el.innerHTML=`<div class="funding-race-head">
    <div class="funding-race-amounts">
      <strong class="funding-race-raised">${fmtPrice(gRaised)}</strong>
      <span class="funding-race-pct">${pct}%</span>
    </div>
    <span class="funding-race-goal">목표 ${fmtPrice(gGoal)}</span>
  </div>
  <div class="funding-race-scene${animate?" is-animate":""}">
    <svg class="funding-race-svg" viewBox="0 0 360 200" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <linearGradient id="${uid}-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#ffd54f"/>
          <stop offset="45%" stop-color="#ff9800"/>
          <stop offset="100%" stop-color="#ff6d00"/>
        </linearGradient>
        <clipPath id="${uid}-clip"><circle r="22"/></clipPath>
      </defs>
      <text x="14" y="188" class="funding-race-icon-start">${icon}</text>
      <text x="322" y="92" class="funding-race-icon-finish">🏁</text>
      <path class="funding-race-path-bg" d="${FUNDING_RACE_PATH}" pathLength="100"/>
      <path class="funding-race-path-fill${animate?" is-bump":""}" d="${FUNDING_RACE_PATH}" pathLength="100" style="stroke:url(#${uid}-grad);stroke-dasharray:100;stroke-dashoffset:${100-pct}"/>
      <g class="funding-race-runner-g${running?" is-running":""}${pct>=100?" is-finish":""}${animate?" is-bump":""}">
        <circle r="26" class="funding-race-runner-ring"/>
        <image href="${avatar}" width="44" height="44" x="-22" y="-22" clip-path="url(#${uid}-clip)" preserveAspectRatio="xMidYMid slice"/>
        ${running?'<text class="funding-race-dust" x="-42" y="6">💨</text>':""}
      </g>
    </svg>
    ${running?'<div class="funding-race-sparkles" aria-hidden="true"><span style="left:28%;top:22%">✨</span><span style="left:52%;top:58%">✨</span><span style="left:72%;top:30%">✨</span></div>':""}
  </div>
  <div class="funding-race-bar-wrap">
    <div class="funding-race-bar"><div class="funding-race-bar-fill${animate?" is-bump":""}" style="width:${pct}%"></div></div>
  </div>
  <p class="funding-race-status">${pct>=100?"🎉 결승선 통과! 선물이 완성됐어요!":`${fmtPrice(remain)} 더 모으면 완성!`}</p>`;
  const pathFill=el.querySelector(".funding-race-path-fill");
  const runnerG=el.querySelector(".funding-race-runner-g");
  requestAnimationFrame(()=>positionFundingRunner(el.querySelector(".funding-race-svg"),pathFill,runnerG,pct));
}
function updatePuzzleProgress(prefix,filled,total){
  const remain=total-filled;
  const pct=total?Math.round(filled/total*100):0;
  const countEl=$("#"+prefix+"-puzzle-count");
  const remainEl=$("#"+prefix+"-puzzle-remain");
  const barEl=$("#"+prefix+"-puzzle-bar");
  const ratioEl=$("#"+prefix+"-puzzle-ratio");
  if(countEl)countEl.textContent=`${filled}조각 모음`;
  if(remainEl)remainEl.textContent=`${remain}조각 남음`;
  if(barEl)barEl.style.width=pct+"%";
  if(ratioEl)ratioEl.textContent=`${filled}/${total}`;
}
function renderPhotoPuzzleGrid(gridEl,pieces,{image,cols,rows,selectedId,onSelectEmpty,onTapFilled}){
  if(!gridEl)return;
  gridEl.style.gridTemplateColumns=`repeat(${cols},1fr)`;
  const filled=pieces.filter(p=>p.filled).length;
  gridEl.innerHTML=pieces.map((p,i)=>{
    const col=p.col!=null?p.col:i%cols;
    const row=p.row!=null?p.row:Math.floor(i/cols);
    const isFilled=!!p.filled;
    const isSelected=selectedId===p.id;
  return `<button type="button" class="puzzle-piece-slot${isFilled?" is-filled":" is-empty"}${isSelected?" is-selected":""}" data-pid="${esc(p.id)}" aria-label="${isFilled?esc(p.from||"채워진 조각"):esc(p.name||"빈 조각")}">
    ${isFilled?`<div class="puzzle-piece-photo puzzle-piece-photo--grid" style="${puzzleBgStyle(image,cols,rows,col,row)}"></div>${p.from?`<span class="puzzle-piece-donor">${esc(p.from)}</span>`:""}`:`<span class="puzzle-piece-icon">🧩</span>`}
  </button>`;
  }).join("");
  gridEl.querySelectorAll(".puzzle-piece-slot").forEach(btn=>{
    const pid=btn.dataset.pid;
    const piece=pieces.find(p=>p.id===pid);
    btn.onclick=()=>{
      if(piece?.filled){onTapFilled?.(piece);return;}
      onSelectEmpty?.(piece,btn);
    };
  });
  return filled;
}
function ensureGaugePuzzle(key){
  const cfg=FUNDING_GAUGE[key];
  if(!cfg)return[];
  const cols=cfg.puzzleCols||4;
  const rows=cfg.puzzleRows||4;
  const total=cols*rows;
  const piecePrice=Math.round(cfg.goal/total);
  if(!state.gaugePuzzles[key]){
    const g=state.fundingGauge[key]||cfg;
    const preFilled=Math.min(total,Math.floor(g.raised/g.goal*total));
    state.gaugePuzzles[key]=Array.from({length:total},(_,i)=>({
      id:`${key}-gp${i}`,
      name:`조각 ${i+1}`,
      price:piecePrice,
      filled:i<preFilled,
      from:i<preFilled?"가족":null,
      col:i%cols,
      row:Math.floor(i/cols)
    }));
  }
  return state.gaugePuzzles[key];
}
function getItemPuzzlePieces(fundId){
  const cfg=FUNDING_ITEMS[fundId];
  const cols=cfg?.cols||3;
  const pieces=getFunding(fundId);
  return pieces.map((p,i)=>({...p,col:i%cols,row:Math.floor(i/cols)}));
}
function isSeasonOpen(){
  if(!SEASON.open)return false;
  if(SEASON.until&&new Date()>new Date(SEASON.until+"T23:59:59"))return false;
  return true;
}
function getContributors(questId){return state.contributors[questId]||[];}
function questCompletionRate(age){
  const done=(PARENT_DONE_QUESTS[age]||[]).length;
  const stageId=AGE_STAGE_MAP[age];
  const total=(state.wishlist[stageId]||[]).filter(i=>!state.hidden[i.id]).length;
  const owned=(state.wishlist[stageId]||[]).filter(i=>state.owned[i.id]).length;
  if(!total&&!done)return 90;
  return Math.min(99,Math.round(((owned+done)/(total+done||1))*100));
}
function fmtPhotoDate(ts){const d=new Date(ts);return`${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 · 프로필 업데이트`;}
function fmtCommentTime(ts){const d=new Date(ts),now=new Date(),diff=now-d;if(diff<60000)return"방금 전";if(diff<3600000)return`${Math.floor(diff/60000)}분 전`;if(diff<86400000)return`${Math.floor(diff/3600000)}시간 전`;return`${d.getMonth()+1}월 ${d.getDate()}일`;}
function load(){
  const pVer=localStorage.getItem(STORAGE_KEYS.photos+"_ver");
  const saved=localStorage.getItem(STORAGE_KEYS.photos);
  const photoVerChanged=pVer!==String(PHOTOS_VERSION);
  if(photoVerChanged||!saved)state.photos=mkPhotos();
  else state.photos=JSON.parse(saved);
  state.photos=state.photos.map(ensurePhotoMeta);
  localStorage.setItem(STORAGE_KEYS.photos+"_ver",String(PHOTOS_VERSION));
  state.friends=JSON.parse(localStorage.getItem(STORAGE_KEYS.friends)||"null")||[...DEFAULT_FRIENDS];
  state.inbox=JSON.parse(localStorage.getItem(STORAGE_KEYS.inbox)||"null")||[];
  state.profile=JSON.parse(localStorage.getItem(STORAGE_KEYS.profile)||"null")||{...DEFAULT_PROFILE};
  state.profile.babyName=state.profile.babyName||DEFAULT_PROFILE.babyName;
  state.profile.name=state.profile.name||`${state.profile.babyName}의 일기`;
  state.profile.status=state.profile.status||DEFAULT_PROFILE.status;
  if(photoVerChanged){
    state.profile.avatar=DEFAULT_PROFILE.avatar;
    state.profile.background=DEFAULT_PROFILE.background;
  }else{
    state.profile.avatar=state.profile.avatar||DEFAULT_PROFILE.avatar;
    state.profile.background=state.profile.background||DEFAULT_PROFILE.background;
  }
  state.profile.currentAge=state.profile.currentAge??DEFAULT_PROFILE.currentAge;
  state.profile.kidikidiId=state.profile.kidikidiId||"";
  // 가입 시점(연령)을 한 번 고정해 두고, 이후 월령이 늘면 칩이 그 위로 쌓인다.
  if(state.profile.startAge==null)state.profile.startAge=state.profile.currentAge;
  state.currentAgeTab="all";
  const sp=localStorage.getItem("photoShare_points");
  state.points=sp?(parseInt(sp,10)||0):0;
  try{const cp=JSON.parse(localStorage.getItem("photoShare_coupons")||"[]");state.coupons=Array.isArray(cp)?cp:[];}catch(_){state.coupons=[];}
  try{const ps=JSON.parse(localStorage.getItem("photoShare_posts")||"[]");state.posts=Array.isArray(ps)?ps.map(ensurePostMeta):[];}catch(_){state.posts=[];}
  try{const gp=JSON.parse(localStorage.getItem("photoShare_giftpuzzles")||"[]");state.giftPuzzles=Array.isArray(gp)?gp:[];}catch(_){state.giftPuzzles=[];}
  const wl=localStorage.getItem(STORAGE_KEYS.wishlist);
  const wlVer=localStorage.getItem(STORAGE_KEYS.wishlist+"_ver");
  if(wlVer!==String(WISHLIST_VERSION)||!wl){
    state.wishlist=JSON.parse(JSON.stringify(DEFAULT_WISHLIST));
    localStorage.setItem(STORAGE_KEYS.wishlist+"_ver",String(WISHLIST_VERSION));
  }else state.wishlist=JSON.parse(wl);
  const owned=localStorage.getItem(STORAGE_KEYS.wishlist+"_owned");
  state.owned=owned?JSON.parse(owned):{};
  const hidden=localStorage.getItem(STORAGE_KEYS.wishlist+"_hidden");
  state.hidden=hidden?JSON.parse(hidden):{};
  const products=localStorage.getItem(STORAGE_KEYS.wishlist+"_products");
  state.itemProducts=products?JSON.parse(products):{};
  const fund=localStorage.getItem(STORAGE_KEYS.wishlist+"_funding");
  state.funding=fund?JSON.parse(fund):{};
  const fg=localStorage.getItem(STORAGE_KEYS.wishlist+"_funding_gauge");
  state.fundingGauge=fg?JSON.parse(fg):{};
  const gp=localStorage.getItem(STORAGE_KEYS.wishlist+"_gauge_puzzles");
  state.gaugePuzzles=gp?JSON.parse(gp):{};
  const cq=localStorage.getItem(STORAGE_KEYS.wishlist+"_collect");
  state.collectQuests=cq?JSON.parse(cq):{};
  const contrib=localStorage.getItem(STORAGE_KEYS.wishlist+"_contributors");
  state.contributors=contrib?JSON.parse(contrib):{};
  const jg=localStorage.getItem(STORAGE_KEYS.wishlist+"_journey_gifts");
  state.journeyGifts=jg?JSON.parse(jg):{};
  const jm=localStorage.getItem(STORAGE_KEYS.wishlist+"_journey_memories");
  state.journeyMemories=jm?JSON.parse(jm):{};
  const pq=localStorage.getItem(STORAGE_KEYS.wishlist+"_parent_quest_photos");
  state.parentQuestPhotos=pq?JSON.parse(pq):{};
  initFundingGauge();initCollectQuests();
  Object.keys(FUNDING_ITEMS).forEach(k=>{
    if(!state.funding[k])state.funding[k]=FUNDING_ITEMS[k].pieces.map(p=>({...p,filled:!!p.from}));
  });
  if(isOnboarded()&&isFamilyCreator())ensureInviteCode(true);
  else if(getInviteCode()&&state.profile)state.profile.inviteCode=getInviteCode();
  document.body.classList.toggle("is-guest",isGuest());
  if(new URLSearchParams(location.search).get("map")==="1")requestAnimationFrame(()=>openQuestGuide());
  if(photoVerChanged)save();
}
function saveLocalCache(){
  localStorage.setItem(STORAGE_KEYS.photos,JSON.stringify(state.photos));
  localStorage.setItem(STORAGE_KEYS.friends,JSON.stringify(state.friends));
  localStorage.setItem(STORAGE_KEYS.inbox,JSON.stringify(state.inbox));
  localStorage.setItem(STORAGE_KEYS.profile,JSON.stringify(state.profile));
  localStorage.setItem(STORAGE_KEYS.wishlist,JSON.stringify(state.wishlist));
  localStorage.setItem(STORAGE_KEYS.wishlist+"_owned",JSON.stringify(state.owned));
  localStorage.setItem(STORAGE_KEYS.wishlist+"_hidden",JSON.stringify(state.hidden));
  localStorage.setItem(STORAGE_KEYS.wishlist+"_products",JSON.stringify(state.itemProducts));
  localStorage.setItem(STORAGE_KEYS.wishlist+"_funding",JSON.stringify(state.funding));
  localStorage.setItem(STORAGE_KEYS.wishlist+"_funding_gauge",JSON.stringify(state.fundingGauge));
  localStorage.setItem(STORAGE_KEYS.wishlist+"_gauge_puzzles",JSON.stringify(state.gaugePuzzles));
  localStorage.setItem(STORAGE_KEYS.wishlist+"_collect",JSON.stringify(state.collectQuests));
  localStorage.setItem(STORAGE_KEYS.wishlist+"_contributors",JSON.stringify(state.contributors));
  localStorage.setItem(STORAGE_KEYS.wishlist+"_journey_gifts",JSON.stringify(state.journeyGifts));
  localStorage.setItem(STORAGE_KEYS.wishlist+"_journey_memories",JSON.stringify(state.journeyMemories));
  localStorage.setItem(STORAGE_KEYS.wishlist+"_parent_quest_photos",JSON.stringify(state.parentQuestPhotos));
  localStorage.setItem("photoShare_points",String(state.points||0));
  localStorage.setItem("photoShare_coupons",JSON.stringify(state.coupons||[]));
  localStorage.setItem("photoShare_posts",JSON.stringify(state.posts||[]));
  localStorage.setItem("photoShare_giftpuzzles",JSON.stringify(state.giftPuzzles||[]));
}
function save(){
  saveLocalCache();
  if(typeof schedulePushFamilyData==="function")schedulePushFamilyData();
}
window.saveLocalCache=saveLocalCache;
function showToast(m){const t=$("#toast");t.textContent=m;t.classList.remove("hidden");clearTimeout(showToast._t);showToast._t=setTimeout(()=>t.classList.add("hidden"),2500);}
const TAB_VIEWS={home:"#profile-view",journey:"#quest-guide-view",puzzle:"#puzzle-tab-view",game:"#game-tab-view",settings:"#settings-tab-view"};
let currentMainTab="home";
function showTabBar(){
  $("#bottom-tab-bar")?.classList.remove("hidden");
  $("#app")?.classList.add("has-tab-bar");
}
function hideTabBar(){
  $("#bottom-tab-bar")?.classList.add("hidden");
  $("#app")?.classList.remove("has-tab-bar");
}
function updateTabBarUI(){
  $$(".tab-bar-item").forEach(btn=>btn.classList.toggle("active",btn.dataset.tab===currentMainTab));
}
function switchMainTab(tab,{animate=false}={}){
  if(!TAB_VIEWS[tab])return;
  currentMainTab=tab;
  $$(".view").forEach(v=>v.classList.remove("active"));
  $(TAB_VIEWS[tab]).classList.add("active");
  updateTabBarUI();
  showTabBar();
  if(tab==="home"){renderProfile();renderFeed();}
  if(tab==="journey"){renderSeasonBanner();renderJourneyMap();}
  if(tab==="puzzle")renderPuzzleTab({animate});
  if(tab==="settings")renderSettingsTab();
  if(tab==="game"){initGameTab();renderPointsUI();}
  $("#btn-add-feed-photo")?.classList.toggle("hidden",tab!=="home");
}
function showOverlay(id){
  $$(".view").forEach(v=>v.classList.remove("active"));
  $(id).classList.add("active");
  hideTabBar();
}
function showView(id){
  if(Object.values(TAB_VIEWS).includes(id)){
    const tab=Object.keys(TAB_VIEWS).find(k=>TAB_VIEWS[k]===id)||"home";
    switchMainTab(tab);
    return;
  }
  showOverlay(id);
}
function renderPuzzleTab({animate=false}={}){
  migratePuzzleMissionImage();
  const data=loadPuzzleMission();
  const pieces=data.pieces;
  const board=$("#mission-puzzle-board");
  const image=puzzleMissionImage();
  if(board){
    board.classList.toggle("is-complete",pieces>=PUZZLE_TOTAL);
    board.innerHTML=Array.from({length:PUZZLE_TOTAL},(_,i)=>{
      const col=i%3,row=Math.floor(i/3);
      const filled=i<pieces;
      const anim=animate&&i===pieces-1&&pieces>0?" is-animate":"";
      return `<div class="mission-piece${filled?" is-filled":" is-empty"}${anim}">
        ${filled?`<div class="mission-piece-photo"><img src="${esc(image)}" alt="" draggable="false" style="${puzzlePieceImgStyle(col,row,3,3)}"/></div>`:""}
      </div>`;
    }).join("");
  }
  const textEl=$("#mission-progress-text");
  if(textEl)textEl.textContent=pieces>=PUZZLE_TOTAL?"🎉 오늘 미션 완성! 내일 또 도전해요":`🧩 9조각 중 ${pieces}조각 완성!`;
  const bar=$("#mission-progress-bar");
  if(bar)bar.style.width=`${Math.round(pieces/PUZZLE_TOTAL*100)}%`;
  const hint=$("#mission-bonus-hint");
  if(hint)hint.textContent=pieces>=PUZZLE_TOTAL?`오늘 보너스 +${POINT_RULES.missionBonus}알을 받았어요! 🥚`:`9칸을 다 채우면 보너스 +${POINT_RULES.missionBonus}알! 🎉`;
  renderPointsUI();
}
function renderPointsUI(){
  const pts=getPoints();
  $$(".js-point-balance").forEach(el=>{el.textContent=formatPoints(pts);});
  const ex=$("#btn-claim-coupon");
  if(ex){
    const ok=canExchangeCoupon();
    ex.disabled=!ok;
    ex.classList.toggle("is-ready",ok);
    ex.textContent=ok?"🎟️ 1,000알 → 쿠폰 교환하기":`🎟️ 쿠폰까지 ${formatPoints(POINT_RULES.couponCost-pts)}알`;
  }
}
function onPointsChanged(){renderPointsUI();}
function onPointsEarned(){}
function onPointsSpent(){}
window.renderPointsUI=renderPointsUI;
function renderSettingsTab(){
  $("#settings-baby-name").value=state.profile.babyName||"";
  $("#settings-baby-age").value=state.profile.currentAge??9;
  $("#settings-kidikidi-id").value=state.profile.kidikidiId||"";
  const ap=$("#settings-avatar-preview");if(ap)ap.src=state.profile.avatar;
  const bp=$("#settings-bg-preview");
  if(bp){
    if(state.profile.background){bp.style.backgroundImage=`url("${state.profile.background}")`;bp.classList.remove("is-empty");bp.textContent="";}
    else{bp.style.backgroundImage="none";bp.classList.add("is-empty");bp.textContent="배경 없음";}
  }
  const wlBtn=$("#btn-settings-wishlist");if(wlBtn)wlBtn.textContent=`🎁 ${babyName()} 옷장 (위시리스트)`;
  const kakao=typeof getStoredKakaoUser==="function"?getStoredKakaoUser():null;
  const accountSection=$("#settings-account-section");
  if(accountSection){
    accountSection.hidden=!kakao?.kakaoId;
    if(kakao?.kakaoId){
      const av=$("#settings-kakao-avatar");
      const nm=$("#settings-kakao-name");
      if(av){av.src=kakao.profileImage||state.profile.avatar||"";av.hidden=!kakao.profileImage&&!state.profile.avatar;}
      if(nm)nm.textContent=kakao.nickname||"카카오 계정";
    }
  }
  const codeEl=$("#settings-invite-code");
  const inviteSection=$("#settings-invite-section");
  if(inviteSection){
    const creator=isFamilyCreator();
    inviteSection.hidden=!creator;
    if(creator&&codeEl)codeEl.textContent=ensureInviteCode(true)||"------";
  }
  const coupons=getCoupons();
  $("#coupon-count").textContent=String(coupons.length);
  const list=$("#coupon-list");
  if(!list)return;
  if(!coupons.length){
    list.innerHTML=`<div class="coupon-empty">아직 받은 쿠폰이 없어요.<br/>1,000알을 모으면 1,000원 장바구니 쿠폰으로 바꿀 수 있어요!</div>`;
    return;
  }
  list.innerHTML=coupons.map(c=>{
    const head=c.percent?`${c.percent}% 할인`:`${(c.amount||0).toLocaleString("ko-KR")}원`;
    return`<div class="coupon-card"><strong>${head} ${esc(c.label||"쿠폰")}</strong><span>코드 ${esc(c.code)} · ~${esc(c.expires)}까지</span></div>`;
  }).join("");
  const notify=JSON.parse(localStorage.getItem("photoShare_notify")||"{}");
  $("#settings-notify-visit").checked=notify.visit!==false;
  $("#settings-notify-gift").checked=notify.gift!==false;
}
function onPuzzlePiecesChanged(gained,source,total,bonus){
  renderPuzzleTab({animate:gained>0});
  if(bonus>0)showToast(`오늘 미션 완성! 보너스 +${bonus}알 🎉`);
  else if(gained>0&&currentMainTab!=="puzzle")showToast(`퍼즐 ${gained}조각! (${total}/${PUZZLE_TOTAL})`);
}
window.onPuzzlePiecesChanged=onPuzzlePiecesChanged;
window.switchMainTab=switchMainTab;
function renderProfile(){
  $("#profile-name").textContent=state.profile.name;
  $("#profile-status").textContent=state.profile.status||`${state.profile.currentAge}개월`;
  $("#avatar-img").src=state.profile.avatar;
  $("#closet-avatar").src=state.profile.avatar;
  const bgEl=$(".bg-image");
  if(bgEl){
    if(state.profile.background){bgEl.style.backgroundImage=`url("${state.profile.background}")`;bgEl.style.backgroundColor="";}
    else{bgEl.style.backgroundImage="none";bgEl.style.backgroundColor="#111";}
  }
  $(".profile-header").classList.add("compact");
  renderAgeTabs();
  updateQuestBanner();
  renderAgeQuestBadge();
}
function renderAgeQuestBadge(){
  const rate=questCompletionRate(currentTabMonth());
  const el=$("#age-quest-badge");
  if(el)el.textContent=`엄마·아빠 퀘스트 ${rate}% 완료! 🔥`;
}
function onAgeTabChange(id){
  state.currentAgeTab=id;
  renderAgeTabs();renderFeed();renderAgeQuestBadge();
}
function renderAgeTabs(){
  const el=$("#age-tabs");
  if(!el)return;
  const curId=ageChipId(state.profile.currentAge??0);
  const items=[{id:"all",label:"전체"},...visibleAgeSteps().map(s=>({id:s.id,label:s.id===curId?`${s.label} 📍`:s.label}))];
  if(items.length>AGE_TAB_CHIP_LIMIT){
    // 칩이 너무 많으면 드롭다운으로
    el.classList.add("age-tabs--select");
    const sel=items.map(it=>`<option value="${it.id}"${it.id===state.currentAgeTab?" selected":""}>${it.label}</option>`).join("");
    el.innerHTML=`<select class="age-select" id="age-select" aria-label="연령 선택">${sel}</select>`;
    const s=el.querySelector("#age-select");
    if(s)s.onchange=e=>onAgeTabChange(e.target.value);
  }else{
    el.classList.remove("age-tabs--select");
    el.innerHTML=items.map(it=>`<button class="age-tab${it.id===state.currentAgeTab?" active":""}" data-age="${it.id}">${it.label}</button>`).join("");
    el.querySelectorAll(".age-tab").forEach(btn=>btn.onclick=()=>onAgeTabChange(btn.dataset.age));
  }
}
function getCurrentStageLabel(){
  const cm=state.profile.currentAge??9;
  const stage=[...JOURNEY_MAP].reverse().find(i=>i.kind==="stage"&&i.month<=cm);
  return stage?stage.label:`${cm}개월`;
}
function updateQuestBanner(){
  const t=$("#quest-banner-text");
  if(t)t.textContent=`${babyName()}의 성장 정원`;
  const sub=$("#quest-banner-sub");
  if(sub)sub.textContent=`정원 길을 따라 · ${getCurrentStageLabel()} 꽃이 피었어요`;
}
function ageLabel(m){return AGE_STEPS[stepIndexForMonth(m)].label;}
function ensurePostMeta(p){
  if(!p)return p;
  if(!Array.isArray(p.photos))p.photos=p.photos?[p.photos]:[];
  if(p.text==null)p.text="";
  if(p.gauge==null)p.gauge=0;
  if(!Array.isArray(p.comments))p.comments=[];
  if(p.ageMonth==null)p.ageMonth=9;
  if(!p.createdAt)p.createdAt=Date.now();
  return p;
}
function getPost(id){return state.posts.find(p=>p.id===id);}
function filterPostsByAge(){
  const all=[...state.posts].sort((a,b)=>b.createdAt-a.createdAt);
  if(state.currentAgeTab==="all")return all;
  return all.filter(p=>ageChipId(p.ageMonth)===state.currentAgeTab);
}
function renderFeed(){
  const feed=$("#photo-feed");
  if(!feed)return;
  const list=filterPostsByAge();
  if(!list.length){
    feed.innerHTML=`<div class="feed-empty">
      <p class="feed-empty-title">아직 올린 글이 없어요</p>
      <p class="feed-empty-desc">오늘의 ${esc(babyName())} 순간을 사진과 함께 기록해 보세요</p>
      <button type="button" class="feed-empty-btn" id="btn-feed-empty-write">✏️ 첫 글 작성하기</button>
    </div>`;
    $("#btn-feed-empty-write")?.addEventListener("click",openComposer);
    return;
  }
  feed.innerHTML=list.map(p=>{
    const multi=p.photos.length>1;
    const slides=p.photos.map(src=>`<div class="post-photo-slide"><img src="${esc(src)}" alt="" loading="lazy" data-img="${esc(src)}"/></div>`).join("");
    const nav=multi?`<button type="button" class="post-nav prev" data-nav="prev" aria-label="이전 사진">‹</button><button type="button" class="post-nav next" data-nav="next" aria-label="다음 사진">›</button><div class="post-count">1/${p.photos.length}</div>`:"";
    const dots=multi?`<div class="post-dots">${p.photos.map((_,i)=>`<span class="${i===0?"on":""}"></span>`).join("")}</div>`:"";
    const imgs=p.photos.length?`<div class="post-photos-wrap"><div class="post-photos${multi?" multi":""}">${slides}</div>${nav}</div>${dots}`:"";
    const gpct=Math.min(100,p.gauge);
    const text=p.text?`<p class="post-text"><strong>${esc(state.profile.name)}</strong> ${esc(p.text)}</p>`:"";
    return`<article class="post-card" data-id="${p.id}">
      <div class="post-head">
        <img class="post-avatar" src="${esc(state.profile.avatar)}" alt=""/>
        <div class="post-head-meta"><div class="post-name">${esc(state.profile.name)}</div><div class="post-date">${esc(fmtPhotoDate(p.createdAt))} · ${esc(ageLabel(p.ageMonth))}</div></div>
      </div>
      ${imgs}
      <div class="post-emotion">
        <button type="button" class="post-emotion-btn" data-emotion="${p.id}" aria-label="감정 표현">❤️</button>
        <div class="post-gauge"><div class="post-gauge-fill" style="width:${gpct}%"></div></div>
        <span class="post-emotion-count" data-emotion-count="${p.id}">${p.gauge}</span>
      </div>
      ${text}
      <button type="button" class="post-comment-link" data-comment="${p.id}">💬 댓글 ${p.comments.length?p.comments.length+"개":"달기"}</button>
    </article>`;
  }).join("");
  feed.querySelectorAll("img[data-img]").forEach(im=>im.onclick=()=>openImageLightbox(im.dataset.img));
  feed.querySelectorAll("[data-emotion]").forEach(b=>b.onclick=e=>{e.stopPropagation();bumpEmotion(b.dataset.emotion);});
  feed.querySelectorAll("[data-comment]").forEach(b=>b.onclick=()=>openPostCommentSheet(b.dataset.comment));
  feed.querySelectorAll(".post-nav").forEach(btn=>btn.onclick=e=>{
    e.stopPropagation();
    const scroller=btn.parentElement.querySelector(".post-photos");
    if(!scroller)return;
    const dir=btn.dataset.nav==="next"?1:-1;
    scroller.scrollBy({left:dir*scroller.clientWidth,behavior:"smooth"});
  });
  feed.querySelectorAll(".post-photos.multi").forEach(scroller=>{
    scroller.addEventListener("scroll",()=>{
      const i=Math.round(scroller.scrollLeft/Math.max(1,scroller.clientWidth));
      const wrap=scroller.parentElement;
      const dots=wrap.nextElementSibling;
      if(dots&&dots.classList.contains("post-dots"))dots.querySelectorAll("span").forEach((d,di)=>d.classList.toggle("on",di===i));
      const cnt=wrap.querySelector(".post-count");
      if(cnt)cnt.textContent=`${i+1}/${scroller.children.length}`;
    },{passive:true});
  });
}
let _emotionSaveTimer=null;
function bumpEmotion(id){
  const p=getPost(id);if(!p)return;
  p.gauge=(p.gauge||0)+1;
  const cnt=document.querySelector(`[data-emotion-count="${id}"]`);
  if(cnt)cnt.textContent=p.gauge;
  const card=document.querySelector(`.post-card[data-id="${id}"]`);
  const fill=card?.querySelector(".post-gauge-fill");
  if(fill)fill.style.width=Math.min(100,p.gauge)+"%";
  const btn=card?.querySelector(".post-emotion-btn");
  if(btn){btn.classList.remove("pop");void btn.offsetWidth;btn.classList.add("pop");}
  const wrap=card?.querySelector(".post-emotion");
  if(wrap){
    const heart=document.createElement("span");
    heart.className="emotion-float";heart.textContent="❤️";
    wrap.appendChild(heart);
    setTimeout(()=>heart.remove(),700);
  }
  clearTimeout(_emotionSaveTimer);
  _emotionSaveTimer=setTimeout(()=>save(),700);
}
function openImageLightbox(src){
  $("#detail-img").src=src;
  $("#photo-detail").classList.add("lightbox-only");
  $("#photo-detail").classList.remove("hidden");
  document.body.style.overflow="hidden";
}
function openPostCommentSheet(id){
  state.viewingPostId=id;
  renderComments();
  $("#comment-input").value="";
  $("#btn-send-comment").classList.remove("active");
  $("#comment-my-avatar").src=state.profile.avatar;
  $("#comment-sheet").classList.remove("hidden");
  setTimeout(()=>$("#comment-input").focus(),300);
}
/* ---------------------------------------------------- 글쓰기(인스타식) */
let composerFiles=[];
function openComposer(){
  composerFiles=[];
  const t=$("#composer-text");if(t)t.value="";
  renderComposerThumbs();
  $("#post-composer-modal")?.classList.remove("hidden");
}
function closeComposer(){
  $("#post-composer-modal")?.classList.add("hidden");
  composerFiles=[];
}
function addComposerFiles(files){
  const imgs=Array.from(files||[]).filter(f=>f.type.startsWith("image/"));
  composerFiles=composerFiles.concat(imgs).slice(0,10);
  renderComposerThumbs();
}
function renderComposerThumbs(){
  const wrap=$("#composer-thumbs");
  if(!wrap)return;
  wrap.innerHTML=composerFiles.map((f,i)=>`<div class="composer-thumb"><img src="${URL.createObjectURL(f)}" alt=""/><button type="button" class="composer-thumb-del" data-ci="${i}">✕</button></div>`).join("")
    +`<button type="button" class="composer-add-tile" id="btn-composer-add-photo">＋<span>사진</span></button>`;
  wrap.querySelectorAll(".composer-thumb-del").forEach(b=>b.onclick=()=>{composerFiles.splice(+b.dataset.ci,1);renderComposerThumbs();});
  $("#btn-composer-add-photo").onclick=()=>$("#composer-photo-input")?.click();
}
async function submitPost(){
  const text=$("#composer-text").value.trim();
  if(!composerFiles.length&&!text){showToast("사진을 추가하거나 내용을 입력해 주세요");return;}
  const btn=$("#btn-composer-submit");
  if(btn)btn.disabled=true;
  const srcs=[];
  if(composerFiles.length){
    if(typeof uploadPhotoToServer!=="function"){showToast("server.py 로 실행해야 사진을 올릴 수 있어요");if(btn)btn.disabled=false;return;}
    showToast("올리는 중...");
    for(const f of composerFiles){
      try{const up=await uploadPhotoToServer(f);if(up?.src)srcs.push(up.src);}catch(_){}
    }
    if(!srcs.length){showToast("사진 업로드 실패. server.py 실행 중인지 확인해 주세요");if(btn)btn.disabled=false;return;}
  }
  const post=ensurePostMeta({id:"post"+Date.now(),text,photos:srcs,ageMonth:state.profile.currentAge||9,createdAt:Date.now(),gauge:0,comments:[]});
  state.posts.unshift(post);
  save();
  if(btn)btn.disabled=false;
  closeComposer();
  switchMainTab("home");
  renderFeed();
  addPoints(POINT_RULES.photo,"photo");
  addPuzzlePieces(1,"post");
  showToast(`글을 올렸어요 · +${POINT_RULES.photo}알 🥚`);
}
async function changeAvatar(file){
  if(!file||!file.type.startsWith("image/")){showToast("이미지 파일을 선택해 주세요");return;}
  if(typeof uploadPhotoToServer!=="function"){showToast("server.py 로 실행해야 사진을 올릴 수 있어요");return;}
  showToast("프로필 사진 올리는 중...");
  try{
    const up=await uploadPhotoToServer(file);
    if(up?.src){
      state.profile.avatar=up.src;
      save();
      renderProfile();renderSettingsTab();renderFeed();
      showToast("프로필 사진을 변경했어요");
    }else{showToast("프로필 사진 변경 실패");}
  }catch(_){showToast("프로필 사진 변경 실패");}
}
async function changeBackground(file){
  if(!file||!file.type.startsWith("image/")){showToast("이미지 파일을 선택해 주세요");return;}
  if(typeof uploadPhotoToServer!=="function"){showToast("server.py 로 실행해야 사진을 올릴 수 있어요");return;}
  showToast("배경 사진 올리는 중...");
  try{
    const up=await uploadPhotoToServer(file);
    if(up?.src){
      state.profile.background=up.src;
      save();
      renderProfile();renderSettingsTab();
      showToast("배경 사진을 변경했어요");
    }else{showToast("배경 사진 변경 실패");}
  }catch(_){showToast("배경 사진 변경 실패");}
}
let _addProductImage="";
async function pickAddProductImage(file){
  if(!file||!file.type.startsWith("image/"))return;
  if(typeof uploadPhotoToServer!=="function"){showToast("server.py 로 실행해야 사진을 올릴 수 있어요");return;}
  showToast("상품 사진 올리는 중...");
  try{
    const up=await uploadPhotoToServer(file);
    if(up?.src){
      _addProductImage=up.src;
      const pv=$("#add-product-image-preview");
      if(pv){pv.src=up.src;pv.style.display="";}
    }
  }catch(_){showToast("상품 사진 업로드 실패");}
}
/* ----------------------------------------------- 프로필 게이미피케이션 */
function journeyProgress(){
  const nodes=JOURNEY_MAP.filter(n=>n.kind==="node");
  const done=nodes.filter(n=>!n.lockedPreview&&(n.parentDone||state.journeyGifts[n.id]||state.journeyMemories[n.id])).length;
  const pct=nodes.length?Math.round(done/nodes.length*100):0;
  return {done,total:nodes.length,pct};
}
function growthTier(pct){
  if(pct>=100)return"성장 졸업 🎓";
  if(pct>=75)return"성장왕 👑";
  if(pct>=50)return"탐험가 🧭";
  if(pct>=25)return"꼬물이 🐛";
  return"새싹 🌱";
}
function openProfileStats(){
  const jp=journeyProgress();
  $("#pstats-name").textContent=state.profile.name;
  $("#pstats-avatar").src=state.profile.avatar;
  $("#pstats-tier").textContent=`${growthTier(jp.pct)} 등극!`;
  $("#pstats-journey-pct").textContent=jp.pct+"%";
  $("#pstats-journey-fill").style.width=jp.pct+"%";
  $("#pstats-journey-sub").textContent=`성장 저니 ${jp.done}/${jp.total} 단계 완료`;
  $("#pstats-points").textContent=formatPoints(getPoints());
  $("#pstats-posts").textContent=String(state.posts.length);
  $("#pstats-emotions").textContent=String(state.posts.reduce((s,p)=>s+(p.gauge||0),0));
  $("#profile-stats-modal")?.classList.remove("hidden");
}
function closeProfileStats(){$("#profile-stats-modal")?.classList.add("hidden");}
function getJourneyMemory(nodeId){
  return state.journeyMemories[nodeId]||null;
}
function getJourneyNodePhoto(node){
  const mem=getJourneyMemory(node.id);
  if(mem?.photoSrc)return mem.photoSrc;
  return node.photoSrc||state.profile.avatar;
}
function getJourneyNodeDiary(node){
  const mem=getJourneyMemory(node.id);
  if(mem?.diary)return mem.diary;
  const gift=state.journeyGifts[node.id];
  if(gift)return `${gift.name}님이 선물해 주며 이 퀘스트를 함께 클리어했어요!`;
  return node.diary||"엄마·아빠가 직접 완주한 추억이에요.";
}
function setJourneyMemory(nodeId,patch){
  state.journeyMemories[nodeId]={...(state.journeyMemories[nodeId]||{}),...patch,updatedAt:Date.now()};
  save();
}
function registerPhotoToQuest(match,photo){
  if(!match?.journeyId||!photo?.src)return;
  const node=JOURNEY_MAP.find(n=>n.id===match.journeyId);
  const diary=photo.caption||`${babyName()}의 ${match.label} 순간을 기록했어요.`;
  setJourneyMemory(match.journeyId,{photoSrc:photo.src,photoId:photo.id,diary,autoLinked:true});
  photo.questLink={journeyId:match.journeyId,label:match.label};
  if(match.parentQuestId){
    state.parentQuestPhotos[match.parentQuestId]={photoSrc:photo.src,photoId:photo.id,journeyId:match.journeyId,at:Date.now()};
  }
  save();
  if($("#quest-guide-view")?.classList.contains("active"))renderJourneyMap();
  showToast(`🌿 ${match.label} 퀘스트 사진으로 등록됐어요`);
}
async function tryLinkPhotoToQuest(photo,fileName,{silent=false}={}){
  if(typeof analyzePhotoForQuest!=="function")return;
  const match=await analyzePhotoForQuest(photo.src,fileName);
  if(!match)return;
  if(silent){
    const node=JOURNEY_MAP.find(n=>n.id===match.journeyId);
    const diary=photo.caption||`${babyName()}의 ${match.label} 순간을 기록했어요.`;
    setJourneyMemory(match.journeyId,{photoSrc:photo.src,photoId:photo.id,diary,autoLinked:true});
    photo.questLink={journeyId:match.journeyId,label:match.label};
    if(match.parentQuestId)state.parentQuestPhotos[match.parentQuestId]={photoSrc:photo.src,photoId:photo.id,journeyId:match.journeyId,at:Date.now()};
    return;
  }
  registerPhotoToQuest(match,photo);
}
function migratePhotoQuestLinks(){
  if(typeof analyzePhotoForQuest!=="function")return;
  let changed=false;
  state.photos.forEach(p=>{
    if(p.questLink)return;
    const cap=String(p.caption||"").toLowerCase();
    const fileHint=cap.includes("기어")?"crawl.jpg":cap.includes("이유식")?"chair.jpg":cap.includes("목 가눔")?"tummy.jpg":"";
    if(!fileHint&&!cap.includes("기어")&&!cap.includes("웃")&&!cap.includes("이유식"))return;
    analyzePhotoForQuest(p.src,fileHint).then(match=>{
      if(!match)return;
      tryLinkPhotoToQuest(p,fileHint,{silent:true});
      changed=true;
      save();
    });
  });
}
async function syncPhotosFromServer(){
  if(typeof fetchPhotosFromServer!=="function")return;
  try{
    const serverPhotos=await fetchPhotosFromServer();
    if(serverPhotos===null)return;
    const localById={};
    state.photos.filter(p=>isServerPhotoId(p.id)).forEach(p=>{localById[p.id]=p;});
    const uploaded=serverPhotos.map(p=>{
      const local=localById[p.id];
      if(!local)return ensurePhotoMeta(p);
      return ensurePhotoMeta({
        ...p,
        likes:local.likes,
        liked:local.liked,
        comments:local.comments,
        caption:local.caption||p.caption,
        ageMonth:local.ageMonth??p.ageMonth,
        questLink:local.questLink
      });
    });
    const demo=state.photos.filter(p=>String(p.id).startsWith("d"));
    const seen=new Set();
    state.photos=[...uploaded,...demo].filter(p=>{
      if(seen.has(p.id))return false;
      seen.add(p.id);
      return true;
    }).sort((a,b)=>b.createdAt-a.createdAt);
    save();
  }catch(_){}
}
async function addPhotosFromFiles(files){
  if(!files||!files.length)return;
  const imgs=Array.from(files).filter(f=>f.type.startsWith("image/"));
  if(!imgs.length){showToast("이미지 파일을 선택해 주세요");return;}
  if(typeof uploadPhotoToServer!=="function"){
    showToast("server.py 로 실행해야 사진을 저장할 수 있어요");
    return;
  }
  showToast("사진을 저장하는 중...");
  let ok=0;
  for(const file of imgs){
    try{
      const uploaded=await uploadPhotoToServer(file);
      const photo={...uploaded,ageMonth:state.profile.currentAge||9,likes:0,liked:false,comments:[],caption:""};
      state.photos.unshift(ensurePhotoMeta(photo));
      await tryLinkPhotoToQuest(photo,file.name);
      ok++;
    }catch(e){
      showToast("사진 저장 실패. server.py 가 실행 중인지 확인해 주세요");
      break;
    }
  }
  if(ok){
    save();renderFeed();addPoints(POINT_RULES.photo,"photo");showToast(`${ok}장 저장 · +${POINT_RULES.photo}알 🥚`);addPuzzlePieces(1,"photo");
  }
}
async function deletePhoto(id){
  if(isServerPhotoId(id)&&typeof deletePhotoFromServer==="function"){
    await deletePhotoFromServer(id).catch(()=>{});
  }
  state.photos=state.photos.filter(p=>p.id!==id);
  save();renderFeed();
}
function getPhoto(id){return state.photos.find(p=>p.id===id);}
function updateDetailUI(){
  const p=getPhoto(state.viewingPhotoId);
  if(!p)return;
  $("#like-count").textContent=p.likes;
  $("#btn-like").classList.toggle("liked",!!p.liked);
  const cc=p.comments.length;
  $("#comment-count-label").textContent=cc?String(cc):"";
}
function openPhotoDetail(id){
  const p=getPhoto(id);
  if(!p)return;
  state.viewingPhotoId=id;
  $("#detail-img").src=p.src;
  $("#detail-avatar").src=state.profile.avatar;
  $("#detail-username").textContent=state.profile.name;
  $("#detail-date").textContent=fmtPhotoDate(p.createdAt);
  $("#comment-my-avatar").src=state.profile.avatar;
  updateDetailUI();
  $("#photo-detail").classList.remove("hidden");
  document.body.style.overflow="hidden";
}
function closePhotoDetail(){
  $("#photo-detail").classList.add("hidden");
  $("#photo-detail").classList.remove("lightbox-only");
  closeCommentSheet();
  state.viewingPhotoId=null;
  document.body.style.overflow="";
}
function toggleLike(){
  const p=getPhoto(state.viewingPhotoId);
  if(!p)return;
  if(p.liked){p.liked=false;p.likes=Math.max(0,p.likes-1);}
  else{p.liked=true;p.likes++;}
  save();updateDetailUI();
}
function renderComments(){
  const p=getPost(state.viewingPostId);
  const list=$("#comment-list");
  if(!p||!p.comments.length){
    list.innerHTML='<p class="comment-empty">첫 댓글을 남겨보세요.</p>';
    return;
  }
  list.innerHTML=p.comments.map(c=>`<div class="comment-item">
    <img class="comment-item-avatar" src="${c.avatar||state.profile.avatar}" alt=""/>
    <div class="comment-item-body">
      <div class="comment-item-author">${esc(c.author)}</div>
      <div class="comment-item-text">${esc(c.text)}</div>
      <div class="comment-item-time">${fmtCommentTime(c.at)}</div>
    </div>
  </div>`).join("");
  list.scrollTop=list.scrollHeight;
}
function openCommentSheet(){
  renderComments();
  $("#comment-input").value="";
  $("#btn-send-comment").classList.remove("active");
  $("#comment-sheet").classList.remove("hidden");
  setTimeout(()=>$("#comment-input").focus(),300);
}
function closeCommentSheet(){$("#comment-sheet").classList.add("hidden");}
function sendComment(){
  const text=$("#comment-input").value.trim();
  if(!text)return;
  const p=getPost(state.viewingPostId);
  if(!p)return;
  const me=(typeof getStoredKakaoUser==="function"&&getStoredKakaoUser()?.nickname)||state.profile.name;
  const av=(typeof getStoredKakaoUser==="function"&&getStoredKakaoUser()?.profileImage)||state.profile.avatar;
  p.comments.push({id:"c"+Date.now(),author:me,text,avatar:av,at:Date.now()});
  save();
  $("#comment-input").value="";
  $("#btn-send-comment").classList.remove("active");
  renderComments();
  renderFeed();
}
function renderStageNav(){
  const nav=$("#stage-nav");
  nav.innerHTML=STAGES.map((s,i)=>`<button class="stage-tab${i===state.currentStage?" active":""}" data-idx="${i}">${s.name}</button>`).join("");
  nav.querySelectorAll(".stage-tab").forEach(btn=>btn.onclick=()=>{state.currentStage=+btn.dataset.idx;renderStageNav();renderWishlistGrid();scrollStageTab();});
  scrollStageTab();
}
function scrollStageTab(){
  const tab=$("#stage-nav").querySelector(".stage-tab.active");
  if(tab)tab.scrollIntoView({behavior:"smooth",inline:"center",block:"nearest"});
}
function toggleHideItem(itemId){
  if(state.hidden[itemId])delete state.hidden[itemId];
  else state.hidden[itemId]=true;
  save();renderWishlistGrid();
  showToast(state.hidden[itemId]?"선물 받기 싫은 항목으로 숨겼어요":"다시 보이게 했어요");
}
function renderWishlistGrid(){
  const stage=STAGES[state.currentStage];
  const items=state.wishlist[stage.id]||[];
  const grid=$("#wishlist-grid");
  if(!items.length){grid.innerHTML='<div class="wish-empty">아직 등록된 위시리스트가 없어요</div>';return;}
  grid.innerHTML=items.map(item=>{
    const hidden=!!state.hidden[item.id];
    const has=hasItem(item.id);
    const pc=PRIORITY_CLASS[item.priority]||"";
    const chip=hidden?"hidden-label":has?"have":"need";
    const chipText=hidden?"숨김":has?"있음":"아직 없음";
    return`<div class="wish-card${has?" has-item":" needed"}${hidden?" is-hidden":""}" data-id="${item.id}" data-stage="${stage.id}">
      <div class="wish-card-top">
        <span class="wish-priority ${pc}">${item.priority}</span>
        <button class="wish-hide-btn${hidden?" active":""}" type="button" aria-label="${hidden?"다시 보이기":"숨기기"}">${hidden?EYE_OFF:EYE_ON}</button>
      </div>
      <div class="wish-card-body">
        <span class="wish-emoji">${item.emoji}</span>
        <span class="wish-name">${item.name}</span>
      </div>
      <div class="wish-card-foot">
        <span class="wish-target">${TARGET_LABEL[item.target]||item.target}</span>
        <span class="wish-status-chip ${chip}">${chipText}</span>
      </div>
    </div>`;
  }).join("");
  grid.querySelectorAll(".wish-card").forEach(card=>{
    card.querySelector(".wish-hide-btn").onclick=e=>{e.stopPropagation();toggleHideItem(card.dataset.id);};
    card.onclick=()=>openProductPicker(card.dataset.stage,card.dataset.id);
  });
}
function updatePickerOwnedUI(owned){
  $("#picker-owned-check").checked=owned;
  $(".product-picker-content").classList.toggle("picker-is-owned",owned);
  if(owned)$("#picker-subtitle").textContent="보유 중인 상품";
  $("#add-product-bar").classList.toggle("hidden",owned);
}
function openProductPicker(stageId,itemId){
  const item=state.wishlist[stageId].find(i=>i.id===itemId);
  if(!item)return;
  state.pendingGift={stageId,itemId};
  $("#picker-emoji").textContent=item.emoji;
  $("#picker-title").textContent=item.name;
  $("#picker-desc").textContent=item.desc||"";
  const owned=!!state.owned[itemId];
  updatePickerOwnedUI(owned);
  $("#add-product-form").classList.add("hidden");
  $("#btn-toggle-add-product").textContent="+ 상품 추가";
  $("#product-picker-modal").classList.remove("hidden");
  loadKidikidiProducts(item,owned);
}
function renderProductList(item,owned){
  const products=getItemProducts(item);
  const list=$("#product-list");
  list.innerHTML=products.map((p,i)=>productCardHtml(p,i,owned,{draggable:!owned})).join("");
  if(!owned){
    bindProductListEvents(list,item.id);
    bindProductDrag(list,item.id);
  }
}
function productCardHtml(p,i,owned,opts={}){
  const draggable=opts.draggable!==false&&!owned;
  const rating=p.rating?`<span class="rating">★ ${p.rating}${p.reviews?` (${p.reviews})`:""}</span>`:"";
  const handle=draggable?`<span class="product-drag-handle" data-idx="${i}">⠿</span>`:"";
  const del=!owned&&p.custom?`<button class="product-del-btn" type="button" data-pid="${p.id}">✕</button>`:"";
  const thumb=p.image
    ?`<img src="${esc(p.image)}" alt="" loading="lazy"/>`
    :(p.emoji||"🛍️");
  const kd=p.source==="kidikidi"?`<span class="product-kd-link" aria-hidden="true">키디키디 ↗</span>`:"";
  const cls=p.source==="kidikidi"?" product-card--kidikidi":"";
  return`<div class="product-card${cls}${owned?" disabled":""}" data-pid="${p.id}" data-idx="${i}"${p.url?` data-url="${esc(p.url)}"`:""}>
    ${handle}
    <div class="product-thumb">${thumb}</div>
    <div class="product-info">
      <div class="product-brand">${esc(p.brand||"직접 추가")}</div>
      <div class="product-name">${esc(p.name)}</div>
      <div class="product-meta"><span class="price">${fmtPrice(p.price)}</span>${rating}</div>
    </div>
    ${kd}
    ${del}
  </div>`;
}
function bindProductListEvents(list,itemId){
  list.querySelectorAll(".product-card").forEach(card=>{
    const delBtn=card.querySelector(".product-del-btn");
    if(delBtn)delBtn.onclick=e=>{e.stopPropagation();deleteProduct(itemId,card.dataset.pid);};
  });
  bindKidikidiCardLinks(list);
}
function deleteProduct(itemId,pid){
  const arr=state.itemProducts[itemId];
  if(!arr)return;
  state.itemProducts[itemId]=arr.filter(p=>p.id!==pid);
  save();
  const {stageId}=state.pendingGift;
  openProductPicker(stageId,itemId);
  showToast("상품을 삭제했어요");
}
function addProduct(){
  const {stageId,itemId}=state.pendingGift;
  const item=state.wishlist[stageId].find(i=>i.id===itemId);
  if(!item)return;
  const name=$("#add-product-name").value.trim();
  const price=parseInt($("#add-product-price").value,10);
  if(!name){showToast("상품명을 입력해 주세요");return;}
  if(!price||price<0){showToast("가격을 입력해 주세요");return;}
  const brand=$("#add-product-brand").value.trim()||"직접 추가";
  const products=getItemProducts(item);
  products.push({
    id:itemId+"-c"+Date.now(),
    brand,name,price,
    emoji:item.emoji,
    image:_addProductImage||"",
    rating:null,reviews:null,
    custom:true
  });
  save();
  _addProductImage="";
  $("#add-product-brand").value="";
  $("#add-product-name").value="";
  $("#add-product-price").value="";
  const pv=$("#add-product-image-preview");if(pv){pv.style.display="none";pv.src="";}
  $("#add-product-form").classList.add("hidden");
  $("#btn-toggle-add-product").textContent="+ 상품 추가";
  openProductPicker(stageId,itemId);
  showToast("상품을 추가했어요");
}
function bindProductDrag(list,itemId){
  let dragFrom=null,touchDrag=null;
  const cards=()=>[...list.querySelectorAll(".product-card")];
  const clearOver=()=>cards().forEach(c=>c.classList.remove("drag-over"));
  const applyReorder=(from,to)=>{
    if(from===null||from===to)return;
    reorderItemProducts(itemId,from,to);
    const item=state.wishlist[state.pendingGift.stageId].find(i=>i.id===itemId);
    renderProductList(item,false);
  };
  list.querySelectorAll(".product-card").forEach(card=>{
    const handle=card.querySelector(".product-drag-handle");
    if(handle){
      handle.addEventListener("mousedown",()=>card.setAttribute("draggable","true"));
      handle.addEventListener("touchstart",e=>{
        touchDrag={from:+card.dataset.idx,el:card,startY:e.touches[0].clientY};
        card.classList.add("dragging");
      },{passive:true});
      handle.addEventListener("touchmove",e=>{
        if(!touchDrag)return;
        e.preventDefault();
        const y=e.touches[0].clientY;
        clearOver();
        const target=cards().find(c=>{
          const r=c.getBoundingClientRect();
          return y>=r.top&&y<=r.bottom;
        });
        if(target)target.classList.add("drag-over");
      },{passive:false});
      handle.addEventListener("touchend",e=>{
        if(!touchDrag)return;
        const y=(e.changedTouches[0]||{}).clientY??touchDrag.startY;
        const target=cards().find(c=>{
          const r=c.getBoundingClientRect();
          return y>=r.top&&y<=r.bottom;
        });
        if(target)applyReorder(touchDrag.from,+target.dataset.idx);
        else{touchDrag.el.classList.remove("dragging");clearOver();}
        touchDrag=null;
      });
    }
    card.addEventListener("dragstart",e=>{
      if(!e.target.closest(".product-drag-handle")){e.preventDefault();return;}
      dragFrom=+card.dataset.idx;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed="move";
    });
    card.addEventListener("dragend",()=>{card.classList.remove("dragging");card.removeAttribute("draggable");clearOver();dragFrom=null;});
    card.addEventListener("dragover",e=>{e.preventDefault();e.dataTransfer.dropEffect="move";clearOver();card.classList.add("drag-over");});
    card.addEventListener("dragleave",()=>card.classList.remove("drag-over"));
    card.addEventListener("drop",e=>{
      e.preventDefault();
      applyReorder(dragFrom,+card.dataset.idx);
      dragFrom=null;
      clearOver();
    });
  });
}
function saveOwnedFromPicker(){
  const {itemId}=state.pendingGift;
  const owned=$("#picker-owned-check").checked;
  if(owned)state.owned[itemId]=true;
  else delete state.owned[itemId];
  save();renderWishlistGrid();
  updatePickerOwnedUI(owned);
  const item=state.wishlist[state.pendingGift.stageId].find(i=>i.id===itemId);
  loadKidikidiProducts(item,owned);
  showToast(owned?"보유 중으로 표시했어요":"아직 없음으로 변경했어요");
}
function openWishlist(){
  const t=$(".wishlist-title");if(t)t.textContent=`${babyName()} 옷장`;
  const ca=$("#closet-avatar");if(ca){ca.src=state.profile.avatar;ca.alt=babyName();}
  if(typeof renderGiftPuzzles==="function")renderGiftPuzzles();
  renderStageNav();renderWishlistGrid();showView("#wishlist-view");
}
function getGuideAge(){
  return currentTabMonth();
}
function getSparkleNodeId(cm){
  for(const item of JOURNEY_MAP){
    if(item.kind!=="node"||item.type!=="gift")continue;
    if(item.month>cm)continue;
    if(state.journeyGifts[item.id])continue;
    const q=item.collectKey&&(state.collectQuests[item.collectKey]||COLLECT_QUESTS[item.collectKey]);
    if(q&&q.current>=q.target)continue;
    return item.id;
  }
  return null;
}
function resolveNodeStatus(node,cm,sparkleId){
  if(state.journeyGifts[node.id])return"gifted";
  if(node.type==="raid"){
    const g=state.fundingGauge[node.fundKey];
    if(g&&g.raised>=g.goal)return"done";
    if(node.month>cm)return"locked";
    return"raid";
  }
  if(node.month>cm)return"locked";
  if(node.type==="gift"){
    const q=node.collectKey&&(state.collectQuests[node.collectKey]||COLLECT_QUESTS[node.collectKey]);
    if(q&&q.current>=q.target)return"gifted";
    return node.id===sparkleId?"active":"gift-wait";
  }
  if(node.parentDone)return"done";
  return node.month<cm?"done":"locked";
}
function getCurrentStageMonth(cm){
  let m=0;
  JOURNEY_MAP.forEach(item=>{if(item.kind==="stage"&&item.month<=cm)m=item.month;});
  return m;
}
function renderSeasonBanner(){
  const el=$("#season-banner");
  if(!el)return;
  if(!isSeasonOpen()){
    el.textContent="현재 축하 시즌이 아니에요. 출산·백일·돌 등 이벤트 기간에만 참여할 수 있어요.";
    el.style.background="rgba(240,240,240,.9)";
    return;
  }
  el.style.background="";
  el.textContent=`🎉 ${SEASON.name} · ${SEASON.until}까지 참여 가능`;
}
function renderJourneyNode(item,cm,sparkleId,side){
  const st=resolveNodeStatus(item,cm,sparkleId);
  if(st==="raid"){
    const g=state.fundingGauge[item.fundKey]||FUNDING_GAUGE[item.fundKey];
    const pct=g?Math.min(100,Math.round(g.raised/g.goal*100)):0;
    const contrib=getContributors(item.fundKey);
    const av=contrib.length?`<span class="journey-node-avatar">${contrib[contrib.length-1].anon?"🎁":esc(contrib[contrib.length-1].name.charAt(0))}</span>`:"";
    return`<div class="journey-row journey-row--center">
      <div class="journey-raid-card" role="button" tabindex="0" data-node="${item.id}">
        <div class="journey-raid-head">
          <span class="journey-raid-icon">${item.emoji}</span>
          <span class="journey-raid-title">${esc(item.name)}${av}</span>
        </div>
        <div class="journey-raid-gauge"><div class="journey-raid-gauge-fill" style="width:${pct}%"></div></div>
        <span class="journey-raid-pct">${pct}% 달성</span>
      </div>
    </div>`;
  }
  const sideCls=side%2===0?"journey-row--left":"journey-row--right";
  const flag=st==="done"?'<span class="journey-node-flag" aria-hidden="true">🚩</span>':"";
  const lock=st==="locked"?'<span class="journey-node-lock" aria-hidden="true">🔒</span>':"";
  const giftAv=st==="gifted"&&state.journeyGifts[item.id]?`<span class="journey-node-avatar">${state.journeyGifts[item.id].anon?"🎁":esc(state.journeyGifts[item.id].name.charAt(0))}</span>`:"";
  const flagName=st==="gifted"&&state.journeyGifts[item.id]&&!state.journeyGifts[item.id].anon?`<span class="journey-node-flag-name">${esc(state.journeyGifts[item.id].name)}</span>`:"";
  const justCleared=state.journeyJustCleared===item.id?" journey-node--just-cleared":"";
  const sparkle=st==="active"?'<span class="journey-node-sparkle" aria-hidden="true">✨</span>':"";
  const cls=`journey-node journey-node--${st==="gift-wait"?"gift-wait":st}${justCleared}`;
  return`<div class="journey-row ${sideCls}">
    <button type="button" class="${cls}" data-node="${item.id}" aria-label="${esc(item.name)}">
      ${sparkle}<span class="journey-node-circle">${giftAv}${flag}${lock}<span class="journey-node-emoji" aria-hidden="true">${item.emoji}</span></span>
      <span class="journey-node-label">${esc(item.name)}</span>${flagName}
    </button>
  </div>`;
}
function journeyGardenSceneHtml(){
  const pathD="M 100 24 C 58 120, 142 210, 100 300 S 58 480, 100 570 S 142 750, 100 840 S 58 1020, 100 1110 S 142 1260, 100 1350";
  return`<div class="journey-garden-scene" aria-hidden="true">
    <svg class="journey-path-svg" viewBox="0 0 200 1400" preserveAspectRatio="none">
      <path class="journey-path-sketch-shadow" d="${pathD}"/>
      <path class="journey-path-sketch" d="${pathD}"/>
    </svg>
    <span class="journey-deco journey-deco--1">🌸</span>
    <span class="journey-deco journey-deco--2">🦋</span>
    <span class="journey-deco journey-deco--3">🌷</span>
    <span class="journey-deco journey-deco--4">🌼</span>
    <span class="journey-deco journey-deco--5">🪴</span>
    <span class="journey-deco journey-deco--6">🐛</span>
    <span class="journey-deco journey-deco--7">🍀</span>
    <span class="journey-deco journey-deco--8">✿</span>
    <div class="journey-grass"></div>
  </div>`;
}
function renderJourneyMap(){
  const map=$("#journey-map");
  const cm=state.profile.currentAge??9;
  const sparkleId=getSparkleNodeId(cm);
  const curStageMonth=getCurrentStageMonth(cm);
  let side=0;
  let html=journeyGardenSceneHtml();
  JOURNEY_MAP.forEach(item=>{
    if(item.kind==="stage"){
      const isCur=item.month===curStageMonth;
      const pin=isCur?" 📍":"";
      const mascot=isCur?'<span class="journey-mascot" aria-hidden="true">👶</span>':"";
      html+=`<div class="journey-row journey-row--stage" data-stage-month="${item.month}">
        ${mascot}<span class="journey-stage-pill${isCur?" is-current":""}">${esc(item.label)}${pin}</span>
      </div>`;
      return;
    }
    html+=renderJourneyNode(item,cm,sparkleId,side++);
  });
  map.innerHTML=html;
  map.querySelectorAll("[data-node]").forEach(el=>{
    el.onclick=()=>onJourneyNodeClick(el.dataset.node);
    el.onkeydown=e=>{if(e.key==="Enter"||e.key===" ") {e.preventDefault();onJourneyNodeClick(el.dataset.node);}};
  });
  requestAnimationFrame(()=>{
    const cur=map.querySelector(".journey-stage-pill.is-current");
    if(cur)cur.scrollIntoView({block:"center",behavior:"smooth"});
  });
}
function onJourneyNodeClick(nodeId){
  const node=JOURNEY_MAP.find(n=>n.id===nodeId);
  if(!node)return;
  const cm=state.profile.currentAge??9;
  const st=resolveNodeStatus(node,cm,getSparkleNodeId(cm));
  if(st==="locked"){
    const stage=JOURNEY_MAP.find(s=>s.kind==="stage"&&s.month>=node.month);
    showToast(`아직 ${babyName()}가 자라는 중이에요! ${stage?stage.label:"다음"} 스테이지가 되면 열려요.`);
    if(node.lockedPreview)setTimeout(()=>showToast(node.lockedPreview),2600);
    return;
  }
  if(st==="done"||st==="gifted"){
    openJourneyDoneModal(node,st);
    return;
  }
  if(st==="raid"){openJourneyRaidModal(node);return;}
  if(st==="active"||st==="gift-wait"){openJourneyActiveModal(node);return;}
}
function setJourneyDoneEditMode(editing){
  const canEdit=!isGuest();
  $("#btn-journey-memory-edit")?.classList.toggle("hidden",!canEdit||editing);
  $("#journey-done-edit")?.classList.toggle("hidden",!editing);
  $("#journey-done-diary")?.classList.toggle("hidden",editing);
  $("#btn-journey-photo-change")?.classList.toggle("hidden",!editing);
  $("#journey-done-photo-wrap")?.classList.toggle("is-editing",editing);
}
function openJourneyDoneModal(node,st){
  state.pendingJourneyEditNode=node;
  const gift=state.journeyGifts[node.id];
  const mem=getJourneyMemory(node.id);
  const diaryText=mem?.diary??node.diary??getJourneyNodeDiary(node);
  state.journeyEditDraft={photoSrc:getJourneyNodePhoto(node),diary:diaryText};
  $("#journey-done-img").src=state.journeyEditDraft.photoSrc;
  $("#journey-done-title").textContent=node.name;
  $("#journey-done-diary").textContent=diaryText;
  $("#journey-done-caption").value=diaryText;
  setJourneyDoneEditMode(false);
  $("#journey-done-flag").textContent=gift?`🚩 ${gift.anon?"익명의 응원":gift.name+"님"}의 깃발이 꽂혀 있어요`:st==="done"?"🚩 엄마·아빠가 먼저 길을 열었어요!":"";
  $("#journey-done-modal").classList.remove("hidden");
}
function startJourneyMemoryEdit(){
  if(isGuest())return;
  const draft=state.journeyEditDraft;
  if(draft){
    $("#journey-done-img").src=draft.photoSrc;
    $("#journey-done-caption").value=draft.diary;
  }
  setJourneyDoneEditMode(true);
  setTimeout(()=>$("#journey-done-caption")?.focus(),150);
}
function cancelJourneyMemoryEdit(){
  const draft=state.journeyEditDraft;
  if(draft){
    $("#journey-done-img").src=draft.photoSrc;
    $("#journey-done-caption").value=draft.diary;
  }
  setJourneyDoneEditMode(false);
}
function saveJourneyMemoryEdits(){
  const node=state.pendingJourneyEditNode;
  if(!node)return;
  const caption=$("#journey-done-caption")?.value.trim()||"";
  const photoSrc=$("#journey-done-img")?.src||"";
  setJourneyMemory(node.id,{diary:caption,photoSrc});
  if(photoSrc.startsWith("data:")||photoSrc.includes("/")){
    const linked=state.photos.find(p=>p.src===photoSrc);
    if(linked)linked.questLink={journeyId:node.id,label:node.name};
  }
  save();
  state.journeyEditDraft={photoSrc,diary:caption};
  $("#journey-done-diary").textContent=caption;
  setJourneyDoneEditMode(false);
  showToast("성장 저니 추억을 저장했어요");
  renderJourneyMap();
}
async function onJourneyPhotoFileChange(e){
  if(isGuest()||$("#journey-done-edit")?.classList.contains("hidden"))return;
  const file=e.target.files?.[0];
  e.target.value="";
  if(!file||!file.type.startsWith("image/"))return;
  if(typeof uploadPhotoToServer!=="function"){
    showToast("server.py 로 실행해야 사진을 저장할 수 있어요");
    return;
  }
  try{
    showToast("사진을 저장하는 중...");
    const uploaded=await uploadPhotoToServer(file);
    $("#journey-done-img").src=uploaded.src;
    showToast("미리보기가 바뀌었어요. 저장하기를 눌러주세요");
  }catch(_){
    showToast("사진 저장에 실패했어요");
  }
}
function openJourneyActiveModal(node){
  state.pendingJourneyNode=node;
  $("#journey-active-emoji").textContent=node.emoji;
  $("#journey-active-title").textContent=`[퀘스트] ${babyName()}의 ${node.questTitle||node.name}`;
  $("#journey-active-desc").textContent=node.questDesc||"";
  $("#journey-gift-anon").checked=false;
  $("#journey-gift-sender").value="";
  $("#journey-active-modal").classList.remove("hidden");
  loadKidikidiIntoList($("#journey-product-list"),$("#journey-picker-subtitle"),kidikidiKeywordForJourney(node),4);
}
function submitJourneyGift(){
  const node=state.pendingJourneyNode;
  if(!node)return;
  if(!isSeasonOpen()){showToast("축하 시즌 기간에만 참여할 수 있어요");return;}
  const anon=$("#journey-gift-anon").checked;
  let sender=$("#journey-gift-sender").value.trim();
  if(!anon&&!sender){showToast("이름을 입력하거나 익명을 선택해 주세요");return;}
  if(anon)sender="익명";
  state.journeyGifts[node.id]={name:sender,anon,at:Date.now()};
  if(node.collectKey){
    const q=state.collectQuests[node.collectKey]||COLLECT_QUESTS[node.collectKey];
    if(q&&q.current<q.target)q.current++;
    const questId=q?.id||COLLECT_QUESTS[node.collectKey]?.id;
    if(questId){
      if(!state.contributors[questId])state.contributors[questId]=[];
      state.contributors[questId].push({name:sender,anon,amount:q?.unitPrice||node.giftPrice||0});
    }
  }
  save();
  $("#journey-active-modal").classList.add("hidden");
  showToast(`${sender}님이 퀘스트를 깨줬어요! 노드에 깃발이 꽂혔어요 🚩`);
  renderJourneyMap();
}
function openJourneyRaidModal(node){
  state.pendingRaidNode=node;
  const g=state.fundingGauge[node.fundKey]||FUNDING_GAUGE[node.fundKey];
  const pct=g?Math.min(100,Math.round(g.raised/g.goal*100)):0;
  $("#journey-raid-emoji").textContent=node.emoji;
  $("#journey-raid-title").textContent=`[보스 퀘스트] ${node.name}`;
  $("#journey-raid-desc").textContent=node.raidCopy||"여러 명이 힘을 모아 성문을 열고 있어요!";
  $("#journey-raid-pct").textContent=`현재 ${pct}% 달성 · ${fmtPrice(g?.raised||0)} / ${fmtPrice(g?.goal||0)}`;
  $("#journey-raid-modal").classList.remove("hidden");
}
function openQuestGuide(){
  renderSeasonBanner();
  renderJourneyMap();
  showView("#quest-guide-view");
}
function refreshJourneyIfOpen(){
  if($("#quest-guide-view").classList.contains("active"))renderJourneyMap();
}
function openContributeModal(kind,key){
  if(!isSeasonOpen()){showToast("축하 시즌 기간에만 참여할 수 있어요");return;}
  state.pendingContribute={kind,key,amount:null};
  const grid=$("#amount-grid");
  const custom=$("#contribute-custom");
  $("#contribute-anon").checked=false;
  $("#contribute-sender").value="";
  custom.value="";custom.classList.add("hidden");
  grid.querySelectorAll(".amount-btn").forEach(b=>b.classList.remove("active"));
  if(kind==="gauge"){
    const cfg=state.fundingGauge[key]||FUNDING_GAUGE[key];
    $("#contribute-title").textContent=`${cfg.emoji||"🎁"} 조각 선물하기`;
    $("#contribute-desc").textContent=cfg.name;
    $("#contribute-funding-race-wrap")?.classList.remove("hidden");
    renderContributeGauge(key);
    grid.innerHTML=CONTRIBUTE_AMOUNTS.map(a=>`<button type="button" class="amount-btn" data-amt="${a}">${fmtPrice(a)}</button>`).join("")+
      `<button type="button" class="amount-btn custom" data-amt="custom">원하는 금액</button>`;
  }else{
    const q=state.collectQuests[key]||COLLECT_QUESTS[key];
    $("#contribute-title").textContent="한 장 선물하기";
    $("#contribute-desc").textContent=`${q.name} · 1장 ${fmtPrice(q.unitPrice)}`;
    $("#contribute-funding-race-wrap")?.classList.add("hidden");
    grid.innerHTML=`<button type="button" class="amount-btn active" data-amt="${q.unitPrice}">1장 선물 (${fmtPrice(q.unitPrice)})</button>`;
    state.pendingContribute.amount=q.unitPrice;
  }
  bindAmountGrid(grid,custom,amt=>{state.pendingContribute.amount=amt;});
  $("#contribute-modal").classList.remove("hidden");
}
function bindAmountGrid(gridEl,customEl,onSelect){
  if(!gridEl)return;
  gridEl.querySelectorAll(".amount-btn").forEach(btn=>{
    btn.onclick=()=>{
      gridEl.querySelectorAll(".amount-btn").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      if(btn.dataset.amt==="custom"){customEl?.classList.remove("hidden");onSelect(null);}
      else{customEl?.classList.add("hidden");onSelect(+btn.dataset.amt);}
    };
  });
}
function renderContributeGauge(key){
  const cfg=FUNDING_GAUGE[key];
  if(!cfg)return;
  const g=state.fundingGauge[key]||cfg;
  renderFundingRace("#contribute-funding-race",{raised:g.raised,goal:g.goal,emoji:cfg.emoji});
}
function submitContribute(){
  const {kind,key}=state.pendingContribute||{};
  if(!kind)return;
  const anon=$("#contribute-anon").checked;
  let sender=$("#contribute-sender").value.trim();
  if(!anon&&!sender){showToast("이름을 입력하거나 익명을 선택해 주세요");return;}
  if(anon)sender="익명";
  let amt=state.pendingContribute.amount;
  if(!amt){amt=+$("#contribute-custom").value;if(!amt||amt<1000){showToast("금액을 입력해 주세요");return;}}
  const questId=kind==="gauge"?key:(state.collectQuests[key]?.id||COLLECT_QUESTS[key].id);
  if(!state.contributors[questId])state.contributors[questId]=[];
  state.contributors[questId].push({name:sender,anon,amount:amt});
  if(kind==="gauge"){
    const g=state.fundingGauge[key];
    g.raised=Math.min(g.goal,g.raised+amt);
    save();
    renderFundingRace("#contribute-funding-race",{raised:g.raised,goal:g.goal,emoji:FUNDING_GAUGE[key]?.emoji,animate:true});
    $("#contribute-modal").classList.add("hidden");
    showToast(`${sender}님이 ${fmtPrice(amt)}을 선물했어요! 🎁`);
    if(g.raised>=g.goal)showToast((FUNDING_GAUGE[key].copy)||"펀딩이 완성됐어요! 🎉");
    refreshJourneyIfOpen();
  }else{
    const q=state.collectQuests[key];
    if(q.current>=q.target){showToast("이미 완성된 퀘스트예요");return;}
    q.current++;
    save();
    $("#contribute-modal").classList.add("hidden");
    showToast(`${sender}님이 1장을 선물했어요! 📦`);
    if(q.current>=q.target)showToast("단품 퀘스트가 완성됐어요! 🎉");
    refreshJourneyIfOpen();
  }
}
function openPplSheet(photoId){
  const p=getPhoto(photoId);if(!p||!p.ownedTag)return;
  $("#ppl-emoji").textContent="🎁";
  $("#ppl-title").textContent=p.ownedTag.itemName;
  $("#ppl-message").textContent=p.ownedTag.message||`${p.ownedTag.itemName}을(를) 잘 쓰고 있어요!`;
  $("#ppl-from").textContent=`${p.ownedTag.from}이(가) 선물해 줬어요`;
  $("#ppl-sheet").classList.remove("hidden");
}
function openNeedSheet(photoId){
  const p=getPhoto(photoId);if(!p)return;
  const age=p.ageMonth||9;
  const items=DEMO_NEED_ITEMS[age]||DEMO_NEED_ITEMS[9];
  $("#need-sheet-title").textContent=`${ageLabel(age)} ${babyName()}에게 지금 필요한 것`;
  $("#need-sheet-desc").textContent=`${babyName()}가 무릎을 보호하며 안전하게 기어 다닐 수 있도록 도와주세요!`;
  $("#need-sheet-list").innerHTML=items.map((it,i)=>`<button type="button" class="need-item" data-idx="${i}">
    <span class="need-item-emoji">${it.emoji}</span>
    <span class="need-item-info"><span class="need-item-name">${esc(it.name)}</span><span class="need-item-desc">${esc(it.desc)}</span></span>
  </button>`).join("");
  $("#need-sheet-list").querySelectorAll(".need-item").forEach(btn=>{
    btn.onclick=()=>{
      const it=items[+btn.dataset.idx];
      $("#need-sheet").classList.add("hidden");
      if(it.funding)openFundingSheet(it.id);
      else showToast(`${it.name} 퀘스트를 확인했어요`);
    };
  });
  $("#need-sheet").classList.remove("hidden");
}
function openFundingSheet(fundId){
  const cfg=FUNDING_ITEMS[fundId];if(!cfg)return;
  state.pendingFunding={fundId,amount:null};
  $("#funding-title").textContent=`${cfg.emoji} ${cfg.name}`;
  $("#funding-copy").textContent=cfg.copy;
  $("#funding-sender").value="";
  const custom=$("#funding-custom");
  custom.value="";custom.classList.add("hidden");
  const grid=$("#funding-amount-grid");
  grid.innerHTML=CONTRIBUTE_AMOUNTS.map(a=>`<button type="button" class="amount-btn" data-amt="${a}">${fmtPrice(a)}</button>`).join("")+
    `<button type="button" class="amount-btn custom" data-amt="custom">원하는 금액</button>`;
  bindAmountGrid(grid,custom,amt=>{state.pendingFunding.amount=amt;});
  renderFundingSheetGauge(fundId);
  $("#funding-sheet").classList.remove("hidden");
}
function renderFundingSheetGauge(fundId,{animate=false}={}){
  const cfg=FUNDING_ITEMS[fundId];
  if(!cfg)return;
  const stats=fundingItemStats(fundId);
  renderFundingRace("#funding-funding-race",{raised:stats.raised,goal:stats.goal,emoji:cfg.emoji,animate});
}
function submitFunding(){
  const sender=$("#funding-sender").value.trim();
  if(!sender){showToast("이름을 입력해 주세요");return;}
  const {fundId}=state.pendingFunding||{};
  if(!fundId)return;
  let amt=state.pendingFunding.amount;
  if(!amt){amt=+$("#funding-custom").value;if(!amt||amt<1000){showToast("금액을 선택해 주세요");return;}}
  const pieces=getFunding(fundId);
  const next=pieces.find(p=>!p.filled);
  if(!next){showToast("이미 완성된 펀딩이에요");return;}
  next.filled=true;
  next.from=sender;
  save();
  renderFundingSheetGauge(fundId,{animate:true});
  showToast(`${sender}님이 ${fmtPrice(amt)}을 선물했어요! 🎁`);
  const stats=fundingItemStats(fundId);
  if(stats.raised>=stats.goal)showToast(`${FUNDING_ITEMS[fundId].name} 퀘스트가 완성됐어요! 🎉`);
}
function initGameTab(){
  if(initGameTab._timer)return;
  let slide=0;
  initGameTab._timer=setInterval(()=>{
    if(!$("#game-tab-view")?.classList.contains("active"))return;
    slide=(slide+1)%3;
    $$(".ig-banner-slide").forEach(s=>s.classList.toggle("active",+s.dataset.slide===slide));
    const badge=$("#ig-banner-badge");
    if(badge)badge.textContent=`${slide+1} | 3`;
  },4000);
}
function openIgView(){switchMainTab("game");}
function getShareUrl(){
  const u=new URL(window.location.href.split("#")[0]);
  u.searchParams.set("guest","1");
  return u.toString();
}
function copyShareLink(url){
  const link=url||getShareUrl();
  if(navigator.clipboard&&navigator.clipboard.writeText){
    return navigator.clipboard.writeText(link).then(()=>showToast("메인 화면 링크가 복사되었어요"));
  }
  const inp=$("#share-link-input");
  inp.value=link;
  inp.select();
  document.execCommand("copy");
  return Promise.resolve(showToast("메인 화면 링크가 복사되었어요"));
}
function openShareLinkModal(url){
  $("#share-link-input").value=url||getShareUrl();
  const d=$("#share-modal .modal-desc");
  if(d)d.textContent=`${state.profile.name} 프로필 전체 링크예요. 복사해서 친구에게 보내세요.`;
  $("#share-modal").classList.remove("hidden");
}
async function shareProfileLink(){
  const url=getShareUrl();
  const title=state.profile.name||"다엘이의 일기";
  const text=`${title} 메인 화면을 확인해 보세요`;
  if(navigator.share){
    try{
      await navigator.share({title,text,url});
      addPoints(POINT_RULES.share,"share");
      showToast(`메인 화면을 공유하고 +${POINT_RULES.share}알 🥚`);
      addPuzzlePieces(3,"share");
      return;
    }catch(e){
      if(e.name==="AbortError")return;
    }
  }
  openShareLinkModal(url);
}
function copyShareLinkWithReward(url){
  return copyShareLink(url).then(()=>{
    addPoints(POINT_RULES.share,"share");
    showToast(`공유 링크 복사 · +${POINT_RULES.share}알 🥚`);
    addPuzzlePieces(3,"share");
    $("#share-modal").classList.add("hidden");
  });
}
function bindEvents(){
  $$(".tab-bar-item").forEach(btn=>btn.onclick=()=>switchMainTab(btn.dataset.tab));
  $("#btn-claim-coupon")?.addEventListener("click",()=>{
    const coupon=exchangeCoupon();
    if(!coupon){showToast("알이 부족해요 🥚 (1,000알 필요)");return;}
    renderPuzzleTab();
    renderSettingsTab();
    showToast("1,000원 장바구니 쿠폰으로 교환했어요! 🎟️");
  });
  $("#btn-mission-photo")?.addEventListener("click",openComposer);
  $("#btn-mission-share")?.addEventListener("click",()=>shareProfileLink());
  $("#btn-mission-game")?.addEventListener("click",()=>{
    switchMainTab("game");
    setTimeout(()=>{if(typeof openMinigameModal==="function")openMinigameModal();},250);
  });
  $("#btn-settings-save")?.addEventListener("click",()=>{
    const name=$("#settings-baby-name").value.trim();
    const age=parseInt($("#settings-baby-age").value,10);
    const kidikidiId=$("#settings-kidikidi-id")?.value.trim().replace(/\s+/g,"")||"";
    if(name)state.profile.babyName=name;
    if(!Number.isNaN(age)){
      state.profile.currentAge=age;
      // 가입 시점보다 어린 월령으로 정정하면 시작 칩도 함께 내려준다.
      if(state.profile.startAge==null||age<state.profile.startAge)state.profile.startAge=age;
    }
    state.profile.kidikidiId=kidikidiId;
    state.profile.name=(state.profile.babyName||"다엘이")+"의 일기";
    save();renderProfile();renderFeed();renderAgeQuestBadge();showToast("프로필을 저장했어요");
  });
  $("#settings-notify-visit")?.addEventListener("change",saveNotifySettings);
  $("#settings-notify-gift")?.addEventListener("change",saveNotifySettings);
  $("#btn-settings-wishlist")?.addEventListener("click",openWishlist);
  $("#btn-settings-journey")?.addEventListener("click",()=>switchMainTab("journey"));
  $("#btn-kakao-logout")?.addEventListener("click",()=>{
    if(typeof logoutKakao==="function")logoutKakao();
  });
  $("#btn-copy-invite-code")?.addEventListener("click",copyInviteCode);
  if(typeof bindMinigameEvents==="function")bindMinigameEvents();
  if(typeof bindGiftPuzzleEvents==="function")bindGiftPuzzleEvents();
  $("#btn-share")?.classList.remove("active");
  $("#btn-gift").onclick=openWishlist;
  $("#btn-back-guide")?.addEventListener("click",()=>switchMainTab("home"));
  // 성장 저니 상단: 선물하기/선물 퍼즐 바로가기
  $("#btn-journey-gift-shortcut")?.addEventListener("click",openWishlist);
  $("#btn-journey-puzzle-shortcut")?.addEventListener("click",()=>{openWishlist();setTimeout(()=>$("#btn-new-gift-puzzle")?.scrollIntoView({behavior:"smooth",block:"center"}),200);});
  $("#btn-add-feed-photo").onclick=openComposer;
  // 글쓰기(인스타식) 모달
  $("#btn-composer-cancel")?.addEventListener("click",closeComposer);
  $("#composer-backdrop")?.addEventListener("click",closeComposer);
  $("#btn-composer-submit")?.addEventListener("click",submitPost);
  $("#composer-photo-input")?.addEventListener("change",e=>{addComposerFiles(e.target.files);e.target.value="";});
  // 프로필 사진 변경
  $("#btn-change-avatar")?.addEventListener("click",()=>$("#avatar-input")?.click());
  $("#avatar-input")?.addEventListener("change",e=>{changeAvatar(e.target.files[0]);e.target.value="";});
  // 메인 배경 사진 변경
  $("#btn-change-bg")?.addEventListener("click",()=>$("#bg-input")?.click());
  $("#bg-input")?.addEventListener("change",e=>{changeBackground(e.target.files[0]);e.target.value="";});
  // 옷장 상품 사진 추가
  $("#btn-add-product-image")?.addEventListener("click",()=>$("#add-product-image-input")?.click());
  $("#add-product-image-input")?.addEventListener("change",e=>{pickAddProductImage(e.target.files[0]);e.target.value="";});
  // 프로필 → 게이미피케이션
  $(".profile-row")?.addEventListener("click",openProfileStats);
  $("#btn-pstats-close")?.addEventListener("click",closeProfileStats);
  $("#pstats-backdrop")?.addEventListener("click",closeProfileStats);
  $("#btn-pstats-journey")?.addEventListener("click",()=>{closeProfileStats();switchMainTab("journey");});
  $("#ppl-backdrop").onclick=()=>$("#ppl-sheet").classList.add("hidden");
  $("#need-backdrop").onclick=()=>$("#need-sheet").classList.add("hidden");
  $("#funding-backdrop").onclick=()=>$("#funding-sheet").classList.add("hidden");
  $("#btn-funding-submit").onclick=submitFunding;
  $("#contribute-backdrop").onclick=()=>$("#contribute-modal").classList.add("hidden");
  $("#btn-contribute-cancel").onclick=()=>$("#contribute-modal").classList.add("hidden");
  $("#btn-contribute-confirm").onclick=submitContribute;
  $("#journey-done-backdrop").onclick=()=>$("#journey-done-modal").classList.add("hidden");
  $("#btn-journey-done-close").onclick=()=>$("#journey-done-modal").classList.add("hidden");
  $("#btn-journey-photo-change")?.addEventListener("click",()=>{
    if($("#journey-done-edit")?.classList.contains("hidden"))return;
    $("#journey-photo-input")?.click();
  });
  $("#journey-done-photo-wrap")?.addEventListener("click",e=>{
    if(isGuest()||$("#journey-done-edit")?.classList.contains("hidden"))return;
    if(e.target.closest("#btn-journey-photo-change"))return;
    if(e.target.closest("#journey-done-img"))$("#journey-photo-input")?.click();
  });
  $("#btn-journey-memory-edit")?.addEventListener("click",startJourneyMemoryEdit);
  $("#btn-journey-memory-cancel")?.addEventListener("click",cancelJourneyMemoryEdit);
  $("#journey-photo-input")?.addEventListener("change",onJourneyPhotoFileChange);
  $("#btn-journey-memory-save")?.addEventListener("click",saveJourneyMemoryEdits);
  $("#journey-active-backdrop").onclick=()=>$("#journey-active-modal").classList.add("hidden");
  $("#btn-journey-active-close").onclick=()=>$("#journey-active-modal").classList.add("hidden");
  $("#btn-journey-gift").onclick=submitJourneyGift;
  $("#journey-raid-backdrop").onclick=()=>$("#journey-raid-modal").classList.add("hidden");
  $("#btn-journey-raid-close").onclick=()=>$("#journey-raid-modal").classList.add("hidden");
  $("#btn-journey-raid-go").onclick=()=>{
    const node=state.pendingRaidNode;
    $("#journey-raid-modal").classList.add("hidden");
    if(node?.fundKey)openContributeModal("gauge",node.fundKey);
  };
  $("#btn-back-wishlist").onclick=()=>switchMainTab("home");
  $$(".ig-grid-item").forEach(btn=>btn.onclick=()=>{
    if(btn.dataset.igGame==="tap"){if(typeof openMinigameModal==="function")openMinigameModal();return;}
    showToast(`${btn.dataset.ig} 준비 중이에요`);
  });
  $("#btn-ig-all").onclick=()=>showToast("전체 서비스 준비 중이에요");
  $("#btn-ig-studio").onclick=()=>showToast("AI 컨셉스튜디오로 이동할게요");
  $("#btn-ig-recommend").onclick=()=>showToast("추천 콘텐츠를 불러올게요");
  $("#stage-prev").onclick=()=>{if(state.currentStage>0){state.currentStage--;renderStageNav();renderWishlistGrid();}};
  $("#stage-next").onclick=()=>{if(state.currentStage<STAGES.length-1){state.currentStage++;renderStageNav();renderWishlistGrid();}};
  let tx=0;
  const nav=$("#stage-nav");
  nav.addEventListener("touchstart",e=>{tx=e.touches[0].clientX;},{passive:true});
  nav.addEventListener("touchend",e=>{
    const dx=e.changedTouches[0].clientX-tx;
    if(Math.abs(dx)<40)return;
    if(dx<0&&state.currentStage<STAGES.length-1){state.currentStage++;renderStageNav();renderWishlistGrid();}
    if(dx>0&&state.currentStage>0){state.currentStage--;renderStageNav();renderWishlistGrid();}
  },{passive:true});
  $("#btn-close-picker").onclick=()=>$("#product-picker-modal").classList.add("hidden");
  $("#picker-backdrop").onclick=()=>$("#product-picker-modal").classList.add("hidden");
  $("#picker-owned-check").onchange=saveOwnedFromPicker;
  $("#photo-input").onchange=e=>{addPhotosFromFiles(e.target.files);e.target.value="";};
  $("#btn-toggle-add-product").onclick=()=>{
    const form=$("#add-product-form");
    const open=form.classList.toggle("hidden");
    $("#btn-toggle-add-product").textContent=open?"+ 상품 추가":"입력 닫기";
    if(!open)$("#add-product-name").focus();
  };
  $("#btn-add-product").onclick=addProduct;
  $("#btn-share").onclick=shareProfileLink;
  $("#btn-cancel-share").onclick=()=>$("#share-modal").classList.add("hidden");
  $("#share-modal-backdrop").onclick=()=>$("#share-modal").classList.add("hidden");
  $("#btn-copy-link").onclick=()=>copyShareLinkWithReward();
  $("#btn-close-viewer").onclick=closePhotoDetail;
  document.addEventListener("keydown",e=>{
    if(e.key==="Escape"&&!$("#photo-detail").classList.contains("hidden"))closePhotoDetail();
  });
  $("#btn-like").onclick=toggleLike;
  $("#btn-open-comments").onclick=openCommentSheet;
  $("#comment-backdrop").onclick=closeCommentSheet;
  $("#btn-send-comment").onclick=sendComment;
  const cInput=$("#comment-input");
  cInput.oninput=()=>$("#btn-send-comment").classList.toggle("active",!!cInput.value.trim());
  cInput.onkeydown=e=>{if(e.key==="Enter")sendComment();};
  $("#btn-comment-emoji").onclick=()=>{cInput.value+=["😊","❤️","👍","🎉","😍"][Math.floor(Math.random()*5)];cInput.focus();$("#btn-send-comment").classList.add("active");};
}
function saveNotifySettings(){
  localStorage.setItem("photoShare_notify",JSON.stringify({
    visit:$("#settings-notify-visit")?.checked!==false,
    gift:$("#settings-notify-gift")?.checked!==false
  }));
}
function enterMainApp(){
  renderProfile();
  renderFeed();
  renderAgeQuestBadge();
  renderPointsUI();
  switchMainTab("home");
  if(new URLSearchParams(location.search).get("map")==="1")requestAnimationFrame(()=>openQuestGuide());
}
window.enterMainApp=enterMainApp;
window.state=state;
window.save=save;
window.ensureInviteCode=ensureInviteCode;
window.getInviteCode=getInviteCode;
window.isValidInviteCode=isValidInviteCode;
window.copyInviteCode=copyInviteCode;
async function bootApp(){
  load();
  // 선물 퍼즐 공유 링크: ?family=코드 로 가족을 지정해 같은 퍼즐을 채울 수 있게 한다.
  const _bp=new URLSearchParams(location.search);
  const _fam=_bp.get("family");
  if(_fam)localStorage.setItem(STORAGE_KEYS.inviteCode,_fam.trim().toUpperCase());
  const _giftId=_bp.get("giftpuzzle");
  if(typeof initKakaoAuth==="function")await initKakaoAuth();
  if(typeof syncFamilyDataFromServer==="function"){
    const synced=await syncFamilyDataFromServer();
    if(synced){
      initFundingGauge();
      initCollectQuests();
      Object.keys(FUNDING_ITEMS).forEach(k=>{
        if(!state.funding[k])state.funding[k]=FUNDING_ITEMS[k].pieces.map(p=>({...p,filled:!!p.from}));
      });
    }
  }
  await syncPhotosFromServer();
  migratePuzzleMissionImage();
  migratePhotoQuestLinks();
  bindEvents();
  // 선물 퍼즐 링크로 들어오면 온보딩을 건너뛰고 바로 채우기 화면을 연다.
  if(_giftId){
    enterMainApp();
    if(typeof openGiftPuzzleFill==="function")requestAnimationFrame(()=>openGiftPuzzleFill(_giftId));
    return;
  }
  const needsOnboarding=typeof initOnboarding==="function"&&initOnboarding();
  if(needsOnboarding)hideTabBar();
  else enterMainApp();
}
bootApp();
