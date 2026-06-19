const PHOTOS_VERSION=5;
const AGE_TABS=[
  {id:"all",label:"전체"},
  {id:"0",label:"Newborn",months:[0]},
  {id:"3",label:"3개월",months:[3]},
  {id:"6",label:"6개월",months:[6]},
  {id:"9",label:"9개월",months:[9],current:true,stageId:"s7"}
];
const AGE_STAGE_MAP={0:"s5",3:"s5",6:"s6",9:"s7",12:"s8"};
const CHAPTERS={
  0:{chapter:"Chapter 1",title:"Newborn",subtitle:"첫 만남의 시작"},
  3:{chapter:"Chapter 2",title:"3개월",subtitle:"목 가눔 & 감각 발달"},
  6:{chapter:"Chapter 3",title:"6개월",subtitle:"이유식 마스터 단계"},
  9:{chapter:"Chapter 4",title:"9개월",subtitle:"기어다니기 마스터 단계"}
};
const CONTRIBUTE_AMOUNTS=[10000,30000,50000,100000];
const SEASON={name:"백일 축하 시즌",open:true,until:"2026-07-15"};
const PARENT_DONE_QUESTS={
  9:[
    {id:"pd9-1",bar:"엄마·아빠가 완료한 퀘스트",name:"아기 체육관 설치하기",current:1,target:1,reward:"🎬",rewardLabel:"체육관 GIF"},
    {id:"pd9-2",bar:"엄마·아빠가 완료한 퀘스트",name:"이유식 의자 & 식기 세팅",current:1,target:1,reward:"🪑",rewardLabel:"식사 인증샷"},
    {id:"pd9-3",bar:"엄마·아빠가 완료한 퀘스트",name:"거실 안전 매트 1차 설치",current:1,target:1,reward:"🧸",rewardLabel:"놀이 영상"},
    {id:"pd9-4",bar:"엄마·아빠가 완료한 퀘스트",name:"아기 무릎 보호대 준비",current:1,target:1,reward:"🦵",rewardLabel:"기어다니기 샷"}
  ],
  6:[
    {id:"pd6-1",bar:"엄마·아빠가 완료한 퀘스트",name:"이유식 조리도구 세팅",current:1,target:1,reward:"🥣",rewardLabel:"첫 이유식"},
    {id:"pd6-2",bar:"엄마·아빠가 완료한 퀘스트",name:"하이체어 설치",current:1,target:1,reward:"🪑",rewardLabel:"식사 타임"}
  ],
  3:[
    {id:"pd3-1",bar:"엄마·아빠가 완료한 퀘스트",name:"목 가눔 완구 설치",current:1,target:1,reward:"🧸",rewardLabel:"놀이 영상"}
  ],
  0:[
    {id:"pd0-1",bar:"엄마·아빠가 완료한 퀘스트",name:"신생아 침대 & 속싸개 준비",current:1,target:1,reward:"👶",rewardLabel:"첫 날 앨범"}
  ]
};
const FUNDING_GAUGE={
  "fund-carseat":{
    bar:"조각 펀딩 퀘스트",category:"백일 기념 펀딩",
    name:"첫 드라이브, 대형 카시트 장만하기",emoji:"🚗",
    goal:1000000,raised:650000,
    copy:"이모·삼촌들 덕분에 드디어 카시트가 완성되어 배송됩니다!",
    puzzleImage:"public/photos/ai-03.jpg",
    puzzleCols:4,puzzleRows:4,
    rewards:[{icon:"📷",label:"첫 시승 앨범"},{icon:"💌",label:"감사 손편지"}]
  },
  "fund-stroller":{
    bar:"조각 펀딩 퀘스트",category:"첫 외출 펀딩",
    name:"민우 유모차 완성하기",emoji:"🛒",
    goal:1000000,raised:420000,
    puzzleImage:"public/photos/ai-04.jpg",
    puzzleCols:4,puzzleRows:4,
    rewards:[{icon:"📷",label:"첫 산책 앨범"},{icon:"💌",label:"감사 카드"}]
  }
};
const COLLECT_QUESTS={
  9:{id:"col-bib",bar:"단품 채우기 퀘스트",name:"침 흘림 폭발! 순면 턱받이 5장",unitPrice:8000,target:5,current:1,reward:"📸",rewardLabel:"착용 인증샷"},
  6:{id:"col-spoon",bar:"단품 채우기 퀘스트",name:"이유식 숟가락 3개 세트",unitPrice:12000,target:3,current:2,reward:"🥄",rewardLabel:"첫 이유식 샷"}
};
const FUNDING_ITEMS={
  "s3-16":{name:"카시트",emoji:"🚗",copy:"다엘이의 안전을 지키는 카시트! 조각마다 금액이 달라요.",type:"puzzle",
    image:"public/photos/ai-03.jpg",cols:3,rows:2,pieces:[
    {id:"cs1",name:"시트",price:150000,from:"이모"},{id:"cs2",name:"베이스",price:150000,from:"삼촌"},
    {id:"cs3",name:"캐노피",price:100000},{id:"cs4",name:"안전벨트",price:80000},
    {id:"cs5",name:"헤드서포트",price:70000},{id:"cs6",name:"프레임",price:150000}
  ]},
  "s7-mat":{name:"거실 매트",emoji:"🧩",copy:"무릎 보호 매트 조각 펀딩!",type:"puzzle",
    image:"public/photos/ai-05.jpg",cols:2,rows:2,pieces:[
    {id:"m1",name:"조각 A",price:30000,from:"고모"},{id:"m2",name:"조각 B",price:30000},
    {id:"m3",name:"조각 C",price:30000},{id:"m4",name:"조각 D",price:30000}
  ]}
};
const DEMO_NEED_ITEMS={
  9:[{id:"s7-mat",name:"거실 매트 조각 펀딩",emoji:"🧩",desc:"기어 다닐 때 무릎 보호",funding:true},{id:"s7-knee",name:"아기 무릎 보호대",emoji:"🦵",desc:"바닥 활동 보호"}],
  6:[{id:"s6-01",name:"이유식 시작 세트",emoji:"🥣",desc:"6개월 이유식 준비"}],
  3:[{id:"s5-01",name:"목 가눔 완구",emoji:"🧸",desc:"3개월 감각 발달"}]
};
const JOURNEY_MAP=[
  {kind:"stage",id:"st-birth",label:"출산",month:0},
  {kind:"node",id:"jn-swaddle",name:"배냇저고리 졸업",emoji:"👶",month:0,parentDone:true,diary:"첫 옷 입히기 성공! 작은 손발이 너무 귀여웠어요.",photoSrc:"public/photos/ai-01.jpg"},
  {kind:"node",id:"jn-tummy",name:"터미타임 성공",emoji:"🙇",month:1,parentDone:true,diary:"배에 엎드려 고개 드는 연습, 매일 3분씩!",photoSrc:"public/photos/ai-02.jpg"},
  {kind:"stage",id:"st-50",label:"50일",month:2},
  {kind:"node",id:"jn-smile",name:"첫 웃음 포착",emoji:"😊",month:2,parentDone:true,diary:"드디어 웃어줬어요. 심장 녹음 ㅠㅠ",photoSrc:"public/photos/ai-03.jpg"},
  {kind:"stage",id:"st-100",label:"100일",month:3},
  {kind:"node",id:"jn-100table",name:"백일상 차리기",emoji:"🎂",month:3,parentDone:true,diary:"가족이 모여 백일상을 차렸어요.",photoSrc:"public/photos/ai-04.jpg"},
  {kind:"node",id:"jn-raid-cs",type:"raid",name:"안전한 외출을 위한 카시트 성 문 열기",emoji:"🏰",month:3,fundKey:"fund-carseat",raidCopy:"여러 명의 이모, 삼촌들이 힘을 모아 성문을 열고 있어요!"},
  {kind:"stage",id:"st-6",label:"6개월",month:6},
  {kind:"node",id:"jn-chair",name:"하이체어 설치",emoji:"🪑",month:6,parentDone:true,diary:"이유식 의자 설치 완료! 앉아서 먹는 연습 중.",photoSrc:"public/photos/ai-05.jpg"},
  {kind:"node",id:"jn-babyfood",type:"gift",name:"이유식 시작하기",emoji:"🥄",month:6,
    questTitle:"생애 첫 미음을 응원해 주세요!",questDesc:"드디어 쌀미음을 시작해요! 튼튼한 이유식 용기와 턱받이가 필요해요.",giftPrice:45000,collectKey:6,kidikidiKeyword:"이유식기"},
  {kind:"stage",id:"st-9",label:"9개월",month:9},
  {kind:"node",id:"jn-crawl",name:"기어다니기 성공",emoji:"🐛",month:8,parentDone:true,diary:"거실 매트 위를 쌩쌩 기어다녀요!",photoSrc:"public/photos/ai-01.jpg"},
  {kind:"node",id:"jn-gym",name:"아기 체육관 설치",emoji:"🧸",month:9,parentDone:true,diary:"체육관에서 손잡이 잡고 일어서기 도전 중.",photoSrc:"public/photos/ai-02.jpg"},
  {kind:"node",id:"jn-raid-st",type:"raid",name:"유모차 성 문 열기",emoji:"🛒",month:9,fundKey:"fund-stroller",raidCopy:"이모·삼촌들이 조각을 맞추며 유모차를 완성하고 있어요!"},
  {kind:"node",id:"jn-bib",type:"gift",name:"턱받이 5장 채우기",emoji:"👶",month:9,
    questTitle:"침 흘림 폭발 시기! 턱받이를 응원해 주세요",questDesc:"이유식 먹을 때마다 턱받이가 필수예요. 1장씩 모아주세요!",collectKey:9,kidikidiKeyword:"턱받이"},
  {kind:"stage",id:"st-12",label:"돌",month:12},
  {kind:"node",id:"jn-socks",name:"아장아장 걸음마 양말",emoji:"🧦",month:11,lockedPreview:"첫 걸음을 응원하는 미끄럼 방지 양말"},
  {kind:"node",id:"jn-dol",name:"첫 돌잡이 펀딩",emoji:"🎁",month:12,lockedPreview:"돌잔치를 위한 특별 퀘스트"}
];
