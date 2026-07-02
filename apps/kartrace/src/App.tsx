import React, { useState, useEffect } from 'react';
import BabyPhotoUploader, { DEFAULT_BABIES, FaceConfig } from './components/BabyPhotoUploader';
import KartSelector, { PRESET_KARTS } from './components/KartSelector';
import GameCanvas from './components/GameCanvas';
import ScoreBoard from './components/ScoreBoard';
import { Kart } from './types';
import { Play, Sparkles, HelpCircle, Trophy, Award, Car, Heart } from 'lucide-react';

export default function App() {
  // Screens: 'setup' | 'game' | 'scoreboard'
  const [activeScreen, setActiveScreen] = useState<'setup' | 'game' | 'scoreboard'>('setup');

  // Chosen settings
  const [selectedBabyPhoto, setSelectedBabyPhoto] = useState<string>(DEFAULT_BABIES[0].svgUrl);
  const [selectedBabyId, setSelectedBabyId] = useState<string>(DEFAULT_BABIES[0].id);
  const [faceConfig, setFaceConfig] = useState<FaceConfig>({
    scale: 1.0,
    offsetY: 0,
    offsetX: 0,
    rotation: 0,
    hasHelmet: true
  });

  const [selectedKart, setSelectedKart] = useState<Kart>(PRESET_KARTS[0]);
  const [selectedKartId, setSelectedKartId] = useState<string>(PRESET_KARTS[0].id);

  // 부모(BEBEBOX)에서 전달받은 프로필 사진/아기이름 — 기본 라이더로 사용
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string>('우리 아기');

  // Score statistics
  const [gameResult, setGameResult] = useState({
    score: 0,
    distance: 0,
    coins: 0
  });

  // 부모 앱과 핸드셰이크: 마운트 시 준비완료 알림 → 프로필 사진/이름 수신
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (!d || d.type !== 'bebebox-init') return;
      if (d.avatar) {
        setProfilePhoto(d.avatar);
        setSelectedBabyPhoto(d.avatar);
        setSelectedBabyId('profile');
        setFaceConfig({ scale: 1.0, offsetY: 0, offsetX: 0, rotation: 0, hasHelmet: true });
      }
      if (d.babyName) setProfileName(String(d.babyName));
    };
    window.addEventListener('message', onMsg);
    try { window.parent.postMessage({ type: 'kartrace-ready' }, '*'); } catch (_) {}
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const handlePhotoSelected = (imgUrl: string, config: FaceConfig) => {
    setSelectedBabyPhoto(imgUrl);
    setFaceConfig(config);
  };

  const handleKartSelected = (kart: Kart) => {
    setSelectedKart(kart);
  };

  const handleGameEnd = (score: number, distance: number, coins: number) => {
    setGameResult({ score, distance, coins });
    setActiveScreen('scoreboard');
    // 완주(1,000m) 성공 시 부모(BEBEBOX)에 캔디 보상 요청
    if (distance >= 1000) {
      try { window.parent.postMessage({ type: 'kartrace-win', reward: 5 }, '*'); } catch (_) {}
    }
  };

  const startRace = () => {
    setActiveScreen('game');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col antialiased">
      
      {/* Visual background ambient blobs */}
      <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-indigo-100 rounded-full blur-3xl opacity-40 pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[350px] h-[350px] bg-pink-100 rounded-full blur-3xl opacity-40 pointer-events-none" />

      {/* Main Container */}
      <main className="flex-1 flex flex-col py-8 px-4 max-w-5xl mx-auto w-full relative z-10 justify-center">
        
        {activeScreen === 'setup' && (
          <div className="space-y-8 animate-fade-in" id="setup-view">
            {/* App Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-100 text-pink-600 text-xs font-bold tracking-tight">
                <Sparkles className="w-3.5 h-3.5" /> 1분 스피드 레이싱 게임
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
                아기랑 카트 레이싱!
              </h1>
              <p className="text-sm sm:text-base text-slate-500 max-w-md mx-auto leading-relaxed">
                진짜 우리 아기 사진을 넣어 보세요! 안전모를 쓴 아기가 카트에 탑승하여 스릴 넘치게 달립니다.
              </p>
            </div>

            {/* Config Panels - Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              <BabyPhotoUploader
                onPhotoSelected={handlePhotoSelected}
                selectedBabyId={selectedBabyId}
                setSelectedBabyId={setSelectedBabyId}
                profilePhoto={profilePhoto}
                profileName={profileName}
              />
              <KartSelector
                onKartSelected={handleKartSelected}
                selectedKartId={selectedKartId}
                setSelectedKartId={setSelectedKartId}
              />
            </div>

            {/* LIVE PREVIEW OF ASSEMBLED RIDER + KART */}
            <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 max-w-lg mx-auto text-center space-y-4" id="assembled-preview">
              <div className="flex justify-between items-center px-2">
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                  <EyeIcon className="w-3.5 h-3.5 text-indigo-500" /> 레이싱 대기실 프리뷰
                </span>
                <span className="text-[10px] text-pink-500 font-extrabold">READY FOR START</span>
              </div>

              {/* Composition Stage */}
              <div className="h-40 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center relative overflow-hidden shadow-inner">
                {/* Simple grid floor */}
                <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-70" />
                
                {/* Ambient glow behind kart */}
                <div 
                  className="absolute w-24 h-6 rounded-full blur-md opacity-20 bottom-8"
                  style={{ backgroundColor: selectedKart.color }}
                />

                {/* Animated Kart Container */}
                <div className="relative flex flex-col items-center animate-wiggle-slow mt-4">
                  
                  {/* The Baby's Face positioned on top */}
                  <div className="relative z-20" style={{ transform: 'translateY(12px)' }}>
                    <div 
                      className="relative w-14 h-14 rounded-full border-2 border-white shadow-md overflow-hidden bg-white"
                      style={{
                        transform: `scale(${faceConfig.scale}) translate(${faceConfig.offsetX * 0.15}px, ${faceConfig.offsetY * 0.15}px) rotate(${faceConfig.rotation}deg)`
                      }}
                    >
                      <div
                        className="w-full h-full"
                        style={{
                          backgroundImage: `url(${selectedBabyPhoto})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}
                      />
                    </div>

                    {/* Cute Pilot Helmet */}
                    {faceConfig.hasHelmet && (
                      <div 
                        className="absolute inset-x-0 -top-1 px-1 py-0.5 rounded-full bg-red-500/90 text-[7px] text-white font-extrabold border border-white text-center shadow scale-90"
                        style={{ transform: 'translateY(-2px)' }}
                      >
                        PILOT
                      </div>
                    )}
                  </div>

                  {/* The Selected Kart Model */}
                  <div className="relative z-10 w-20 h-16 flex items-center justify-center">
                    {selectedKart.isCustom && selectedKart.svgPath ? (
                      <img src={selectedKart.svgPath} alt="Custom Kart" className="w-16 h-12 object-contain" />
                    ) : (
                      <div 
                        className="w-16 h-12 rounded-xl flex items-center justify-center text-white relative overflow-hidden shadow-md"
                        style={{ background: `linear-gradient(135deg, ${selectedKart.color}, #111)` }}
                      >
                        <Car className="w-8 h-8 drop-shadow" />
                        <div className="absolute inset-0 bg-white/10 skew-x-12 translate-x-3 pointer-events-none" />
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* Start Trigger Button */}
              <button
                id="start-race-btn"
                onClick={startRace}
                className="w-full bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 text-white font-black text-base py-4 rounded-2xl transition-all shadow-xl shadow-indigo-500/25 active:scale-98 flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5 fill-current" /> 레이스 출발하기! (START)
              </button>
            </div>
          </div>
        )}

        {activeScreen === 'game' && (
          <div className="animate-fade-in flex justify-center items-center">
            <GameCanvas
              kart={selectedKart}
              babyPhotoUrl={selectedBabyPhoto}
              faceConfig={faceConfig}
              onGameEnd={handleGameEnd}
              onExit={() => setActiveScreen('setup')}
            />
          </div>
        )}

        {activeScreen === 'scoreboard' && (
          <div className="animate-fade-in">
            <ScoreBoard
              score={gameResult.score}
              distance={gameResult.distance}
              coins={gameResult.coins}
              kart={selectedKart}
              babyPhotoUrl={selectedBabyPhoto}
              faceConfig={faceConfig}
              babyName={profileName}
              onRestart={() => setActiveScreen('game')}
              onExit={() => setActiveScreen('setup')}
            />
          </div>
        )}

      </main>

      {/* Aesthetic Footer */}
      <footer className="py-6 text-center text-xs text-slate-400 border-t border-slate-100 bg-white mt-auto">
        <p>© 2026 아기랑 카트 레이싱 - 소중한 우리 아기 전용 드리프트 게임</p>
      </footer>
    </div>
  );
}

// Inline helper icon for Eye
function EyeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
