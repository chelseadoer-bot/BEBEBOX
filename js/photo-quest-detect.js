const QUEST_VISION_PROFILES=[
  {journeyId:"jn-swaddle",label:"배냇저고리 졸업",keywords:["swaddle","속싸","신생아","newborn"],demoPaths:["ai-01.jpg"]},
  {journeyId:"jn-tummy",label:"터미타임 성공",keywords:["tummy","터미","엎드"],demoPaths:["ai-02.jpg"]},
  {journeyId:"jn-smile",label:"첫 웃음 포착",keywords:["smile","웃음","미소"],demoPaths:["ai-03.jpg"]},
  {journeyId:"jn-100table",label:"백일상 차리기",keywords:["100","백일","돌상"],demoPaths:["ai-04.jpg"]},
  {journeyId:"jn-chair",label:"하이체어 설치",keywords:["chair","체어","의자","이유식"],demoPaths:["ai-05.jpg"]},
  {journeyId:"jn-crawl",parentQuestId:"pd9-4",label:"기어다니기 성공",keywords:["기어","크롤","crawl"," crawling","매트"],demoPaths:["ai-01.jpg"],crawlLike:true},
  {journeyId:"jn-gym",label:"아기 체육관 설치",keywords:["체육관","gym","놀이"],demoPaths:["ai-02.jpg"]}
];

function normPath(src){
  return String(src||"").split("?")[0].replace(/\\/g,"/").toLowerCase();
}

function scoreByFilename(fileName,profile){
  const name=String(fileName||"").toLowerCase();
  if(!name)return 0;
  let score=0;
  profile.demoPaths.forEach(p=>{if(name.includes(p.toLowerCase()))score+=0.85;});
  profile.keywords.forEach(kw=>{if(name.includes(kw.toLowerCase()))score+=0.55;});
  return score;
}

function scoreBySrcPath(src,profile){
  const path=normPath(src);
  let score=0;
  profile.demoPaths.forEach(p=>{if(path.includes(p.toLowerCase()))score+=0.9;});
  return score;
}

function analyzeCanvasFeatures(img){
  const max=220;
  const scale=Math.min(1,max/Math.max(img.width,img.height));
  const w=Math.max(1,Math.round(img.width*scale));
  const h=Math.max(1,Math.round(img.height*scale));
  const canvas=document.createElement("canvas");
  canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  ctx.drawImage(img,0,0,w,h);
  const data=ctx.getImageData(0,0,w,h).data;
  const bands=[0,0,0].map(()=>({n:0,lum:0,lumSq:0,sat:0}));
  for(let y=0;y<h;y++){
    const band=Math.min(2,Math.floor(y/(h/3)));
    for(let x=0;x<w;x++){
      const i=(y*w+x)*4;
      const r=data[i],g=data[i+1],b=data[i+2];
      const lum=0.299*r+0.587*g+0.114*b;
      const maxC=Math.max(r,g,b),minC=Math.min(r,g,b);
      const sat=maxC?((maxC-minC)/maxC):0;
      const bkt=bands[band];
      bkt.n++;bkt.lum+=lum;bkt.lumSq+=lum*lum;bkt.sat+=sat;
    }
  }
  const stats=bands.map(b=>{
    if(!b.n)return{mean:0,std:0,sat:0};
    const mean=b.lum/b.n;
    const variance=Math.max(0,b.lumSq/b.n-mean*mean);
    return{mean,std:Math.sqrt(variance),sat:b.sat/b.n};
  });
  const aspect=w/h;
  const bottom=stats[2],top=stats[0],mid=stats[1];
  return{aspect,bottom,top,mid,w,h};
}

function scoreByVision(features,profile){
  let score=0;
  if(profile.crawlLike){
    if(features.aspect>1.05)score+=0.15;
    if(features.bottom.std>features.top.std*1.08)score+=0.25;
    if(features.bottom.mean<features.top.mean+18)score+=0.15;
    if(features.bottom.sat>features.top.sat*0.95)score+=0.1;
    if(features.mid.std<features.bottom.std*0.92)score+=0.1;
  }else{
    if(features.mid.std>features.top.std*0.9)score+=0.12;
    if(features.mid.sat>features.bottom.sat*0.85)score+=0.1;
  }
  return score;
}

function loadImageElement(src){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(new Error("image load failed"));
    img.src=src;
  });
}

async function analyzePhotoForQuest(imageSrc,fileName){
  const results=[];
  for(const profile of QUEST_VISION_PROFILES){
    let score=scoreByFilename(fileName,profile)+scoreBySrcPath(imageSrc,profile);
    try{
      const img=await loadImageElement(imageSrc);
      score+=scoreByVision(analyzeCanvasFeatures(img),profile);
    }catch(_){}
    if(score>0.28)results.push({...profile,score});
  }
  results.sort((a,b)=>b.score-a.score);
  return results[0]||null;
}

function journeyNodeById(id){
  return (typeof JOURNEY_MAP!=="undefined"?JOURNEY_MAP:[]).find(n=>n.id===id)||null;
}
