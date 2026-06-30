const OB_KEY="photoShare_onboarded";
const OB_AUTH_KEY="photoShare_auth";
const DEMO_INVITE_CODE="BEBEBOX";

const ROLE_LABELS={
  mom:"엄마",
  dad:"아빠",
  grandma:"할머니",
  grandpa:"할아버지",
  aunt_m:"이모",
  aunt_p:"고모",
  uncle_m:"외삼촌",
  uncle_p:"삼촌",
  other:null
};
const PARENT_ROLES=new Set(["mom","dad"]);

const onboarding={
  provider:null,
  userType:null,
  path:null,
  role:"mom",
  roleGroup:"parent",
  roleCustom:"",
  babyName:"",
  photo:"",
  favs:[],
  kidikidiId:"",
  kidikidiBackView:"#onboarding-favs-view",
  codeContext:null
};
// 좋아하는 것 이모지 후보
const FAV_EMOJIS=["🧸","🍼","🐻","🐰","🦊","🐥","🐶","🐱","🦕","🌙","⭐","🌈","🎈","🍓","🍌","🚗","⚽","🎵","📚","🍪"];

function isOnboarded(){
  return localStorage.getItem(OB_KEY)==="1";
}
function isGuestEntry(){
  return new URLSearchParams(location.search).has("guest");
}
function isOnboardingPreview(){
  return new URLSearchParams(location.search).has("onboarding");
}
function obShow(id){
  document.querySelectorAll(".ob-view").forEach(v=>v.classList.remove("active"));
  const el=document.querySelector(id);
  if(el)el.classList.add("active");
}
function obLogin(provider){
  onboarding.provider=provider;
  obShow("#onboarding-welcome-view");
}
function updateRoleUi(){
  const isParent=onboarding.roleGroup==="parent";
  document.querySelectorAll(".ob-role").forEach(r=>{
    const key=r.dataset.role;
    r.classList.toggle("ob-role--active",isParent?key===onboarding.role:key==="family");
  });
  document.getElementById("ob-family-picker")?.classList.toggle("hidden",isParent);
  const relationEl=document.getElementById("ob-family-relation");
  if(relationEl&&!isParent)relationEl.value=onboarding.role;
  const customEl=document.getElementById("ob-family-custom");
  if(customEl){
    customEl.classList.toggle("hidden",onboarding.role!=="other");
    if(onboarding.role==="other")customEl.value=onboarding.roleCustom||"";
  }
}
function obSelectParentRole(role){
  onboarding.roleGroup="parent";
  onboarding.role=role;
  onboarding.roleCustom="";
  updateRoleUi();
}
function obSelectFamilyRole(){
  onboarding.roleGroup="family";
  const relationEl=document.getElementById("ob-family-relation");
  onboarding.role=relationEl?.value||"grandma";
  syncFamilyCustomUi();
  updateRoleUi();
}
function syncFamilyCustomUi(){
  const customEl=document.getElementById("ob-family-custom");
  if(!customEl)return;
  const isOther=onboarding.role==="other";
  customEl.classList.toggle("hidden",!isOther);
  if(isOther)onboarding.roleCustom=customEl.value.trim();
}
function syncFamilyRoleFromUi(){
  if(onboarding.roleGroup!=="family")return true;
  const relationEl=document.getElementById("ob-family-relation");
  onboarding.role=relationEl?.value||"grandma";
  const customEl=document.getElementById("ob-family-custom");
  if(onboarding.role==="other"){
    onboarding.roleCustom=customEl?.value.trim()||"";
    if(!onboarding.roleCustom){
      if(typeof showToast==="function")showToast("관계를 입력해 주세요");
      customEl?.focus();
      return false;
    }
  }else onboarding.roleCustom="";
  return true;
}
function roleLabel(){
  if(onboarding.role==="other")return onboarding.roleCustom?.trim()||"가족";
  return ROLE_LABELS[onboarding.role]||"가족";
}
function openRoleView({preferFamily=false}={}){
  if(preferFamily){
    onboarding.roleGroup="family";
    onboarding.role="grandma";
    onboarding.roleCustom="";
  }else if(!onboarding.role||(!PARENT_ROLES.has(onboarding.role)&&onboarding.roleGroup!=="family")){
    onboarding.roleGroup="parent";
    onboarding.role="mom";
  }
  updateRoleUi();
  obShow("#onboarding-role-view");
}
function normalizeKidikidiId(raw){
  return String(raw||"").trim().replace(/\s+/g,"");
}
function showKidikidiScreen(backView){
  onboarding.kidikidiBackView=backView||"#onboarding-baby-view";
  const input=document.getElementById("ob-kidikidi-id");
  if(input)input.value=onboarding.kidikidiId||"";
  obShow("#onboarding-kidikidi-view");
  setTimeout(()=>input?.focus(),200);
}
function obBabyName(){return onboarding.babyName||"우리 아기";}
function goPhotoStep(){
  const t=document.getElementById("ob-photo-title");
  if(t)t.textContent=`${obBabyName()} 사진을 등록해요`;
  applyOnboardingPhotoPreview();
  obShow("#onboarding-photo-view");
}
function applyOnboardingPhotoPreview(){
  const pv=document.getElementById("ob-photo-preview");
  const hint=document.getElementById("ob-photo-hint");
  if(onboarding.photo){
    if(pv){pv.style.backgroundImage=`url("${onboarding.photo}")`;pv.textContent="";pv.classList.add("has");}
    if(hint)hint.textContent="다른 사진으로 바꾸기";
  }else{
    if(pv){pv.style.backgroundImage="";pv.textContent="📷";pv.classList.remove("has");}
    if(hint)hint.textContent="사진 선택하기";
  }
}
// 파일을 600px로 줄여 data-URI로(저장·동기화 용량 절약)
function readPhotoDownscaled(file){
  return new Promise(res=>{
    const fr=new FileReader();
    fr.onload=()=>{
      const im=new Image();
      im.onload=()=>{
        const max=600,scale=Math.min(1,max/Math.max(im.width,im.height));
        const w=Math.round(im.width*scale),h=Math.round(im.height*scale);
        const cv=document.createElement("canvas");cv.width=w;cv.height=h;
        cv.getContext("2d").drawImage(im,0,0,w,h);
        try{res(cv.toDataURL("image/jpeg",0.85));}catch(_){res(fr.result);}
      };
      im.onerror=()=>res(fr.result);
      im.src=fr.result;
    };
    fr.onerror=()=>res("");
    fr.readAsDataURL(file);
  });
}
function goFavsStep(){
  const t=document.getElementById("ob-favs-title");
  if(t)t.textContent=`${obBabyName()}가 좋아하는 걸 눌러주세요`;
  renderFavsGrid();
  obShow("#onboarding-favs-view");
}
function renderFavsGrid(){
  const g=document.getElementById("ob-favs-grid");if(!g)return;
  g.innerHTML=FAV_EMOJIS.map(e=>`<button type="button" class="ob-fav${onboarding.favs.includes(e)?" on":""}" data-fav="${e}">${e}</button>`).join("");
  g.querySelectorAll("[data-fav]").forEach(b=>b.addEventListener("click",()=>{
    const e=b.dataset.fav,i=onboarding.favs.indexOf(e);
    if(i>=0)onboarding.favs.splice(i,1);
    else{if(onboarding.favs.length>=8){if(typeof showToast==="function")showToast("최대 8개까지 고를 수 있어요");return;}onboarding.favs.push(e);}
    b.classList.toggle("on",onboarding.favs.includes(e));
  }));
}
function saveKidikidiIdFromInput(){
  const input=document.getElementById("ob-kidikidi-id");
  onboarding.kidikidiId=normalizeKidikidiId(input?.value);
  if(window.state){
    window.state.profile.kidikidiId=onboarding.kidikidiId;
    if(typeof window.save==="function")window.save();
  }
}
function finishOnboarding(asGuest){
  const baby=onboarding.babyName||"다엘이";
  if(!asGuest&&onboarding.userType==="parent"&&onboarding.path==="new"){
    if(window.state){
      window.state.profile.babyName=baby;
      window.state.profile.name=`${baby}의 일기`;
      window.state.profile.kidikidiId=onboarding.kidikidiId||window.state.profile.kidikidiId||"";
      if(onboarding.photo){window.state.profile.avatar=onboarding.photo;window.state.profile.background=window.state.profile.background||onboarding.photo;}
      if(onboarding.favs&&onboarding.favs.length)window.state.profile.favs=onboarding.favs.slice();
      if(typeof window.save==="function")window.save();
    }
    if(typeof window.ensureInviteCode==="function")window.ensureInviteCode(true);
  }else if(window.state&&onboarding.kidikidiId){
    window.state.profile.kidikidiId=onboarding.kidikidiId;
    if(typeof window.save==="function")window.save();
  }
  localStorage.setItem(OB_KEY,"1");
  const kakao=typeof getStoredKakaoUser==="function"?getStoredKakaoUser():null;
  localStorage.setItem(OB_AUTH_KEY,JSON.stringify({
    provider:onboarding.provider,
    userType:onboarding.userType,
    path:onboarding.path,
    role:onboarding.role,
    roleGroup:onboarding.roleGroup,
    roleCustom:onboarding.roleCustom||"",
    roleLabel:roleLabel(),
    babyName:baby,
    kidikidiId:onboarding.kidikidiId||"",
    kakaoId:kakao?.kakaoId||null,
    kakaoNickname:kakao?.nickname||"",
    profileImage:kakao?.profileImage||"",
    at:Date.now()
  }));
  document.querySelectorAll(".ob-view").forEach(v=>v.classList.remove("active"));
  if(asGuest){
    const u=new URL(location.href);
    u.searchParams.set("guest","1");
    history.replaceState(null,"",u.toString());
    document.body.classList.add("is-guest");
  }
  if(typeof window.enterMainApp==="function")window.enterMainApp(asGuest);
}
function showSuccessScreen(){
  try{ _buildSuccessScreen(); }catch(e){ /* 무슨 일이 있어도 완료 화면은 보여준다 */ }
  obShow("#onboarding-success-view");
}
function _buildSuccessScreen(){
  const baby=onboarding.babyName||"우리 아기";
  const title=document.getElementById("ob-success-title");
  const desc=document.getElementById("ob-success-desc");
  if(onboarding.userType==="invited"){
    title.textContent=`${baby} 가족에 합류했어요!`;
    desc.innerHTML=`${roleLabel()}로 참여했어요.<br/>소중한 순간들을 함께 구경해 보세요.`;
  }else if(onboarding.path==="spouse"){
    title.textContent=`${baby} 가족에 합류했어요!`;
    desc.innerHTML=`${roleLabel()}로 등록되었어요.<br/>이제 가족들과 함께 육아 여정을 이어가요.`;
  }else{
    title.textContent=`${baby} 가족이 만들어졌어요!`;
    desc.innerHTML=`${roleLabel()}로 등록되었어요.<br/>이제 가족들에게 ${baby}의 소중한 순간들을 공유해 보세요.`;
    if(onboarding.path==="new"&&typeof window.ensureInviteCode==="function"){
      const code=window.ensureInviteCode(true);
      if(code){
        desc.innerHTML+=`<div class="ob-invite-share"><p class="ob-invite-label">내 초대 코드</p><p class="ob-invite-code">${code}</p><p class="ob-invite-hint">배우자·가족·지인에게 이 코드를 보내주세요</p><button type="button" class="ob-invite-copy" id="btn-ob-copy-invite">코드 복사하기</button></div>`;
        requestAnimationFrame(()=>{
          document.getElementById("btn-ob-copy-invite")?.addEventListener("click",()=>{
            if(typeof window.copyInviteCode==="function")window.copyInviteCode();
          });
        });
      }
    }
  }
  if(onboarding.kidikidiId){
    desc.innerHTML+=`<br/><span style="font-size:13px;color:#6b6b6b;margin-top:6px;display:inline-block">키디키디 <strong>${onboarding.kidikidiId}</strong> 계정이 연결됐어요 🎁</span>`;
  }
  obShow("#onboarding-success-view");
}
function bindOnboarding(){
  const $=s=>document.querySelector(s);
  $("#btn-login-kakao")?.addEventListener("click",()=>{
    if(typeof startKakaoLogin==="function")startKakaoLogin();
    else obLogin("kakao");
  });
  $("#btn-ob-back-welcome")?.addEventListener("click",()=>obShow("#onboarding-login-view"));
  $("#btn-ob-parent")?.addEventListener("click",()=>{
    onboarding.userType="parent";
    obShow("#onboarding-path-view");
  });
  $("#btn-ob-invited")?.addEventListener("click",()=>{
    onboarding.userType="invited";
    onboarding.codeContext="guest";
    $("#ob-code-title").textContent="초대 코드를 입력해 주세요";
    $("#ob-code-desc").textContent="부모님이 보낸 6자리 코드로 가족 공간에 들어가요";
    obShow("#onboarding-code-view");
  });
  $("#btn-ob-back-path")?.addEventListener("click",()=>obShow("#onboarding-welcome-view"));
  $("#btn-ob-new-space")?.addEventListener("click",()=>{
    onboarding.path="new";
    openRoleView({preferFamily:false});
  });
  $("#btn-ob-spouse-code")?.addEventListener("click",()=>{
    onboarding.path="spouse";
    onboarding.codeContext="spouse";
    $("#ob-code-title").textContent="배우자 초대 코드 입력";
    $("#ob-code-desc").textContent="배우자가 보낸 6자리 코드를 입력해 주세요";
    obShow("#onboarding-code-view");
  });
  $("#btn-ob-back-role")?.addEventListener("click",()=>{
    if(onboarding.userType==="invited")obShow("#onboarding-code-view");
    else if(onboarding.path==="spouse")obShow("#onboarding-code-view");
    else obShow("#onboarding-path-view");
  });
  $("#btn-ob-mom")?.addEventListener("click",()=>obSelectParentRole("mom"));
  $("#btn-ob-dad")?.addEventListener("click",()=>obSelectParentRole("dad"));
  $("#btn-ob-family")?.addEventListener("click",()=>obSelectFamilyRole());
  $("#ob-family-relation")?.addEventListener("change",e=>{
    onboarding.role=e.target.value;
    syncFamilyCustomUi();
    updateRoleUi();
  });
  $("#ob-family-custom")?.addEventListener("input",e=>{
    onboarding.roleCustom=e.target.value;
  });
  $("#btn-ob-role-next")?.addEventListener("click",()=>{
    if(!syncFamilyRoleFromUi())return;
    if(onboarding.path==="new"&&onboarding.userType==="parent"){
      obShow("#onboarding-baby-view");
      setTimeout(()=>$("#ob-baby-name")?.focus(),200);
      return;
    }
    showKidikidiScreen("#onboarding-code-view");
  });
  $("#btn-ob-back-baby")?.addEventListener("click",()=>openRoleView());
  $("#btn-ob-baby-next")?.addEventListener("click",()=>{
    const name=$("#ob-baby-name")?.value.trim();
    if(!name){if(typeof showToast==="function")showToast("이름이나 태명을 적어 주세요 (안 정했으면 아래 버튼!)");return;}
    onboarding.babyName=name;
    goPhotoStep();
  });
  // 출생 전이라 아직 이름/태명이 없으면 '우리 아기'로 시작하고 나중에 바꿀 수 있게 한다.
  $("#btn-ob-baby-undecided")?.addEventListener("click",()=>{
    onboarding.babyName="우리 아기";
    if(typeof showToast==="function")showToast("'우리 아기'로 시작할게요 · 나중에 언제든 바꿀 수 있어요");
    goPhotoStep();
  });
  // 프로필 사진 단계
  $("#btn-ob-back-photo")?.addEventListener("click",()=>obShow("#onboarding-baby-view"));
  $("#ob-photo-pick")?.addEventListener("click",()=>$("#ob-photo-input")?.click());
  $("#ob-photo-input")?.addEventListener("change",async e=>{
    const f=e.target.files&&e.target.files[0];if(!f)return;
    if(typeof showToast==="function")showToast("사진을 준비하는 중...");
    onboarding.photo=await readPhotoDownscaled(f);
    applyOnboardingPhotoPreview();
    e.target.value="";
  });
  $("#btn-ob-photo-next")?.addEventListener("click",()=>goFavsStep());
  $("#btn-ob-photo-skip")?.addEventListener("click",()=>goFavsStep());
  // 좋아하는 것 단계
  $("#btn-ob-back-favs")?.addEventListener("click",()=>goPhotoStep());
  $("#btn-ob-favs-next")?.addEventListener("click",()=>showKidikidiScreen("#onboarding-favs-view"));
  $("#btn-ob-back-kidikidi")?.addEventListener("click",()=>obShow(onboarding.kidikidiBackView||"#onboarding-favs-view"));
  $("#btn-ob-kidikidi-next")?.addEventListener("click",()=>{
    const note=(m)=>{ if(typeof showToast==="function")showToast(m); else try{alert(m);}catch(_){} };
    const id=normalizeKidikidiId($("#ob-kidikidi-id")?.value);
    if(!id){ note("키디키디 아이디를 입력해 주세요 (또는 '나중에 할게요')"); return; }
    if(id.length<3){ note("아이디를 3자 이상 입력해 주세요"); return; }
    onboarding.kidikidiId=id;
    try{saveKidikidiIdFromInput();}catch(_){}
    try{showSuccessScreen();}
    catch(e){ try{finishOnboarding(onboarding.userType==="invited");}catch(_){ obShow("#onboarding-success-view"); } }
  });
  $("#btn-ob-kidikidi-skip")?.addEventListener("click",()=>{
    onboarding.kidikidiId="";
    try{showSuccessScreen();}
    catch(e){ try{finishOnboarding(onboarding.userType==="invited");}catch(_){ obShow("#onboarding-success-view"); } }
  });
  $("#btn-ob-back-code")?.addEventListener("click",()=>{
    if(onboarding.userType==="invited")obShow("#onboarding-welcome-view");
    else obShow("#onboarding-path-view");
  });
  $("#btn-ob-code-submit")?.addEventListener("click",()=>{
    const code=$("#ob-invite-code")?.value.trim().toUpperCase();
    if(code.length<4){
      if(typeof showToast==="function")showToast("초대 코드를 입력해 주세요");
      return;
    }
    const valid=typeof window.isValidInviteCode==="function"
      ?window.isValidInviteCode(code)
      :(code===DEMO_INVITE_CODE||code==="123456");
    if(!valid){
      if(typeof showToast==="function")showToast("코드를 확인해 주세요");
      return;
    }
    onboarding.babyName="다엘이";
    openRoleView({preferFamily:onboarding.userType==="invited"});
  });
  $("#btn-ob-finish")?.addEventListener("click",()=>{
    finishOnboarding(onboarding.userType==="invited");
  });
  $("#ob-baby-name")?.addEventListener("keydown",e=>{
    if(e.key==="Enter")$("#btn-ob-baby-next")?.click();
  });
  $("#ob-kidikidi-id")?.addEventListener("keydown",e=>{
    if(e.key==="Enter")$("#btn-ob-kidikidi-next")?.click();
  });
  $("#ob-invite-code")?.addEventListener("input",e=>{
    e.target.value=e.target.value.replace(/[^a-zA-Z0-9]/g,"").toUpperCase();
  });
}
function initOnboarding(){
  bindOnboarding();
  const kakaoUser=typeof getStoredKakaoUser==="function"?getStoredKakaoUser():null;
  if(kakaoUser){
    onboarding.provider="kakao";
    if(typeof applyKakaoUserToProfile==="function")applyKakaoUserToProfile(kakaoUser);
  }
  const params=new URLSearchParams(location.search);
  if(params.get("kakao_error")){
    const code=params.get("kakao_error");
    const detail=params.get("kakao_detail")||"";
    const msg="카카오 로그인 실패 ["+code+"]"+(detail?"\n\n"+decodeURIComponent(detail):"");
    // 원인을 바로 볼 수 있게 알림으로 표시(개발/설정 점검용)
    try{alert(msg);}catch(_){}
    if(typeof showToast==="function")showToast("카카오 로그인 실패: "+code);
    params.delete("kakao_error");params.delete("kakao_detail");
    history.replaceState(null,"",location.pathname+(params.toString()?"?"+params:""));
  }
  if(isOnboardingPreview()){
    localStorage.removeItem(OB_KEY);
    obShow("#onboarding-login-view");
    return true;
  }
  if(isOnboarded())return false;
  if(kakaoUser){
    obShow("#onboarding-welcome-view");
    return true;
  }
  obShow("#onboarding-login-view");
  return true;
}

