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
let state={photos:[],friends:[],inbox:[],profile:{...DEFAULT_PROFILE},wishlist:{},owned:{},hidden:{},itemProducts:{},funding:{},fundingGauge:{},gaugePuzzles:{},collectQuests:{},contributors:{},journeyGifts:{},journeyMemories:{},parentQuestPhotos:{},points:0,coupons:[],posts:[],published:{},giftedBy:{},likeAwarded:0,journeyJustCleared:null,viewingPostId:null,currentStage:0,currentAgeTab:"all",pendingGift:null,viewingPhotoId:null,pendingFunding:null,pendingContribute:null,pendingJourneyNode:null,pendingRaidNode:null,pendingJourneyEditNode:null};
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
  try{state.published=JSON.parse(localStorage.getItem(STORAGE_KEYS.wishlist+"_published")||"{}")||{};}catch(_){state.published={};}
  try{state.giftedBy=JSON.parse(localStorage.getItem(STORAGE_KEYS.wishlist+"_giftedby")||"{}")||{};}catch(_){state.giftedBy={};}
  try{state.giftedMsg=JSON.parse(localStorage.getItem(STORAGE_KEYS.wishlist+"_giftedmsg")||"{}")||{};}catch(_){state.giftedMsg={};}
  try{state.guestbook=JSON.parse(localStorage.getItem(STORAGE_KEYS.wishlist+"_guestbook")||"[]")||[];}catch(_){state.guestbook=[];}
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
  localStorage.setItem(STORAGE_KEYS.wishlist+"_published",JSON.stringify(state.published||{}));
  localStorage.setItem(STORAGE_KEYS.wishlist+"_giftedby",JSON.stringify(state.giftedBy||{}));
  localStorage.setItem(STORAGE_KEYS.wishlist+"_giftedmsg",JSON.stringify(state.giftedMsg||{}));
  localStorage.setItem(STORAGE_KEYS.wishlist+"_guestbook",JSON.stringify(state.guestbook||[]));
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
}
function save(){
  saveLocalCache();
  if(typeof schedulePushFamilyData==="function")schedulePushFamilyData();
}
window.saveLocalCache=saveLocalCache;
function showToast(m){const t=$("#toast");t.textContent=m;t.classList.remove("hidden");clearTimeout(showToast._t);showToast._t=setTimeout(()=>t.classList.add("hidden"),2500);}
// 고객 여정 이벤트 적재(서버 events 테이블에 쌓임)
function track(type,meta){
  try{
    fetch("/api/track",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({family:(typeof getFamilyId==="function"?getFamilyId():"BEBEBOX"),actor:"parent",type:type,meta:meta||{}})}).catch(()=>{});
  }catch(_){}
}
window.track=track;
async function loadJourneyStats(){
  const el=$("#journey-stats");
  if(!el)return;
  try{
    const fam=encodeURIComponent(typeof getFamilyId==="function"?getFamilyId():"BEBEBOX");
    const r=await fetch("/api/journey?family="+fam);
    const j=await r.json();
    const f=j.funnel||{};
    const guests=(j.guests||[]).slice(0,8);
    el.innerHTML=
      `<div class="jr-grid">
        <div class="jr-cell"><span class="jr-num">${f.views||0}</span><span class="jr-label">👀 본 사람</span></div>
        <div class="jr-cell"><span class="jr-num">${f.gift_clicks||0}</span><span class="jr-label">🛍 선물 클릭</span></div>
        <div class="jr-cell"><span class="jr-num">${f.gifts_done||0}</span><span class="jr-label">🎁 선물 완료</span></div>
        <div class="jr-cell"><span class="jr-num">${f.hearts||0}</span><span class="jr-label">❤️ 하트</span></div>
        <div class="jr-cell"><span class="jr-num">${f.comments||0}</span><span class="jr-label">💬 댓글</span></div>
        <div class="jr-cell"><span class="jr-num">${f.records||0}</span><span class="jr-label">📷 기록</span></div>
      </div>`+
      (guests.length?`<div class="jr-guests"><p class="jr-guests-title">함께한 지인</p>`+
        guests.map(g=>`<div class="jr-guest"><b>${esc(g.name)}</b><span>${g.gift_done?`🎁${g.gift_done} `:""}${g.heart?`❤️${g.heart} `:""}${g.comment?`💬${g.comment}`:""}</span></div>`).join("")+`</div>`:`<p class="jr-empty">공유 링크를 보내면 지인 반응이 여기에 쌓여요</p>`);
  }catch(_){el.innerHTML='<p class="jr-empty">성과를 불러올 수 없어요</p>';}
}
const TAB_VIEWS={my:"#my-view",home:"#profile-view",puzzle:"#puzzle-tab-view",game:"#game-tab-view",settings:"#settings-tab-view"};
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
  if(tab==="my")renderMyDashboard();
  if(tab==="home"){renderProfile();renderFeed();}
  if(tab==="puzzle")renderPuzzleTab({animate});
  if(tab==="settings")renderSettingsTab();
  if(tab==="game"){initGameTab();applyGameBanner();renderPointsUI();}
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
  if(hint)hint.textContent=pieces>=PUZZLE_TOTAL?`오늘 보너스 +${POINT_RULES.missionBonus}캔디를 받았어요! 🍬`:`9칸을 다 채우면 보너스 +${POINT_RULES.missionBonus}캔디! 🎉`;
  renderPointsUI();
}
function renderPointsUI(){
  const pts=getPoints();
  $$(".js-point-balance").forEach(el=>{el.textContent=formatPoints(pts);});
  const ok=canExchangeCoupon();
  const won=POINT_RULES.couponAmount.toLocaleString("ko-KR");
  const ex=$("#btn-claim-coupon");
  if(ex){
    ex.disabled=!ok;
    ex.classList.toggle("is-ready",ok);
    ex.textContent=ok?`🎟️ ${POINT_RULES.couponCost}캔디 → ${won}원 상품권 받기`:`🎟️ 상품권까지 ${formatPoints(POINT_RULES.couponCost-pts)}캔디`;
  }
  const sx=$("#btn-settings-exchange");
  if(sx){
    sx.disabled=!ok;
    sx.classList.toggle("is-ready",ok);
    sx.textContent=ok?`🎟️ ${POINT_RULES.couponCost}캔디 → ${won}원 상품권`:`상품권까지 ${formatPoints(POINT_RULES.couponCost-pts)}캔디`;
  }
  const fill=$("#candy-progress-fill");
  if(fill)fill.style.width=Math.min(100,Math.round(pts/POINT_RULES.couponCost*100))+"%";
  const ptxt=$("#candy-progress-text");
  if(ptxt)ptxt.textContent=ok?"지금 상품권으로 바꿀 수 있어요! 🎉":`상품권까지 ${formatPoints(POINT_RULES.couponCost-pts)}캔디`;
}
function onPointsChanged(){renderPointsUI();}
function onPointsEarned(){}
function onPointsSpent(){}
window.renderPointsUI=renderPointsUI;
function appLogout(){
  const code=(typeof getInviteCode==="function"&&getInviteCode())||"";
  if(!confirm("로그아웃 할까요?"+(code?`\n\n다시 들어올 때 초대코드 ${String(code).toUpperCase()} 가 필요할 수 있어요.`:"")))return;
  try{fetch("/api/auth/logout",{method:"POST",credentials:"include"}).catch(()=>{});}catch(_){}
  try{
    localStorage.removeItem("photoShare_kakao");
    localStorage.removeItem("photoShare_auth");
    localStorage.removeItem("photoShare_onboarded");
  }catch(_){}
  showToast("로그아웃 되었어요");
  setTimeout(()=>location.reload(),400);
}
function appDeleteAccount(){
  if(!confirm("정말 탈퇴할까요?\n모든 기록·위시·캔디·쿠폰이 삭제되고 되돌릴 수 없어요."))return;
  if(!confirm("마지막 확인이에요. 탈퇴하면 복구할 수 없어요. 계속할까요?"))return;
  const fam=encodeURIComponent(typeof getFamilyId==="function"?getFamilyId():"");
  showToast("탈퇴 처리 중...");
  fetch("/api/family/delete?family="+fam,{method:"POST"}).catch(()=>{}).finally(()=>{
    try{fetch("/api/auth/logout",{method:"POST",credentials:"include"}).catch(()=>{});}catch(_){}
    try{localStorage.clear();}catch(_){}
    setTimeout(()=>location.reload(),500);
  });
}
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
  // 마이 상단 프로필 + 통계
  const mha=$("#my-hero-avatar");if(mha)mha.src=state.profile.avatar;
  const mhn=$("#my-hero-name");if(mhn)mhn.textContent=babyName();
  const mhs=$("#my-hero-sub");if(mhs)mhs.textContent=`${ageLabel(state.profile.currentAge)} · 성장 기록 중`;
  const now=new Date(),mTotal=state.posts.length;
  const mMonth=state.posts.filter(p=>{const d=new Date(p.createdAt);return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();}).length;
  const mHeart=state.posts.reduce((s,p)=>s+(p.gauge||0),0);
  reconcileLikePoints();
  const st=$("#my-stat-total");if(st)st.textContent=mTotal;
  const sm=$("#my-stat-month");if(sm)sm.textContent=mMonth;
  const sh=$("#my-stat-heart");if(sh)sh.textContent=mHeart;
  loadJourneyStats();
  renderPointsUI();
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
  renderCouponBox();
  refreshCouponStatus();
  const notify=JSON.parse(localStorage.getItem("photoShare_notify")||"{}");
  $("#settings-notify-visit").checked=notify.visit!==false;
  $("#settings-notify-gift").checked=notify.gift!==false;
}
/* ─── 내 쿠폰함: 운영자 발급 상태 반영 + 3개까지만, 더보기 ─────────── */
let _couponStatus={};      // {coupon_id:{fulfilled,fulfilled_at}} (서버 발급 상태)
let _couponsExpanded=false;
function _couponDateLabel(c){
  const st=_couponStatus[c.id];
  const ms=(st&&st.fulfilled_at)||c.createdAt;
  if(!ms)return c.expires||"";
  const d=new Date(ms);
  return `${("0"+(d.getMonth()+1)).slice(-2)}/${("0"+d.getDate()).slice(-2)}`;
}
function renderCouponBox(){
  const coupons=getCoupons();
  const cnt=$("#coupon-count");if(cnt)cnt.textContent=String(coupons.length);
  const list=$("#coupon-list");
  if(!list)return;
  if(!coupons.length){
    list.innerHTML=`<div class="coupon-empty">아직 받은 쿠폰이 없어요.<br/>100캔디를 모으면 키디키디 3,000원 상품권으로 바꿀 수 있어요!</div>`;
    return;
  }
  const sorted=[...coupons].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  const shown=_couponsExpanded?sorted:sorted.slice(0,3);
  const rows=shown.map(c=>{
    const amt=c.percent?`${c.percent}% 할인`:`${(c.amount||0).toLocaleString("ko-KR")}원`;
    const st=_couponStatus[c.id];
    const badge=st&&st.fulfilled
      ?`<span class="coupon-badge done">✓ 발급완료</span>`
      :`<span class="coupon-badge wait">발급 대기</span>`;
    return`<div class="coupon-row">
      <span class="coupon-row-ic">🎟️</span>
      <span class="coupon-row-body"><b>${amt} 상품권</b><small>코드 ${esc(c.code)} · ${_couponDateLabel(c)}</small></span>
      ${badge}
    </div>`;
  }).join("");
  let more="";
  if(sorted.length>3){
    more=_couponsExpanded
      ?`<button type="button" class="coupon-more" id="btn-coupon-more">접기 ▲</button>`
      :`<button type="button" class="coupon-more" id="btn-coupon-more">쿠폰 ${sorted.length-3}개 더보기 ▼</button>`;
  }
  list.innerHTML=rows+more;
  const mb=$("#btn-coupon-more");
  if(mb)mb.onclick=()=>{_couponsExpanded=!_couponsExpanded;renderCouponBox();};
}
async function refreshCouponStatus(){
  try{
    const fam=encodeURIComponent(typeof getFamilyId==="function"?getFamilyId():"BEBEBOX");
    const r=await fetch("/api/coupons?family="+fam);
    const j=await r.json();
    _couponStatus=(j&&j.status)||{};
    renderCouponBox();
  }catch(_){}
}
function onPuzzlePiecesChanged(gained,source,total,bonus){
  renderPuzzleTab({animate:gained>0});
  if(bonus>0)showToast(`오늘 미션 완성! 보너스 +${bonus}캔디 🎉`);
  else if(gained>0&&currentMainTab!=="puzzle")showToast(`퍼즐 ${gained}조각! (${total}/${PUZZLE_TOTAL})`);
}
window.onPuzzlePiecesChanged=onPuzzlePiecesChanged;
window.switchMainTab=switchMainTab;
// 좋아요(하트) 누적이 일정 단위마다 캔디를 적립한다. (이미 적립한 만큼은 건너뜀)
function reconcileLikePoints(){
  if(typeof addPoints!=="function")return;
  const total=(state.posts||[]).reduce((s,p)=>s+(p.gauge||0),0);
  const unit=POINT_RULES.likeUnit||200,reward=POINT_RULES.likeReward||10;
  const due=Math.floor(total/unit),claimed=state.likeAwarded||0;
  if(due>claimed){
    addPoints((due-claimed)*reward,"likes");
    state.likeAwarded=due;
    if(typeof save==="function")save();
    if(typeof showToast==="function")showToast(`좋아요 ${due*unit}개 달성 · +${(due-claimed)*reward}캔디 ❤️`);
  }
}
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
  if(p.visibility==null)p.visibility="all"; // all=전체공개, me=나만보기
  return p;
}
function getPost(id){return state.posts.find(p=>p.id===id);}
function filterPostsByAge(){
  const all=[...state.posts].sort((a,b)=>b.createdAt-a.createdAt);
  if(state.currentAgeTab==="all")return all;
  // 유효하지 않은(예전 형식의) 탭 값이면 전체를 보여줘 글이 사라지지 않게 한다.
  if(!ageStepById(state.currentAgeTab)){state.currentAgeTab="all";return all;}
  return all.filter(p=>ageChipId(p.ageMonth)===state.currentAgeTab);
}
function renderGiftProgress(){
  const el=$("#gift-progress");
  if(!el)return;
  const pub=state.published||{},owned=state.owned||{};
  let total=0,done=0;
  Object.keys(pub).forEach(id=>{if(pub[id]){total++;if(owned[id])done++;}});
  if(!total){el.classList.add("hidden");el.innerHTML="";return;}
  el.classList.remove("hidden");
  const pct=Math.round(done/total*100);
  const reward=(typeof POINT_RULES!=="undefined"?POINT_RULES.giftReceived:50);
  const msg=done>=total
    ?`🎉 받고 싶던 선물을 모두 받았어요!`
    :`선물 1개 받을 때마다 +${reward}🍬 적립돼요`;
  el.innerHTML=
    `<div class="gp-top"><span class="gp-title">🎁 받고 싶은 선물 ${done}/${total}개 도착</span><span class="gp-count">${pct}%</span></div>`+
    `<div class="gp-bar"><div class="gp-fill" style="width:${pct}%"></div></div>`+
    `<div class="gp-sub">${msg} · 탭해서 위시 관리 ›</div>`;
}
// 홈 상단 "이렇게 모으고 이렇게 써요" 흐름 가이드(핵심 루프를 한눈에).
function renderHomeFlow(){
  const el=$("#home-flow");if(!el)return;
  const R=(typeof POINT_RULES!=="undefined")?POINT_RULES:{photo:20,likeReward:10,giftReceived:50,couponCost:100,couponAmount:3000};
  const collapsed=localStorage.getItem("bbx_flow_collapsed")==="1";
  el.classList.toggle("collapsed",collapsed);
  el.innerHTML=
    `<button type="button" class="hf-head" id="hf-toggle">
       <span class="hf-title">🍬 이렇게 모으고, 이렇게 써요</span>
       <span class="hf-caret">${collapsed?"펼치기 ▾":"접기 ▴"}</span>
     </button>
     <div class="hf-body">
       <div class="hf-steps">
         <div class="hf-step" data-go="write"><span class="hf-ic">✍️</span><span class="hf-lb">일기 쓰기</span><span class="hf-rw">+${R.photo}🍬</span></div>
         <span class="hf-arrow">›</span>
         <div class="hf-step"><span class="hf-ic">❤️</span><span class="hf-lb">친구 공감</span><span class="hf-rw">+${R.likeReward}🍬</span></div>
         <span class="hf-arrow">›</span>
         <div class="hf-step" data-go="wish"><span class="hf-ic">🎁</span><span class="hf-lb">선물 도착</span><span class="hf-rw">+${R.giftReceived}🍬</span></div>
         <span class="hf-arrow">›</span>
         <div class="hf-step"><span class="hf-ic">🍬</span><span class="hf-lb">캔디 적립</span></div>
         <span class="hf-arrow">›</span>
         <div class="hf-step hf-step--use" data-go="game"><span class="hf-ic">✨</span><span class="hf-lb">AI·게임·꾸미기</span></div>
       </div>
       <p class="hf-foot">모은 캔디 🍬는 AI 분석·게임에 쓰고, ${R.couponCost}개면 ${R.couponAmount.toLocaleString("ko-KR")}원 상품권으로도 바꿔요</p>
     </div>`;
  $("#hf-toggle").onclick=()=>{
    const now=!el.classList.contains("collapsed");
    el.classList.toggle("collapsed",now);
    localStorage.setItem("bbx_flow_collapsed",now?"1":"0");
    const c=$("#hf-toggle .hf-caret");if(c)c.textContent=now?"펼치기 ▾":"접기 ▴";
  };
  el.querySelectorAll(".hf-step[data-go]").forEach(s=>{
    s.onclick=()=>{
      const g=s.dataset.go;
      if(g==="write"&&typeof openComposer==="function")openComposer();
      else if(g==="wish"&&typeof openWishlist==="function")openWishlist();
      else if(g==="game"&&typeof switchMainTab==="function")switchMainTab("game");
    };
  });
}
// 마이(대시보드) 탭: 프로필·캔디 + 흐름 가이드 + 오늘 할 일 + 선물 달성률
function renderMyProfile(){
  const el=$("#my-profile");if(!el)return;
  const code=(typeof getInviteCode==="function"&&getInviteCode())||state.profile.inviteCode||"-";
  el.innerHTML=`<img class="myp-av" src="${state.profile.avatar}" alt=""/>`+
    `<span class="myp-tx"><b>${esc(babyName())}</b><span>${esc(state.profile.status||"우리 가족 공간")} · 코드 ${esc(code)}</span></span>`+
    `<span class="myp-go">⚙️</span>`;
  el.onclick=()=>switchMainTab("settings");
}
function renderMyTodos(){
  const el=$("#my-todos");if(!el)return;
  const R=(typeof POINT_RULES!=="undefined")?POINT_RULES:{photo:20,share:30,giftReceived:50};
  const todos=[
    {em:"✍️",b:"오늘 일기 쓰기",s:`기록하면 +${R.photo}🍬`,go:()=>{if(typeof openComposer==="function")openComposer();}},
    {em:"📤",b:"가족에게 공유하기",s:`공유하면 +${R.share}🍬`,go:()=>{if(typeof openSharePreview==="function")openSharePreview();}},
    {em:"🎁",b:"받고 싶은 선물 정하기",s:`받을 때마다 +${R.giftReceived}🍬`,go:()=>{if(typeof openWishlist==="function")openWishlist();}},
  ];
  el.innerHTML=`<p class="my-sec-title">오늘 할 일</p>`+todos.map((t,i)=>`<button type="button" class="my-todo" data-td="${i}"><span class="td-em">${t.em}</span><span class="td-tx"><b>${t.b}</b><span>${t.s}</span></span><span class="td-go">›</span></button>`).join("");
  el.querySelectorAll("[data-td]").forEach(b=>b.onclick=()=>todos[+b.dataset.td].go());
}
function renderMyDashboard(){
  renderMyProfile();
  if(typeof renderHomeFlow==="function")renderHomeFlow();
  renderMyTodos();
  if(typeof renderGiftProgress==="function")renderGiftProgress();
  if(typeof renderPointsUI==="function")renderPointsUI();
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
    const visBadge=p.visibility==="me"?`<span class="post-vis">🔒 나만</span>`:`<span class="post-vis pub">🌏 전체</span>`;
    return`<article class="post-card" data-id="${p.id}">
      <div class="post-head">
        <img class="post-avatar" src="${esc(state.profile.avatar)}" alt=""/>
        <div class="post-head-meta"><div class="post-name">${esc(state.profile.name)} ${visBadge}</div><div class="post-date">${esc(fmtPhotoDate(p.createdAt))} · ${esc(ageLabel(p.ageMonth))}</div></div>
        <button type="button" class="post-menu-btn owner-only" data-menu="${p.id}" aria-label="더보기">⋯</button>
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
  feed.querySelectorAll("[data-menu]").forEach(b=>b.onclick=e=>{e.stopPropagation();openPostMenu(b.dataset.menu);});
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
function openPostMenu(id){
  const p=getPost(id);if(!p)return;
  const priv=p.visibility==="me";
  const body=$("#post-menu-body");
  $("#post-menu-title").textContent=priv?"🔒 나만 보는 글":"🌏 전체 공개 글";
  body.innerHTML=
    `<button type="button" class="wish-act-btn" data-pa="vis">${priv?"🌏 전체 공개로 바꾸기":"🔒 나만 보기로 바꾸기"}</button>`+
    `<button type="button" class="wish-act-btn" data-pa="edit">✏️ 글 내용 수정</button>`+
    `<button type="button" class="wish-act-btn danger" data-pa="del">🗑 삭제</button>`;
  body.querySelectorAll("[data-pa]").forEach(b=>b.onclick=()=>doPostAction(id,b.dataset.pa));
  $("#post-menu-sheet").classList.remove("hidden");
}
function closePostMenu(){$("#post-menu-sheet")?.classList.add("hidden");}
function doPostAction(id,act){
  const p=getPost(id);
  if(!p){closePostMenu();return;}
  if(act==="vis"){
    p.visibility=p.visibility==="me"?"all":"me";
    showToast(p.visibility==="me"?"나만 보기로 바꿨어요 🔒":"전체 공개로 바꿨어요 🌏");
  }else if(act==="edit"){
    const t=prompt("글 내용 수정",p.text||"");
    if(t===null)return;
    p.text=t.trim();
    showToast("글을 수정했어요");
  }else if(act==="del"){
    if(!confirm("이 글을 삭제할까요?"))return;
    state.posts=state.posts.filter(x=>x.id!==id);
    showToast("글을 삭제했어요");
  }
  save();
  if(typeof pushFamilyDataToServerNow==="function")pushFamilyDataToServerNow().catch(()=>{});
  renderFeed();closePostMenu();
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
let composerVisibility="all";
function setComposerVisibility(v){
  composerVisibility=(v==="me")?"me":"all";
  document.querySelectorAll("#composer-vis [data-vis]").forEach(b=>b.classList.toggle("on",b.dataset.vis===composerVisibility));
}
function openComposer(){
  composerFiles=[];
  const t=$("#composer-text");if(t)t.value="";
  setComposerVisibility("all");
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
  const post=ensurePostMeta({id:"post"+Date.now(),text,photos:srcs,ageMonth:state.profile.currentAge||9,createdAt:Date.now(),gauge:0,comments:[],visibility:composerVisibility});
  state.posts.unshift(post);
  save();
  // 새로고침 경합으로 글이 사라지지 않게 즉시 서버에도 반영
  if(typeof pushFamilyDataToServerNow==="function")pushFamilyDataToServerNow().catch(()=>{});
  track("record",{photos:srcs.length,hasText:!!text});
  if(btn)btn.disabled=false;
  closeComposer();
  switchMainTab("home");
  renderFeed();
  addPoints(POINT_RULES.photo,"photo");
  addPuzzlePieces(1,"post");
  showToast(`글을 올렸어요 · +${POINT_RULES.photo}캔디 🍬`);
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
function growthTier(records){
  if(records>=100)return"기록왕 👑";
  if(records>=50)return"성장왕 🌟";
  if(records>=20)return"탐험가 🧭";
  if(records>=5)return"꼬물이 🐛";
  return"새싹 🌱";
}
function openProfileStats(){
  const records=state.posts.length;
  $("#pstats-name").textContent=state.profile.name;
  $("#pstats-avatar").src=state.profile.avatar;
  $("#pstats-tier").textContent=`${growthTier(records)} 등극!`;
  $("#pstats-points").textContent=formatPoints(getPoints());
  $("#pstats-posts").textContent=String(records);
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
    save();renderFeed();addPoints(POINT_RULES.photo,"photo");showToast(`${ok}장 저장 · +${POINT_RULES.photo}캔디 🍬`);addPuzzlePieces(1,"photo");
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
function _commentItemHtml(c,isReply){
  return `<div class="comment-item${isReply?" reply":""}">
    <img class="comment-item-avatar" src="${c.avatar||state.profile.avatar}" alt=""/>
    <div class="comment-item-body">
      <div class="comment-item-author">${esc(c.author)}</div>
      <div class="comment-item-text">${esc(c.text)}</div>
      <div class="comment-item-meta"><span class="comment-item-time">${fmtCommentTime(c.at)}</span>${isReply?"":`<button type="button" class="comment-reply-link" data-reply="${c.id}" data-name="${esc(c.author)}">답글</button>`}</div>
    </div>
  </div>`;
}
function renderComments(){
  const p=getPost(state.viewingPostId);
  const list=$("#comment-list");
  if(!p||!p.comments.length){
    list.innerHTML='<p class="comment-empty">첫 댓글을 남겨보세요.</p>';
    return;
  }
  list.innerHTML=p.comments.map(c=>
    `<div class="comment-thread">${_commentItemHtml(c,false)}${(c.replies||[]).map(r=>_commentItemHtml(r,true)).join("")}</div>`
  ).join("");
  list.querySelectorAll("[data-reply]").forEach(b=>b.onclick=()=>startReply(b.dataset.reply,b.dataset.name));
  list.scrollTop=list.scrollHeight;
}
let _replyTo=null;
function startReply(cid,name){
  _replyTo=cid;
  const bar=$("#comment-reply-bar");
  if(bar){bar.classList.remove("hidden");const n=$("#comment-reply-name");if(n)n.textContent=name||"";}
  const ci=$("#comment-input");if(ci){ci.placeholder="답글 쓰기";ci.focus();}
}
function cancelReply(){
  _replyTo=null;
  $("#comment-reply-bar")?.classList.add("hidden");
  const ci=$("#comment-input");if(ci)ci.placeholder="댓글 쓰기";
}
function openCommentSheet(){
  cancelReply();
  renderComments();
  $("#comment-input").value="";
  $("#btn-send-comment").classList.remove("active");
  $("#comment-sheet").classList.remove("hidden");
  setTimeout(()=>$("#comment-input").focus(),300);
}
function closeCommentSheet(){cancelReply();$("#comment-sheet").classList.add("hidden");}
function sendComment(){
  const text=$("#comment-input").value.trim();
  if(!text)return;
  const p=getPost(state.viewingPostId);
  if(!p)return;
  const me=(typeof getStoredKakaoUser==="function"&&getStoredKakaoUser()?.nickname)||state.profile.name;
  const av=(typeof getStoredKakaoUser==="function"&&getStoredKakaoUser()?.profileImage)||state.profile.avatar;
  if(_replyTo){
    const c=p.comments.find(x=>x.id===_replyTo);
    if(c){if(!Array.isArray(c.replies))c.replies=[];c.replies.push({author:me,text,avatar:av,at:Date.now()});}
    cancelReply();
  }else{
    p.comments.push({id:"c"+Date.now(),author:me,text,avatar:av,at:Date.now(),replies:[]});
  }
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
// 받은 선물을 선반에 올리고 그 위에 준 사람 이름을 단다.
function collectReceivedGifts(){
  const out=[],seen={};
  Object.values(state.wishlist||{}).forEach(arr=>(arr||[]).forEach(it=>{
    if(it&&state.owned[it.id]&&!seen[it.id]){
      seen[it.id]=1;
      out.push({id:it.id,emoji:it.emoji||"🎁",name:it.name,giver:state.giftedBy[it.id]||""});
    }
  }));
  return out;
}
function giftShelfHtml(gifts,emptyMsg){
  if(!gifts.length)return `<div class="shelf-empty">${esc(emptyMsg)}</div>`;
  const per=4,rows=[];
  for(let i=0;i<gifts.length;i+=per)rows.push(gifts.slice(i,i+per));
  return `<div class="gift-shelf-wrap">`+rows.map(row=>
    `<div class="shelf"><div class="shelf-objs">`+row.map(g=>{
      const obj=g.image?`<span class="shelf-obj"><img src="${esc(g.image)}" alt=""/></span>`:`<span class="shelf-obj">${esc(g.emoji||"🎁")}</span>`;
      const giver=g.giver?`<span class="shelf-giver">${esc(g.giver)}</span>`:`<span class="shelf-giver muted">선물</span>`;
      const tappable=g.id?` shelf-item--tappable`:"";
      const dataId=g.id?` data-id="${esc(g.id)}"`:"";
      return `<span class="shelf-item${tappable}"${dataId}>${giver}${obj}</span>`;
    }).join("")+`</div><div class="shelf-board"></div></div>`
  ).join("")+`</div>`;
}
function renderGiftShelf(){
  const el=$("#gift-shelf");if(!el)return;
  el.innerHTML=giftShelfHtml(collectReceivedGifts(),"아직 받은 선물이 없어요");
  el.querySelectorAll(".shelf-item--tappable").forEach(s=>{
    s.onclick=()=>openGiftMessageSheet(s.dataset.id);
  });
}
// 위시 아이템을 id로 찾는다(어느 단계에 있든).
function wishItemById(id){
  for(const arr of Object.values(state.wishlist||{})){
    const f=(arr||[]).find(i=>i&&i.id===id);
    if(f)return f;
  }
  return null;
}
// 받은 선물의 인사말을 찾는다. 선물 준 사람이 공유페이지에서 남긴 한마디(guestbook)를
// 우선 보고, 없으면 부모가 직접 적어둔 인사말(giftedMsg)을 본다.
function giftMessageFor(id){
  const gb=(state.guestbook||[]).filter(g=>g&&g.item_id===id&&(g.message||"").trim());
  if(gb.length){
    const last=gb[gb.length-1];
    return {message:(last.message||"").trim(),from:last.guest_name||state.giftedBy[id]||"가족"};
  }
  const m=(state.giftedMsg||{})[id];
  if(m&&m.trim())return {message:m.trim(),from:state.giftedBy[id]||"가족"};
  return {message:"",from:state.giftedBy[id]||""};
}
// 선반의 받은 선물을 누르면 그 사람이 써준 인사말을 보여준다.
function openGiftMessageSheet(id){
  const item=wishItemById(id);
  const gm=giftMessageFor(id);
  $("#ppl-emoji").textContent=item?.emoji||"🎁";
  $("#ppl-title").textContent=item?item.name:"받은 선물";
  $("#ppl-message").textContent=gm.message||"따뜻한 마음을 담아 선물해 주셨어요 💝";
  $("#ppl-from").textContent=gm.from?`${gm.from}님이 선물해 줬어요`:"선물 받았어요";
  $("#ppl-sheet").classList.remove("hidden");
}
function renderWishlistGrid(){
  const stage=STAGES[state.currentStage];
  const items=state.wishlist[stage.id]||[];
  const grid=$("#wishlist-grid");
  renderGiftShelf();
  if(!items.length){grid.innerHTML='<div class="wish-empty">아직 등록된 위시리스트가 없어요</div>';return;}
  grid.innerHTML=items.map(item=>{
    const pub=!!state.published[item.id];
    const has=hasItem(item.id);
    const giver=state.giftedBy[item.id];
    const pc=PRIORITY_CLASS[item.priority]||"";
    let chip,chipText;
    if(has){chip="have";chipText=giver?`${esc(giver)}님이 줬어요`:"받았어요";}
    else if(pub){chip="need";chipText="공개중";}
    else{chip="";chipText="비공개";}
    return`<div class="wish-card${has?" has-item":""}${pub?" is-published":""}" data-id="${item.id}" data-stage="${stage.id}">
      <div class="wish-card-top">
        <span class="wish-priority ${pc}">${item.priority}</span>
        <span class="wish-pub-mark">${has?"🎁":pub?"❤️":"🤍"}</span>
      </div>
      <div class="wish-card-body">
        <span class="wish-emoji">${item.emoji}</span>
        <span class="wish-name">${esc(item.name)}</span>
      </div>
      <div class="wish-card-foot">
        <span class="wish-target">${TARGET_LABEL[item.target]||item.target}</span>
        <span class="wish-status-chip ${chip}">${chipText}</span>
      </div>
    </div>`;
  }).join("");
  grid.querySelectorAll(".wish-card").forEach(card=>{
    const id=card.dataset.id;
    card.oncontextmenu=e=>e.preventDefault();
    // 탭 한 번이면 통합 시트가 열려 공개·받음·인사말·상품을 한 자리에서 설정한다.
    card.onclick=()=>openWishActionSheet(id);
  });
}
function togglePublish(id){
  if(state.published[id]){delete state.published[id];showToast("공유 위시에서 내렸어요");}
  else{state.published[id]=true;track("publish",{item:id});showToast("공유 위시에 공개했어요 ❤️");}
  save();renderWishlistGrid();
}
function openWishActionSheet(id){
  const item=(state.wishlist[STAGES[state.currentStage].id]||[]).find(i=>i.id===id);
  if(!item)return;
  const has=hasItem(id),pub=!!state.published[id];
  const gm=giftMessageFor(id);
  const rows=[];
  if(has&&gm.message)rows.push(`<button type="button" class="wish-act-btn highlight" data-act="message">💌 ${esc(gm.from||"준 분")}님의 인사말 보기</button>`);
  rows.push(`<button type="button" class="wish-act-btn" data-act="received">🎁 받았어요 · 준 사람·인사말 적기</button>`);
  rows.push(`<button type="button" class="wish-act-btn" data-act="pub">${pub?"🙈 공개 취소":"❤️ 공유 위시에 공개"}</button>`);
  rows.push(`<button type="button" class="wish-act-btn" data-act="products">🛍 상품 고르기</button>`);
  if(has)rows.push(`<button type="button" class="wish-act-btn" data-act="unreceive">↩️ 받음 취소</button>`);
  rows.push(`<button type="button" class="wish-act-btn danger" data-act="delete">🗑 삭제 (공개·기록 지우기)</button>`);
  $("#wish-action-title").textContent=`${item.emoji} ${item.name}`;
  $("#wish-action-body").innerHTML=rows.join("");
  $("#wish-action-body").querySelectorAll("[data-act]").forEach(b=>b.onclick=()=>doWishAction(id,b.dataset.act));
  $("#wish-action-sheet").classList.remove("hidden");
}
function closeWishActionSheet(){$("#wish-action-sheet")?.classList.add("hidden");}
function doWishAction(id,act){
  if(act==="message"){
    closeWishActionSheet();return openGiftMessageSheet(id);
  }else if(act==="received"){
    const who=(prompt("누가 선물해 줬나요? (예: 체리이모)")||"").trim();
    if(who){
      const msg=(prompt(`${who}님이 남긴 인사말이 있나요? (없으면 비워두세요)`)||"").trim();
      const already=!!state.owned[id];
      state.owned[id]=true;state.giftedBy[id]=who;state.published[id]=true;
      if(!state.giftedMsg)state.giftedMsg={};
      if(msg)state.giftedMsg[id]=msg;else delete state.giftedMsg[id];
      if(!already&&typeof addPoints==="function"){
        addPoints(POINT_RULES.giftReceived,"gift_received");
        if(typeof track==="function")track("gift_received",{item_id:id,giver:who});
        showToast(`${who}님 선물로 기록 · +${POINT_RULES.giftReceived}캔디 🎁`);
      }else{showToast(`${who}님 선물로 기록했어요 🎁`);}
    }
  }else if(act==="pub"){
    if(state.published[id])delete state.published[id];else state.published[id]=true;
  }else if(act==="products"){
    closeWishActionSheet();return openProductPicker(STAGES[state.currentStage].id,id);
  }else if(act==="unreceive"){
    delete state.owned[id];delete state.giftedBy[id];if(state.giftedMsg)delete state.giftedMsg[id];showToast("받음 표시를 취소했어요");
  }else if(act==="delete"){
    delete state.published[id];delete state.owned[id];delete state.giftedBy[id];if(state.giftedMsg)delete state.giftedMsg[id];showToast("삭제했어요");
  }
  save();renderWishlistGrid();closeWishActionSheet();
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
/* 위시 카드 직접 추가 (이모티콘 + 상품 이름) */
const WISH_EMOJIS=["🎁","🍼","🧸","👕","🧦","👟","📚","🍶","🛁","🪀","🎀","🧴","🍪","🪥","🧢","🚗"];
let _wishEmoji="🎁";
function openWishAdd(){
  _wishEmoji="🎁";
  const pick=$("#wish-emoji-pick");
  if(pick){
    pick.innerHTML=WISH_EMOJIS.map((e,i)=>`<button type="button" class="wish-emoji${i===0?" on":""}" data-emoji="${e}">${e}</button>`).join("");
    pick.querySelectorAll("[data-emoji]").forEach(b=>b.onclick=()=>{_wishEmoji=b.dataset.emoji;pick.querySelectorAll(".wish-emoji").forEach(x=>x.classList.toggle("on",x===b));});
  }
  const nm=$("#wish-add-name");if(nm)nm.value="";
  $("#wish-add-modal")?.classList.remove("hidden");
  setTimeout(()=>$("#wish-add-name")?.focus(),60);
}
function closeWishAdd(){$("#wish-add-modal")?.classList.add("hidden");}
function submitWishAdd(){
  const name=($("#wish-add-name")?.value||"").trim();
  if(!name){showToast("상품 이름을 입력해 주세요");return;}
  const stage=STAGES[state.currentStage];
  if(!state.wishlist[stage.id])state.wishlist[stage.id]=[];
  const id="w"+Date.now();
  state.wishlist[stage.id].push({id,name,emoji:_wishEmoji,priority:"권장",target:"baby"});
  state.published[id]=true;   // 추가하면 공유 위시에 바로 공개
  save();
  if(typeof pushFamilyDataToServerNow==="function")pushFamilyDataToServerNow().catch(()=>{});
  if(typeof track==="function")track("wish_add",{name});
  closeWishAdd();
  renderWishlistGrid();
  showToast("위시에 추가했어요 🎁");
}
function openWishlist(){
  const t=$(".wishlist-title");if(t)t.textContent=`${babyName()} 옷장`;
  const ca=$("#closet-avatar");if(ca){ca.src=state.profile.avatar;ca.alt=babyName();}
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
function initGameTab(){ /* 상단 배너는 운영자 설정(applyGameBanner)으로 렌더링한다 */ }
// 게임 탭 상단 배너: 운영자 대시보드 설정(배경사진+제목+설명+우측아이콘+링크)으로
// 렌더링한다. 운영자가 끄면 기본 배너가 같은 포맷으로 보인다.
const DEFAULT_GAME_BANNER={
  title:"AI 게임으로 우리 아이 추억 만들기",
  subtitle:"결과를 일기에 담고 카카오톡으로 공유해요 🎮",
  icon:"🎮",image:"",link:"",
};
function _bannerSlideHtml(b,i){
  const bg=b.image
    ? `background-image:linear-gradient(90deg,rgba(0,0,0,.5),rgba(0,0,0,.12)),url('${b.image}');`
    : `background:linear-gradient(135deg,#ff9a76,#ff6b9d 55%,#7a6bff);`;
  const icon=b.icon?`<div class="ig-cbanner-icon">${esc(b.icon)}</div>`:"";
  const tx=`<div class="ig-cbanner-tx"><strong>${esc(b.title||"")}</strong>${b.subtitle?`<span>${esc(b.subtitle)}</span>`:""}</div>`;
  return `<div class="ig-bn-slide${i===0?" on":""}" data-link="${esc(b.link||"")}" style="${bg}">${tx}${icon}</div>`;
}
async function applyGameBanner(){
  const banner=$("#ig-banner");if(!banner)return;
  if(applyGameBanner._t){clearInterval(applyGameBanner._t);applyGameBanner._t=null;}
  let cfg=null;
  try{const r=await fetch("/api/banner?_t="+Date.now());cfg=await r.json();}catch(_){}
  // 기본 배너는 항상 첫 장. 운영자가 추가한 배너를 그 뒤에 더해 함께 회전.
  const extra=(cfg&&Array.isArray(cfg.items))?cfg.items:[];
  const items=[DEFAULT_GAME_BANNER,...extra];
  const dots=items.length>1?`<div class="ig-banner-dots">${items.map((_,i)=>`<span class="${i===0?"on":""}"></span>`).join("")}</div>`:"";
  banner.innerHTML=items.map(_bannerSlideHtml).join("")+dots;
  // 각 슬라이드 링크 클릭
  $$(".ig-bn-slide",banner).forEach(s=>{
    const lk=s.getAttribute("data-link");
    s.style.cursor=lk?"pointer":"default";
    s.onclick=lk?()=>window.open(lk,"_blank","noopener"):null;
  });
  // 여러 장이면 자동 회전(크로스페이드)
  if(items.length>1){
    let idx=0;
    applyGameBanner._t=setInterval(()=>{
      if(!$("#game-tab-view")?.classList.contains("active"))return;
      const slides=$$(".ig-bn-slide",banner),ds=$$(".ig-banner-dots span",banner);
      if(!slides.length)return;
      idx=(idx+1)%slides.length;
      slides.forEach((s,i)=>s.classList.toggle("on",i===idx));
      ds.forEach((d,i)=>d.classList.toggle("on",i===idx));
    },4000);
  }
}
function openIgView(){switchMainTab("game");}
/* ─── AI 그라운드 앱 연결 ───────────────────────────────────────────
 * 각 앱의 주소(배포 URL 또는 같은 서버의 경로)를 채우면 타일이 그 앱으로 이동한다.
 * 예) naming:"https://naming.myapp.com"  또는  "/apps/naming/"
 * (D:\AI_GROUND_WITH_BEBEBOX 의 앱들은 배포하거나 이 저장소에 넣어 URL로 연결)
 */
const AI_APPS={
  naming:"/apps/naming/",        // 글로벌 작명소
  doodle:"/apps/doodle/",        // 낙서 심리 분석
  health:"/apps/health/",        // 아이 건강 체크
  vlog:"/apps/vlog/",            // 브이로그 제작소
  chores:"/apps/chores/",        // 집안일 당번
  temperament:"/apps/temperament/", // 성향·기질 분석
  studio:"/apps/studio/",        // AI 컨셉스튜디오
  pastlife:"/apps/pastlife/",    // 전생 인연(추천)
};
let _activeMiniApp=null;   // 현재 열려있는 미니앱 {slug,label} — 트리거 이벤트 적치용
function openAiApp(slug,label){
  let url=AI_APPS[slug];
  if(typeof track==="function")track("ai_app",{app:slug});
  if(!url){showToast(`${label||"앱"} 준비 중이에요`);return;}
  _activeMiniApp={slug,label:label||slug};
  // 가족코드를 uid 로 넘겨 AI 앱 기록이 고객(USERID)별로 적치되게 한다.
  try{
    const code=(typeof ensureInviteCode==="function"&&ensureInviteCode(true))
             ||(typeof getInviteCode==="function"&&getInviteCode())||"";
    if(code)url+=(url.indexOf("?")<0?"?":"&")+"uid="+encodeURIComponent(String(code).toUpperCase());
  }catch(_){}
  url+=(url.indexOf("?")<0?"?":"&")+"_v=7";   // 앱 정적파일 캐시 무력화
  $("#app-frame-title").textContent=label||"";
  $("#app-frame").src=url;            // 앱 안에서 iframe 으로 띄움
  showOverlay("#app-frame-view");
}
function closeAppFrame(){
  const f=$("#app-frame");if(f)f.src="about:blank";
  _activeMiniApp=null;
  switchMainTab("game");
}

/* ─── 미니앱 트리거 → 고객 프로필(포인트/달성) 변경 ──────────────────
 * 미니앱 iframe(KD._emit)이 보내는 생성요청·생성완료·결과공유 이벤트를 받아
 * 고객 프로필(state.points: 캔디 경제)을 적립/차감하고, 변경분을 고객 DB에
 * 동기화한다. 미니앱 산출물 DB(per-app)와 동일한 가족코드(uid)로 묶여
 * 운영자 대시보드의 고객여정에서 함께 조회된다.
 */
/* 앱별 결과 보기 비용(캔디). 작명·당번 등 저토큰/무-LLM 앱은 0(무료),
 * 이미지·영상 등 토큰이 많이 드는 앱은 높게. 한 곳에서 조정한다. */
const MINIAPP_COST={
  naming:0,        // 글로벌 작명소 (저토큰) — 무료
  chores:0,        // 집안일 당번 (무-LLM) — 무료
  temperament:0,   // 성향·기질 (저토큰 텍스트) — 무료
  health:10,       // 아이 건강 체크 (텍스트)
  pastlife:10,     // 전생 인연 (텍스트)
  doodle:20,       // 낙서 심리 (이미지 입력)
  vlog:20,         // 브이로그 (영상 합성)
  studio:30,       // AI 컨셉스튜디오 (이미지 생성, 최고토큰)
};
const MINIAPP_RULES={
  shareReward:POINT_RULES.share||30,      // 결과 공유 시 적립(캔디)
};
function miniAppCost(slug){
  slug=slug||(_activeMiniApp&&_activeMiniApp.slug);
  const c=MINIAPP_COST[slug];
  return (typeof c==="number")?c:0;
}
/* 결과 보기 전 결제 게이트: 미니앱(iframe)이 요청 → 비용만큼 모달로 확인/차감
 * → 허용 여부를 iframe 에 회신. 무료 앱은 모달 없이 즉시 통과. */
function handleMiniAppGate(data){
  const slug=_activeMiniApp&&_activeMiniApp.slug;
  const cost=miniAppCost(slug);
  const reply=(allow)=>{
    const f=$("#app-frame");
    try{f&&f.contentWindow&&f.contentWindow.postMessage(
      {type:"kidikidi-gate-reply",requestId:data.requestId,allow:!!allow},"*");}catch(_){}
  };
  if(!cost){_lastCharge=0;reply(true);return;}           // 무료 앱 → 통과
  // 첫 유료 AI 결과는 무료 체험(1회). 실제 생성 성공 시에만 소진한다.
  if(!localStorage.getItem("bbx_ai_free_used")){
    _lastCharge=0;_pendingFree=true;
    if(typeof showToast==="function")showToast("첫 AI 결과는 무료예요 🎁");
    reply(true);return;
  }
  openRevealGate(cost,(confirmed)=>{
    if(confirmed&&typeof spendPoints==="function"&&spendPoints(cost,"miniapp_reveal")){
      _lastCharge=cost;                                  // 실패 시 환불 대비
      if(typeof track==="function")track("miniapp_spend",{app:slug,amount:cost});
      _syncProfileChange();
      reply(true);
    }else{
      _lastCharge=0;
      reply(false);
    }
  });
}
let _lastCharge=0;   // 직전 결제(차감) 금액 — 생성 실패 시 환불용
let _pendingFree=false;   // 첫 무료 체험 진행 중 — 생성 성공 시에만 소진
function handleMiniAppEvent(data){
  const app=_activeMiniApp||{slug:(data&&data.app)||"miniapp",label:"AI 앱"};
  const ev=data&&data.event;
  if(ev==="request"){
    if(typeof track==="function")track("miniapp_request",{app:app.slug});
    return;
  }
  if(ev==="failed"){
    _pendingFree=false;   // 실패하면 무료 체험은 그대로 남겨둔다
    // 생성 실패 → 게이트에서 차감한 포인트 환불
    if(_lastCharge>0){
      if(typeof addPoints==="function")addPoints(_lastCharge,"miniapp_refund");
      if(typeof track==="function")track("miniapp_refund",{app:app.slug,amount:_lastCharge});
      if(typeof showToast==="function")showToast(`생성에 실패해 ${_lastCharge}캔디를 돌려드렸어요`);
      _lastCharge=0;_syncProfileChange();
    }
    return;
  }
  if(ev==="generated"){
    if(data&&data.from_cache){_lastCharge=0;return;}
    if(_pendingFree){localStorage.setItem("bbx_ai_free_used","1");_pendingFree=false;}  // 첫 무료 체험 소진
    _lastCharge=0;   // 결제 확정
    // 결제는 게이트에서 끝났고, 여기선 달성조건(오늘의 미션) 1조각 반영 + 동기화
    // (생성 자체는 서버 ai_backend 가 miniapp_generate 로 고객 DB에 적치)
    if(typeof addPuzzlePieces==="function")addPuzzlePieces(1,"miniapp");
    if(typeof showToast==="function")showToast("AI 결과가 완성됐어요 ✨");
    _syncProfileChange();
    return;
  }
  if(ev==="shared"){
    if(typeof addPoints==="function")addPoints(MINIAPP_RULES.shareReward,"miniapp_share");
    if(typeof track==="function")track("miniapp_share",{app:app.slug});
    if(typeof showToast==="function")showToast(`결과 공유 · +${MINIAPP_RULES.shareReward}캔디 🍬`);
    _syncProfileChange();
    return;
  }
  if(ev==="save_diary"){
    // 게임 결과(1:1 카드 이미지)를 일기 기록(피드)에 자동 저장
    saveMiniAppResultToDiary(data,app);
    return;
  }
}
// 게임 결과 이미지를 업로드해 일기 게시물로 저장한다.
async function saveMiniAppResultToDiary(data,app){
  try{
    const img=data&&data.image;
    if(!img||typeof uploadPhotoToServer!=="function")return;
    const label=(app&&app.label)||"AI 게임";
    const caption=(data&&data.caption)||`${label} 결과 🎮`;
    const blob=await(await fetch(img)).blob();
    const file=new File([blob],"game-result.png",{type:blob.type||"image/png"});
    const up=await uploadPhotoToServer(file);
    if(!up||!up.src)return;
    const post=ensurePostMeta({id:"post"+Date.now(),text:caption,photos:[up.src],
      ageMonth:state.profile.currentAge||9,createdAt:Date.now(),gauge:0,comments:[],
      visibility:"all",fromGame:(app&&app.slug)||"game"});
    state.posts.unshift(post);
    save();
    if(typeof pushFamilyDataToServerNow==="function")pushFamilyDataToServerNow().catch(()=>{});
    if(typeof track==="function")track("record",{photos:1,fromGame:(app&&app.slug)||"game"});
    if(typeof showToast==="function")showToast("게임 결과를 일기에 저장했어요 📔");
    _syncProfileChange();
    // 업로드된 게임 이미지(공개 URL)로 카카오톡 공유 띄우기 (게임별 화면 그대로)
    shareGameResultToKakao(up.src,data,label);
  }catch(_){}
}
// 게임별 결과 이미지를 카카오톡 카드(피드)로 공유. 이미지는 각자 사진/결과 그대로,
// 링크는 사용자 공유 페이지로 연결해 친구가 보고 선물할 수 있게 한다.
function shareGameResultToKakao(src,data,label){
  try{
    if(!(window.Kakao&&Kakao.isInitialized&&Kakao.isInitialized()))return;
    const imageUrl=(/^https?:/.test(src)?src:location.origin+src);
    const url=(typeof getShareUrl==="function")?getShareUrl():location.origin;
    const title=(data&&data.kakaoTitle)||`${label} 결과 🎮`;
    const description=(data&&data.kakaoDesc)||`${babyName()}의 ${label} 결과를 확인해보세요!`;
    Kakao.Share.sendDefault({
      objectType:"feed",
      content:{title,description,imageUrl,link:{mobileWebUrl:url,webUrl:url}},
      buttons:[{title:"나도 해보기 🎁",link:{mobileWebUrl:url,webUrl:url}}],
    });
  }catch(_){}
}
// 결제 게이트 모달 (결과 보기 전 중간 단계)
let _gateCb=null;
function openRevealGate(cost,cb){
  _gateCb=cb;
  const bal=typeof getPoints==="function"?getPoints():0;
  const enough=bal>=cost;
  $("#miniapp-gate-cost").textContent=cost;
  $("#miniapp-gate-balance").textContent=bal.toLocaleString("ko-KR");
  const confirm=$("#btn-miniapp-gate-confirm");
  confirm.disabled=!enough;
  confirm.textContent=enough?`🍬 ${cost}캔디 쓰고 결과 보기`:"캔디가 부족해요";
  $("#miniapp-gate-short").classList.toggle("hidden",enough);
  $("#miniapp-gate-modal").classList.remove("hidden");
}
function closeRevealGate(confirmed){
  $("#miniapp-gate-modal").classList.add("hidden");
  const cb=_gateCb;_gateCb=null;
  if(cb)cb(!!confirmed);
}
function _syncProfileChange(){
  try{if(typeof save==="function")save();}catch(_){}
  try{if(typeof pushFamilyDataToServerNow==="function")pushFamilyDataToServerNow();}catch(_){}
  try{if(typeof renderPointsUI==="function")renderPointsUI();}catch(_){}
}
window.addEventListener("message",function(e){
  const d=e&&e.data;
  if(!d)return;
  if(d.type==="kidikidi-gate")handleMiniAppGate(d);
  else if(d.type==="kidikidi-miniapp")handleMiniAppEvent(d);
});

/* ─── AI 컨셉스튜디오: 컨셉별 샘플 미리보기 ─────────────────────── */
const STUDIO_CONCEPTS={
  flower:{label:"봄꽃 컨셉",title:"봄꽃 스튜디오 컨셉 아기 사진 만들기",desc:"화사한 봄꽃 가득한 스튜디오에서 우리 아이만의 화보를 만들어보세요",img:"public/photos/ai-02.jpg"},
  hanbok:{label:"한복 컨셉",title:"한복 새해 컨셉 아기 사진 만들기",desc:"설빔 모자와 한복, 한옥 배경의 새해 베이비 화보를 만들어보세요",img:"public/photos/ai-04.jpg"},
  beach:{label:"바닷가 컨셉",title:"바닷가 컨셉 아기 사진 만들기",desc:"시원한 여름 바닷가를 배경으로 사랑스러운 베이비 화보를 만들어보세요",img:"public/photos/ai-03.jpg"},
};
let _currentConcept=null;
function openConcept(id){
  const c=STUDIO_CONCEPTS[id];if(!c)return;
  _currentConcept=id;
  if(typeof track==="function")track("ai_concept",{concept:id});
  $("#concept-title").textContent=c.title;
  $("#concept-desc").textContent=c.desc;
  $("#concept-sample-img").src=c.img;
  const chk=$("#concept-consent"),cta=$("#btn-concept-make");
  chk.checked=false;cta.disabled=true;cta.classList.remove("on");
  $(".concept-scroll").scrollTop=0;
  showOverlay("#concept-view");
}
function closeConcept(){switchMainTab("game");}

/* ─── 게임 탭: 전체보기 리스트 + 더보기 앵커 ────────────────────── */
const ALL_CONTENT=[
  {app:"naming",label:"글로벌 작명소",desc:"아이에게 어울리는 예쁜 글로벌 이름을 추천해요",icon:"🌐",bg:"#fff3e0"},
  {app:"doodle",label:"낙서 심리 분석",desc:"아이 그림으로 마음상태와 감정을 알아봐요",icon:"✏️",bg:"#f3e8ff"},
  {app:"health",label:"아이 건강 체크",desc:"증상을 입력하면 AI가 건강 상태를 살펴봐요",icon:"➕",bg:"#ffe8e8"},
  {app:"vlog",label:"브이로그 제작소",desc:"먹·놀·잠 영상을 하나의 브이로그로 만들어요",icon:"🎬",bg:"#e8f8ef"},
  {app:"chores",label:"집안일 당번",desc:"재미있는 게임으로 오늘의 집안일 당번을 정해요",icon:"📋",bg:"#e8f0ff"},
  {app:"temperament",label:"성향·기질 분석",desc:"우리 아이의 타고난 기질을 검사해요",icon:"🎭",bg:"#e8eeff"},
  {app:"studio",label:"AI 컨셉스튜디오",desc:"특별한 장소 없이도 예쁜 컨셉 사진을 완성해요",icon:"📸",bg:"#fde8f0"},
  {app:"pastlife",label:"아이와 나의 전생",desc:"AI가 풀어주는 우리 아이 인연 이야기",icon:"🔮",bg:"#efeaff"},
];
function renderAllContent(){
  const wrap=$("#ig-all-list");if(!wrap)return;
  wrap.innerHTML=ALL_CONTENT.map(c=>
    `<button class="ig-list-item" type="button" data-app="${c.app}" data-ig="${c.label}">`
    +`<span class="ig-list-ico" style="background:${c.bg}">${c.icon}</span>`
    +`<span class="ig-list-body"><span class="ig-list-title">${c.label}</span><span class="ig-list-desc">${c.desc}</span></span>`
    +`<span class="ig-chevron">›</span></button>`
  ).join("");
  wrap.querySelectorAll(".ig-list-item").forEach(btn=>
    btn.onclick=()=>openAiApp(btn.dataset.app,btn.dataset.ig));
}
function getShareUrl(){
  // 지인용 공유 페이지(/share/:가족코드) 로 연결한다.
  let code=(typeof ensureInviteCode==="function"&&ensureInviteCode(true))||(typeof getInviteCode==="function"&&getInviteCode())||"BEBEBOX";
  return `${location.origin}/share/${encodeURIComponent(String(code).toUpperCase())}`;
}
// 6컷 사진을 1200x1200 한 장으로 합성(카카오/링크 미리보기용)
function _loadImg(src){return new Promise(res=>{const im=new Image();im.crossOrigin="anonymous";im.onload=()=>res(im);im.onerror=()=>res(null);im.src=src;});}
function _drawCover(ctx,im,x,y,w,h){
  const r=Math.max(w/im.width,h/im.height),iw=im.width*r,ih=im.height*r;
  ctx.drawImage(im,x+(w-iw)/2,y+(h-ih)/2,iw,ih);
}
async function generateShareGrid(srcs){
  const list=srcs.slice(0,6);
  if(!list.length)return null;
  const SZ=1200,canvas=document.createElement("canvas");
  canvas.width=SZ;canvas.height=SZ;
  const ctx=canvas.getContext("2d");
  ctx.fillStyle="#fff";ctx.fillRect(0,0,SZ,SZ);
  const cw=SZ/2,ch=SZ/3;
  const imgs=await Promise.all(list.map(_loadImg));
  imgs.forEach((im,i)=>{if(!im)return;const cx=(i%2)*cw,cy=Math.floor(i/2)*ch;_drawCover(ctx,im,cx+4,cy+4,cw-8,ch-8);});
  return new Promise(res=>{try{canvas.toBlob(b=>res(b),"image/jpeg",0.9);}catch(_){res(null);}});
}
async function buildAndSaveShareImage(){
  try{
    const srcs=[...state.posts].sort((a,b)=>b.createdAt-a.createdAt).flatMap(p=>p.photos||[]).filter(Boolean);
    if(!srcs.length||typeof uploadPhotoToServer!=="function")return null;
    const blob=await generateShareGrid(srcs);
    if(!blob)return null;
    const file=new File([blob],"share-grid.jpg",{type:"image/jpeg"});
    const up=await uploadPhotoToServer(file);
    if(up&&up.src){state.profile.shareImage=up.src;save();return up.src;}
  }catch(_){}
  return null;
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
// 공유 전, 카카오톡에 어떻게 보이는지 카드 미리보기를 띄운다.
async function openSharePreview(){
  const m=$("#share-preview-modal");if(!m)return;
  $("#sp-title").textContent=`${babyName()}의 일기`;
  $("#sp-desc").textContent=`${babyName()}에게 선물하고 키디키디 쿠폰도 받아가세요 🎁`;
  const thumb=$("#sp-thumb");
  if(thumb){thumb.style.backgroundImage="";thumb.textContent="🍼";}
  m.classList.remove("hidden");
  try{
    const img=state.profile.shareImage||await buildAndSaveShareImage();
    if(img&&thumb){thumb.style.backgroundImage=`url("${img}")`;thumb.textContent="";}
  }catch(_){}
}
window.openSharePreview=openSharePreview;
async function shareProfileLink(){
  const url=getShareUrl();
  track("share");
  const title=`${babyName()}의 일기`;
  const text=`${babyName()}에게 선물하고 키디키디 쿠폰도 받아가세요 🎁`;
  showToast("공유 이미지를 만드는 중...");
  const grid=await buildAndSaveShareImage();
  // 카카오 SDK 가 준비돼 있으면 피드 템플릿(합성 이미지)으로 공유
  if(window.Kakao&&Kakao.isInitialized&&Kakao.isInitialized()){
    try{
      Kakao.Share.sendDefault({
        objectType:"feed",
        content:{title,description:text,
          imageUrl:(grid?location.origin+grid:location.origin+"/public/photos/ai-01.jpg"),
          link:{mobileWebUrl:url,webUrl:url}},
        buttons:[{title:"선물하러 가기",link:{mobileWebUrl:url,webUrl:url}}],
      });
      addPoints(POINT_RULES.share,"share");
      showToast(`카카오톡으로 공유하고 +${POINT_RULES.share}캔디 🍬`);
      return;
    }catch(_){}
  }
  if(navigator.share){
    try{
      await navigator.share({title,text,url});
      addPoints(POINT_RULES.share,"share");
      showToast(`공유하고 +${POINT_RULES.share}캔디 🍬`);
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
    showToast(`공유 링크 복사 · +${POINT_RULES.share}캔디 🍬`);
    addPuzzlePieces(3,"share");
    $("#share-modal").classList.add("hidden");
  });
}
function bindEvents(){
  $$(".tab-bar-item").forEach(btn=>btn.onclick=()=>{
    if(btn.dataset.tab==="gift"){openWishlist();return;}
    switchMainTab(btn.dataset.tab);
  });
  $("#btn-claim-coupon")?.addEventListener("click",()=>{
    const coupon=exchangeCoupon();
    if(!coupon){showToast(`캔디가 부족해요 🍬 (${POINT_RULES.couponCost}캔디 필요)`);return;}
    track("coupon",{amount:coupon.amount||0});
    renderPuzzleTab();
    renderSettingsTab();
    showToast(`${(coupon.amount||0).toLocaleString("ko-KR")}원 상품권으로 교환했어요! 🎟️`);
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
  $("#btn-settings-exchange")?.addEventListener("click",()=>{
    const coupon=exchangeCoupon();
    if(!coupon){showToast(`캔디가 부족해요 🍬 (${POINT_RULES.couponCost}캔디 필요)`);return;}
    track("coupon",{amount:coupon.amount||0});
    renderSettingsTab();
    showToast(`${(coupon.amount||0).toLocaleString("ko-KR")}원 상품권으로 교환했어요! 🎟️`);
  });
  $("#btn-settings-share")?.addEventListener("click",()=>shareProfileLink());
  $("#btn-settings-preview")?.addEventListener("click",()=>{window.open(getShareUrl(),"_blank");});
  $("#btn-settings-wishlist")?.addEventListener("click",openWishlist);
  $("#wish-action-backdrop")?.addEventListener("click",closeWishActionSheet);
  $("#wish-action-cancel")?.addEventListener("click",closeWishActionSheet);
  $("#btn-kakao-logout")?.addEventListener("click",appLogout);
  $("#btn-app-logout")?.addEventListener("click",appLogout);
  $("#btn-app-delete")?.addEventListener("click",appDeleteAccount);
  $("#btn-copy-invite-code")?.addEventListener("click",copyInviteCode);
  if(typeof bindMinigameEvents==="function")bindMinigameEvents();
  $("#btn-share")?.classList.remove("active");
  $("#btn-gift").onclick=openWishlist;
  $("#gift-progress")?.addEventListener("click",openWishlist);
  $("#btn-back-guide")?.addEventListener("click",()=>switchMainTab("home"));
  // 성장 저니 상단: 선물하기 바로가기
  $("#btn-journey-gift-shortcut")?.addEventListener("click",openWishlist);
  $("#btn-add-feed-photo").onclick=openComposer;
  // 글쓰기(인스타식) 모달
  $("#btn-composer-cancel")?.addEventListener("click",closeComposer);
  $("#composer-backdrop")?.addEventListener("click",closeComposer);
  $("#btn-composer-submit")?.addEventListener("click",submitPost);
  $("#composer-photo-input")?.addEventListener("change",e=>{addComposerFiles(e.target.files);e.target.value="";});
  $("#composer-vis")?.addEventListener("click",e=>{const b=e.target.closest("[data-vis]");if(b)setComposerVisibility(b.dataset.vis);});
  $("#post-menu-backdrop")?.addEventListener("click",closePostMenu);
  $("#post-menu-cancel")?.addEventListener("click",closePostMenu);
  // 프로필 사진 변경
  $("#btn-change-avatar")?.addEventListener("click",()=>$("#avatar-input")?.click());
  $("#avatar-input")?.addEventListener("change",e=>{changeAvatar(e.target.files[0]);e.target.value="";});
  // 메인 배경 사진 변경
  $("#btn-change-bg")?.addEventListener("click",()=>$("#bg-input")?.click());
  $("#bg-input")?.addEventListener("change",e=>{changeBackground(e.target.files[0]);e.target.value="";});
  // 메인 담벼락(배경)을 직접 눌러도 배경 변경
  $("#bg-image")?.addEventListener("click",()=>{
    if(typeof isGuest==="function"&&isGuest()){showToast("초대받은 분은 배경을 바꿀 수 없어요");return;}
    $("#bg-input")?.click();
  });
  // 프로필 사진을 직접 눌러도 프로필 변경(상세 통계 열림 방지)
  $(".avatar-wrap")?.addEventListener("click",e=>{
    e.stopPropagation();
    if(typeof isGuest==="function"&&isGuest()){showToast("초대받은 분은 프로필을 바꿀 수 없어요");return;}
    $("#avatar-input")?.click();
  });
  // 옷장 상품 사진 추가
  $("#btn-add-product-image")?.addEventListener("click",()=>$("#add-product-image-input")?.click());
  $("#add-product-image-input")?.addEventListener("change",e=>{pickAddProductImage(e.target.files[0]);e.target.value="";});
  // 프로필 → 게이미피케이션
  $(".profile-row")?.addEventListener("click",openProfileStats);
  $("#btn-pstats-close")?.addEventListener("click",closeProfileStats);
  $("#pstats-backdrop")?.addEventListener("click",closeProfileStats);
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
  $("#btn-add-wish")?.addEventListener("click",openWishAdd);
  $("#btn-wish-add-submit")?.addEventListener("click",submitWishAdd);
  $("#btn-wish-add-cancel")?.addEventListener("click",closeWishAdd);
  $("#wish-add-backdrop")?.addEventListener("click",closeWishAdd);
  $$(".ig-grid-item").forEach(btn=>btn.onclick=()=>openAiApp(btn.dataset.app,btn.dataset.ig));
  $("#btn-ig-studio")?.addEventListener("click",()=>openAiApp("studio","AI 컨셉스튜디오"));
  $("#btn-ig-recommend")?.addEventListener("click",()=>openAiApp("pastlife","전생 인연"));
  $$(".ig-concept-card").forEach(btn=>btn.onclick=()=>openConcept(btn.dataset.concept));
  $("#btn-concept-back")?.addEventListener("click",closeConcept);
  $("#concept-consent")?.addEventListener("change",e=>{
    const cta=$("#btn-concept-make");cta.disabled=!e.target.checked;cta.classList.toggle("on",e.target.checked);
  });
  $("#btn-concept-make")?.addEventListener("click",()=>{
    if($("#btn-concept-make").disabled)return;
    const c=STUDIO_CONCEPTS[_currentConcept];
    openAiApp("studio",(c&&c.label)||"AI 컨셉스튜디오");
  });
  $("#concept-terms")?.addEventListener("click",e=>{e.preventDefault();showToast("약관 전문은 준비 중이에요");});
  $("#btn-concept-share")?.addEventListener("click",()=>copyShareLink());
  $("#btn-ig-more-all")?.addEventListener("click",()=>{
    $("#ig-all-section")?.scrollIntoView({behavior:"smooth",block:"start"});
  });
  renderAllContent();
  $("#btn-app-frame-back")?.addEventListener("click",closeAppFrame);
  $("#btn-miniapp-gate-confirm")?.addEventListener("click",()=>closeRevealGate(true));
  $("#btn-miniapp-gate-cancel")?.addEventListener("click",()=>closeRevealGate(false));
  $("#miniapp-gate-backdrop")?.addEventListener("click",()=>closeRevealGate(false));
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
  $("#btn-share").onclick=openSharePreview;
  $("#btn-cancel-share").onclick=()=>$("#share-modal").classList.add("hidden");
  $("#share-modal-backdrop").onclick=()=>$("#share-modal").classList.add("hidden");
  $("#btn-copy-link").onclick=()=>copyShareLinkWithReward();
  // 공유 미리보기 / 시작 축하 / 사용법 도움말
  $("#sp-kakao")?.addEventListener("click",()=>{$("#share-preview-modal").classList.add("hidden");shareProfileLink();});
  $("#sp-copy")?.addEventListener("click",()=>{$("#share-preview-modal").classList.add("hidden");copyShareLinkWithReward();});
  $("#sp-close")?.addEventListener("click",()=>$("#share-preview-modal").classList.add("hidden"));
  $("#sp-backdrop")?.addEventListener("click",()=>$("#share-preview-modal").classList.add("hidden"));
  $("#wc-ok")?.addEventListener("click",()=>$("#welcome-modal").classList.add("hidden"));
  $("#btn-my-help")?.addEventListener("click",()=>$("#help-modal").classList.remove("hidden"));
  $("#help-close")?.addEventListener("click",()=>$("#help-modal").classList.add("hidden"));
  $("#help-backdrop")?.addEventListener("click",()=>$("#help-modal").classList.add("hidden"));
  $("#btn-close-viewer").onclick=closePhotoDetail;
  document.addEventListener("keydown",e=>{
    if(e.key==="Escape"&&!$("#photo-detail").classList.contains("hidden"))closePhotoDetail();
  });
  $("#btn-like").onclick=toggleLike;
  $("#btn-open-comments").onclick=openCommentSheet;
  $("#comment-backdrop").onclick=closeCommentSheet;
  $("#btn-cancel-reply")?.addEventListener("click",cancelReply);
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
  maybeWelcomeBonus();
  renderProfile();
  renderFeed();
  renderAgeQuestBadge();
  renderPointsUI();
  switchMainTab("home");
}
// 첫 시작 시: 시작 캔디 100개 충전 + 환영 카드 첫 기록 + 축하 팝업(1회).
function maybeWelcomeBonus(){
  if(localStorage.getItem("bb_welcome_v1"))return;
  localStorage.setItem("bb_welcome_v1","1");
  const amt=100;
  if(typeof addPoints==="function")addPoints(amt,"welcome");
  const a=$("#wc-amount");if(a)a.textContent=amt;
  seedWelcomePost();
  if(typeof renderPointsUI==="function")renderPointsUI();
  setTimeout(()=>$("#welcome-modal")?.classList.remove("hidden"),450);
}
// 가입 정보(이름·개월, 있으면 성별/생일)로 '우리 아기 환영 카드'를 만든다.
function makeWelcomeCardSVG(){
  const name=babyName();
  const age=ageLabel(state.profile.currentAge??9);
  const g=state.profile.gender, birth=state.profile.birthday;
  const d=new Date();
  const today=`${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`;
  const babyEmoji=g==="girl"?"👧":g==="boy"?"👦":"👶";
  const favs=(state.profile.favs&&state.profile.favs.length)?state.profile.favs:["✨","💕","🌙","⭐","🎈"];
  const spots=[[150,230,72],[870,300,66],[170,1190,64],[860,1130,72],[300,1150,56],[770,255,56]];
  const deco=spots.map((s,i)=>`<text x='${s[0]}' y='${s[1]}' font-size='${s[2]}'>${esc(favs[i%favs.length])}</text>`).join("");
  const extra=[];
  if(birth)extra.push(`🎂 ${birth}`);
  if(g)extra.push(g==="girl"?"🎀 공주님":"⭐ 왕자님");
  const extraLine=extra.length?`<text x='540' y='1015' font-size='42' text-anchor='middle' fill='#9a6b07' font-family='sans-serif' font-weight='700'>${esc(extra.join("   ·   "))}</text>`:"";
  const dateY=extra.length?1100:1040;
  const svg=`<svg xmlns='http://www.w3.org/2000/svg' width='1080' height='1350' viewBox='0 0 1080 1350'>`+
    `<defs><linearGradient id='bg' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#fff2e8'/><stop offset='.55' stop-color='#ffe7ef'/><stop offset='1' stop-color='#f0ecff'/></linearGradient></defs>`+
    `<rect width='1080' height='1350' fill='url(#bg)'/>`+
    deco+
    `<text x='540' y='195' font-size='58' text-anchor='middle'>🎉</text>`+
    `<circle cx='540' cy='470' r='205' fill='#ffffff' opacity='.92'/>`+
    `<text x='540' y='548' font-size='225' text-anchor='middle'>${babyEmoji}</text>`+
    `<text x='540' y='800' font-size='48' text-anchor='middle' fill='#c2511e' font-family='sans-serif' font-weight='700'>우리 아기 환영해요</text>`+
    `<text x='540' y='910' font-size='112' text-anchor='middle' fill='#2b2622' font-family='sans-serif' font-weight='800'>${esc(name)}</text>`+
    extraLine+
    `<text x='540' y='${dateY}' font-size='42' text-anchor='middle' fill='#7a7167' font-family='sans-serif'>${esc(age)} · 함께한 첫 날 ${today}</text>`+
    `<text x='540' y='1295' font-size='36' text-anchor='middle' fill='#c4a99a' font-family='sans-serif' font-weight='700'>🍼 BEBEBOX</text>`+
  `</svg>`;
  return "data:image/svg+xml,"+encodeURIComponent(svg);
}
function seedWelcomePost(){
  if(localStorage.getItem("bb_welcome_post_v1"))return;
  localStorage.setItem("bb_welcome_post_v1","1");
  const name=babyName();
  const text=`🎉 우리 ${name}, 베베박스에 온 걸 환영해!\n오늘부터 ${name}의 반짝이는 순간들을 여기 차곡차곡 담아둘게. 건강하고 행복하게, 사랑 가득 자라자 💕`;
  const photos=[makeWelcomeCardSVG()];
  const av=state.profile.avatar;
  if(av&&(/^data:/.test(av)||/\/uploads\//.test(av)))photos.push(av);
  const post=ensurePostMeta({id:"welcome"+Date.now(),text,photos,ageMonth:state.profile.currentAge??9,createdAt:Date.now(),gauge:0,comments:[],visibility:"all"});
  state.posts.unshift(post);
  if(typeof save==="function")save();
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
  const needsOnboarding=typeof initOnboarding==="function"&&initOnboarding();
  if(needsOnboarding)hideTabBar();
  else enterMainApp();
}
bootApp();
