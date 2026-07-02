import React from 'react';
import { Award, RotateCcw, Calendar, Medal, Home, Eye, ShoppingBag } from 'lucide-react';
import { Kart } from '../types';
import { FaceConfig } from './BabyPhotoUploader';

interface ScoreBoardProps {
  score: number;
  distance: number;
  coins: number;
  kart: Kart;
  babyPhotoUrl: string;
  faceConfig: FaceConfig;
  babyName?: string;
  onRestart: () => void;
  onExit: () => void;
}

// 결과 화면 '핀핀 상품 더보기' (키디키디 상품) — 카트/승용완구 연관 상품
const PINPIN_PRODUCTS = [
  { no: '2603319309', name: '초경량 휴대용 트라이크 V1 클래식', price: 69900, img: 'https://item.elandrs.com/r/image/item/2026-05-21/e5214c5c-4dbd-4d5c-a7d4-573c60ddc6db.jpg' },
  { no: '2604393821', name: '초경량 휴대용 트라이크 V2 와이드', price: 85900, img: 'https://item.elandrs.com/r/image/item/2026-05-14/cd02590b-b069-4200-9f84-0a8069f9fbbf.jpg' },
  { no: '2603334059', name: '드림 스타트 밸런스 바이크 V2 프로', price: 45900, img: 'https://item.elandrs.com/r/image/item/2026-03-19/cfc89107-87e2-4e7f-a749-f8178bb0282a.jpg' },
  { no: '2604390565', name: '스위밍베어 캐노피 튜브', price: 17900, img: 'https://item.elandrs.com/r/image/item/2026-05-13/ae1f4e2b-41e7-429c-9651-7c72ff317533.jpg' },
];
const pinpinUrl = (no: string) => `https://kidikidi.elandmall.co.kr/i/item?itemNo=${no}`;

