import React, { useState, useRef } from 'react';
import { Car, Upload, Sparkles, Check, Flame, Shield, ArrowRight } from 'lucide-react';
import { Kart } from '../types';

// BEBEBOX에서 제공한 카트(유모차) 누끼 이미지를 프리셋으로 사용.
// 부모 앱 정적경로(/public/photos/karts/*) 를 절대경로로 참조한다.
export const PRESET_KARTS: Kart[] = [
  {
    id: 'kart_cream',
    name: '크림 카트',
    color: '#f2d9b1',
    speed: 4,
    handling: 5,
    svgPath: '/public/photos/karts/kart1.png?v=2',
    isCustom: true
  },
  {
    id: 'kart_gray',
    name: '그레이 카트',
    color: '#9aa3ad',
    speed: 5,
    handling: 3,
    svgPath: '/public/photos/karts/kart2.png?v=2',
    isCustom: true
  },
  {
    id: 'kart_charcoal',
    name: '차콜 카트',
    color: '#4b5058',
    speed: 5,
    handling: 4,
    svgPath: '/public/photos/karts/kart3.png?v=2',
    isCustom: true
  },
  {
    id: 'kart_ivory',
    name: '아이보리 카트',
    color: '#efe9dd',
    speed: 4,
    handling: 4,
    svgPath: '/public/photos/karts/kart4.png?v=2',
    isCustom: true
  }
];

interface KartSelectorProps {
  onKartSelected: (kart: Kart) => void;
  selectedKartId: string;
  setSelectedKartId: (id: string) => void;
}

export default function KartSelector({
  onKartSelected,
  selectedKartId,
  setSelectedKartId
}: KartSelectorProps) {
  const [customKartImg, setCustomKartImg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCustomKartUpload = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setCustomKartImg(dataUrl);
      setSelectedKartId('custom_kart');

      const customKart: Kart = {
        id: 'custom_kart',
        name: '내가 업로드한 자동차',
        color: '#a855f7', // purple style for custom
        speed: 4.5,
        handling: 4.5,
        svgPath: dataUrl,
        isCustom: true
      };
      onKartSelected(customKart);
    };
    reader.readAsDataURL(file);
  };

  const selectKart = (kart: Kart) => {
    setSelectedKartId(kart.id);
    onKartSelected(kart);
  };

  const selectCustomKart = () => {
    if (customKartImg) {
      const customKart: Kart = {
        id: 'custom_kart',
        name: '내가 업로드한 자동차',
        color: '#a855f7',
        speed: 4.5,
        handling: 4.5,
        svgPath: customKartImg,
        isCustom: true
      };
      setSelectedKartId('custom_kart');
      onKartSelected(customKart);
    } else {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 max-w-lg mx-auto" id="kart-selector">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-xl bg-indigo-100 text-indigo-500">
          <Car className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-800 text-lg">2단계: 자동차(카트) 선택하기</h3>
          <p className="text-xs text-slate-400">멋진 레이싱 카트를 고르거나 PC에 있는 나만의 자동차 사진을 올려보세요!</p>
        </div>
      </div>

      {/* Preset Kart Grid */}
      <div className="space-y-3 mb-5">
        {PRESET_KARTS.map((kart) => (
          <button
            key={kart.id}
            id={`kart-btn-${kart.id}`}
            onClick={() => selectKart(kart)}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all relative ${
              selectedKartId === kart.id
                ? 'border-indigo-500 bg-indigo-50/40 shadow-md scale-[1.01]'
                : 'border-slate-100 bg-slate-50 hover:bg-slate-100 hover:border-slate-200'
            }`}
          >
            {/* Visual Icon / Representation of Car */}
            {kart.isCustom && kart.svgPath ? (
              <div className="w-16 h-12 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200 overflow-hidden shadow-sm">
                <img src={kart.svgPath} alt={kart.name} className="w-full h-full object-contain" />
              </div>
            ) : (
              <div
                className="w-16 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow relative overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${kart.color}, ${adjustColorBrightness(kart.color, -30)})`
                }}
              >
                <Car className="w-8 h-8 opacity-90 drop-shadow" />
                {/* Racing Stripe */}
                <div className="absolute inset-0 bg-white/10 skew-x-12 translate-x-3 pointer-events-none" />
              </div>
            )}

            {/* Title & Stats */}
            <div className="flex-1">
              <h4 className="font-semibold text-sm text-slate-800 flex items-center gap-1.5">
                {kart.name}
              </h4>
              <div className="flex gap-4 mt-1">
                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                  <Flame className="w-3 h-3 text-red-500 fill-current" />
                  <span>스피드:</span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full ${
                          i < kart.speed ? 'bg-red-500' : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                  <Shield className="w-3 h-3 text-emerald-500" />
                  <span>코너링:</span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full ${
                          i < kart.handling ? 'bg-emerald-500' : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {selectedKartId === kart.id && (
              <div className="bg-indigo-500 text-white p-1 rounded-full shadow-lg">
                <Check className="w-4 h-4" />
              </div>
            )}
          </button>
        ))}

        {/* Custom Kart Upload Button */}
        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleCustomKartUpload(e.target.files[0]);
              }
            }}
          />

          <button
            id="custom-kart-btn"
            onClick={selectCustomKart}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-dashed text-left transition-all ${
              selectedKartId === 'custom_kart'
                ? 'border-purple-500 bg-purple-50/40 shadow-md'
                : 'border-slate-200 hover:border-purple-400 hover:bg-purple-50/20'
            }`}
          >
            {customKartImg ? (
              <div className="w-16 h-12 rounded-xl bg-purple-100 flex items-center justify-center border border-purple-200 overflow-hidden shadow-sm">
                <img src={customKartImg} alt="Custom Car" className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-16 h-12 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-400">
                <Upload className="w-6 h-6" />
              </div>
            )}

            <div className="flex-1">
              <h4 className="font-semibold text-sm text-slate-800 flex items-center gap-1.5">
                {customKartImg ? '나만의 전용 자동차 사용 중' : '내 컴퓨터에서 자동차 올리기'}
                {!customKartImg && (
                  <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded font-bold">누끼컷 추천</span>
                )}
              </h4>
              <p className="text-[11px] text-slate-400 mt-1">
                {customKartImg ? '클릭하면 다른 자동차 사진으로 변경 가능' : '다운로드 받은 누끼컷 자동차 사진을 업로드해 보세요!'}
              </p>
            </div>

            {selectedKartId === 'custom_kart' && (
              <div className="bg-purple-500 text-white p-1 rounded-full shadow-lg">
                <Check className="w-4 h-4" />
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Utility to darken/lighten a hex color
function adjustColorBrightness(hex: string, percent: number): string {
  let R = parseInt(hex.substring(1, 3), 16);
  let G = parseInt(hex.substring(3, 5), 16);
  let B = parseInt(hex.substring(5, 7), 16);

  R = Math.max(0, Math.min(255, R + percent));
  G = Math.max(0, Math.min(255, G + percent));
  B = Math.max(0, Math.min(255, B + percent));

  const rHex = R.toString(16).padStart(2, '0');
  const gHex = G.toString(16).padStart(2, '0');
  const bHex = B.toString(16).padStart(2, '0');

  return `#${rHex}${gHex}${bHex}`;
}