export default function ScoreBoard({
  score,
  distance,
  coins,
  kart,
  babyPhotoUrl,
  faceConfig,
  babyName = '우리 아기',
  onRestart,
  onExit
}: ScoreBoardProps) {

  // Classify racer tier
  const getRacerTier = () => {
    if (score >= 9000) return { title: '👑 전설의 슈마허 베이비', color: 'from-amber-500 to-yellow-500', desc: '빛의 속도로 은하계를 돌파한 최고 레이서!' };
    if (score >= 6000) return { title: '⭐ 슈퍼 패스트 베이비', color: 'from-pink-500 to-rose-500', desc: '환상적인 드리프트로 결승선을 장악했습니다!' };
    if (score >= 3000) return { title: '🚗 스피드 드리프터', color: 'from-indigo-500 to-cyan-500', desc: '뛰어난 감각으로 장애물을 완벽히 정복했어요.' };
    return { title: '👶 초보 귀요미 드라이버', color: 'from-emerald-500 to-teal-500', desc: '조금씩 적응하며 카트의 매력에 푹 빠졌습니다!' };
  };

  const tier = getRacerTier();
  const isWinner = distance >= 1000;

  return (
    <div className="max-w-md mx-auto space-y-5 px-4" id="score-board-container">

      {/* 1. Header Hero Card */}
      <div className={`rounded-3xl p-6 text-center text-white bg-gradient-to-br ${isWinner ? 'from-indigo-600 via-indigo-700 to-purple-800' : 'from-slate-700 to-slate-800'} shadow-2xl relative overflow-hidden`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none" />

        <div className="mx-auto w-16 h-16 rounded-full bg-white/15 flex items-center justify-center text-4xl shadow-inner mb-3 animate-bounce">
          {isWinner ? '🏆' : '🏁'}
        </div>

        <h2 className="text-2xl font-extrabold tracking-tight">
          {isWinner ? '레이싱 완주 성공!' : '레이스 종료!'}
        </h2>
        <p className="text-xs text-white/70 mt-1">
          {isWinner ? '1,000m 완주 기록을 달성했습니다!' : '다음엔 꼭 1,000m 결승선을 통과해 보세요!'}
        </p>

        <div className="my-5 py-2 bg-white/10 rounded-2xl border border-white/10 backdrop-blur-xs">
          <span className="text-xs font-semibold text-white/60 tracking-wider block">FINAL SCORE</span>
          <span className="text-4xl font-black tracking-tighter text-yellow-300 block">
            {score.toLocaleString()} <span className="text-sm font-bold text-white">점</span>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 divide-x divide-white/10 text-center">
          <div>
            <span className="text-[10px] text-white/50 block">이동 거리</span>
            <span className="text-base font-bold text-slate-100">{distance} m</span>
          </div>
          <div>
            <span className="text-[10px] text-white/50 block">수집한 코인</span>
            <span className="text-base font-bold text-yellow-300">🪙 {coins}개</span>
          </div>
        </div>
      </div>

      {/* 2. HONORARY RACER LICENSE CARD */}
      <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 space-y-4" id="license-section">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
            <Award className="w-4 h-4 text-pink-500" />
            아기 명예 드라이버 면허증
          </h3>
          <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">인증 완료</span>
        </div>

        <div className={`p-5 rounded-2xl bg-gradient-to-br ${tier.color} text-white shadow-lg border border-white/20 relative overflow-hidden min-h-[210px]`}>
          <div className="absolute inset-0 bg-linear-to-tr from-white/5 via-transparent to-white/10 pointer-events-none" />
          <div className="absolute right-[-20px] top-[-20px] w-28 h-28 rounded-full bg-white/5 blur-xl pointer-events-none" />

          <div className="flex justify-between items-start border-b border-white/20 pb-2 mb-3">
            <div>
              <span className="text-[9px] font-bold tracking-widest text-white/70 block">BABY RACER LICENSE</span>
              <span className="text-xs font-black tracking-tighter">베이비 카트 명예면허증</span>
            </div>
            <Medal className="w-7 h-7 text-yellow-300 drop-shadow" />
          </div>

          <div className="flex gap-4 items-center">
            <div className="relative w-18 h-18 rounded-xl overflow-hidden border-2 border-white/40 shadow bg-white flex-shrink-0">
              <div
                className="w-full h-full"
                style={{
                  backgroundImage: `url(${babyPhotoUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  transform: `scale(${faceConfig.scale}) translate(${faceConfig.offsetX * 0.2}px, ${faceConfig.offsetY * 0.2}px) rotate(${faceConfig.rotation}deg)`
                }}
              />
              {faceConfig.hasHelmet && (
                <div className="absolute inset-x-0 bottom-0 bg-red-600 text-[6px] font-bold text-center py-0.5 text-white/95">
                  PILOT
                </div>
              )}
            </div>

            <div className="flex-1 space-y-1.5 text-xs text-white/95">
              <div>
                <span className="text-[9px] text-white/60 block">라이더 네임</span>
                <span className="font-extrabold text-sm">{babyName}</span>
              </div>
              <div>
                <span className="text-[9px] text-white/60 block">선택 카트</span>
                <span className="font-semibold">{kart.name}</span>
              </div>
              <div>
                <span className="text-[9px] text-white/60 block">취득 면허 클래스</span>
                <span className="font-bold text-yellow-200">{tier.title}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-2 mt-4 flex justify-between items-center text-[10px] text-white/75">
            <span>면허 고유번호: BK-{(score * 7).toString().padStart(6, '0')}</span>
            <span className="font-mono flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {new Date().toISOString().split('T')[0]}
            </span>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1">
          <Eye className="w-3 h-3 text-pink-400" /> {babyName}의 레이싱 면허증이 발급되었어요!
        </p>
      </div>

      {/* 3. 핀핀 연관 상품 더보기 */}
      <div className="bg-white rounded-3xl p-5 shadow-xl border border-slate-100" id="pinpin-shop">
        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 mb-3">
          <ShoppingBag className="w-4 h-4 text-pink-500" /> 🎁 핀핀 상품 더보기
        </h3>
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
          {PINPIN_PRODUCTS.map((p) => (
            <a
              key={p.no}
              href={pinpinUrl(p.no)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 w-32 rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm hover:shadow-md active:scale-98 transition"
            >
              <div className="w-full aspect-square bg-slate-100 overflow-hidden">
                <img src={p.img} alt="" loading="lazy" className="w-full h-full object-cover" />
              </div>
              <div className="p-2">
                <div className="text-[10px] font-bold text-slate-400">핀핀</div>
                <div className="text-[11px] text-slate-700 leading-snug line-clamp-2 min-h-[30px]">{p.name}</div>
                <div className="text-[13px] font-extrabold text-slate-900 mt-1">{p.price.toLocaleString()}원</div>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* 4. Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onRestart}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm py-3.5 px-6 rounded-2xl transition-colors flex items-center justify-center gap-2 shadow-lg hover:shadow-indigo-500/20"
        >
          <RotateCcw className="w-4 h-4" /> 다시 레이싱하기
        </button>
        <button
          onClick={onExit}
          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm py-3.5 px-6 rounded-2xl transition-all flex items-center justify-center gap-2 border border-slate-200"
        >
          <Home className="w-4 h-4" /> 홈으로 이동
        </button>
      </div>
    </div>
  );
}
