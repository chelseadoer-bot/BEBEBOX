import React, { useState, useRef } from 'react';
import { Upload, User, Move, RefreshCw, Sparkles, Smile, Heart, Zap } from 'lucide-react';

// Default cute cartoon baby SVG avatars
export const DEFAULT_BABIES = [
  {
    id: 'baby_boy',
    name: '신난 아기 (파란 모자)',
    bgColor: '#e0f2fe',
    emoji: '👶',
    svgUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%23ffd1b3"/><circle cx="35" cy="45" r="5" fill="%23222"/><circle cx="65" cy="45" r="5" fill="%23222"/><path d="M 40 65 Q 50 75 60 65" stroke="%23ff6666" stroke-width="4" fill="none" stroke-linecap="round"/><ellipse cx="30" cy="52" rx="6" ry="4" fill="%23ff9999" opacity="0.5"/><ellipse cx="70" cy="52" rx="6" ry="4" fill="%23ff9999" opacity="0.5"/><path d="M 15 35 Q 50 10 85 35 Z" fill="%230284c7"/><circle cx="50" cy="20" r="8" fill="%23ffffff"/></svg>'
  },
  {
    id: 'baby_girl',
    name: '러블리 아기 (핑크 리본)',
    bgColor: '#fce7f3',
    emoji: '👧',
    svgUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%23ffe0cc"/><circle cx="35" cy="45" r="5" fill="%23222"/><circle cx="65" cy="45" r="5" fill="%23222"/><path d="M 40 65 Q 50 78 60 65" stroke="%23ff3366" stroke-width="4" fill="none" stroke-linecap="round"/><ellipse cx="28" cy="52" rx="7" ry="4" fill="%23ff80aa" opacity="0.6"/><ellipse cx="72" cy="52" rx="7" ry="4" fill="%23ff80aa" opacity="0.6"/><path d="M 50 15 Q 60 5 70 15 Q 60 25 50 15 Z" fill="%23db2777"/><path d="M 50 15 Q 40 5 30 15 Q 40 25 50 15 Z" fill="%23db2777"/><circle cx="50" cy="15" r="5" fill="%23fbcfe8"/></svg>'
  },
  {
    id: 'baby_cool',
    name: '멋쟁이 아기 (레이서 고글)',
    bgColor: '#fef3c7',
    emoji: '😎',
    svgUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%23ffd1b3"/><path d="M 40 68 Q 50 76 60 68" stroke="%23ff4444" stroke-width="4" fill="none" stroke-linecap="round"/><ellipse cx="30" cy="54" rx="5" ry="3" fill="%23ff8888" opacity="0.6"/><ellipse cx="70" cy="54" rx="5" ry="3" fill="%23ff8888" opacity="0.6"/><path d="M 22 45 Q 50 35 78 45 L 75 52 Q 50 42 25 52 Z" fill="%23334155"/><rect x="25" y="44" width="20" height="10" rx="3" fill="%2338bdf8" opacity="0.9"/><rect x="55" y="44" width="20" height="10" rx="3" fill="%2338bdf8" opacity="0.9"/><rect x="45" y="47" width="10" height="4" fill="%23334155"/></svg>'
  }
];

interface BabyPhotoUploaderProps {
  onPhotoSelected: (imgUrl: string, config: FaceConfig) => void;
  selectedBabyId: string;
  setSelectedBabyId: (id: string) => void;
  profilePhoto?: string | null;
  profileName?: string;
}

export interface FaceConfig {
  scale: number;
  offsetY: number;
  offsetX: number;
  rotation: number;
  hasHelmet: boolean;
}

export default function BabyPhotoUploader({
  onPhotoSelected,
  selectedBabyId,
  setSelectedBabyId,
  profilePhoto,
  profileName
}: BabyPhotoUploaderProps) {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Offset & zoom configuration for positioning the face
  const [scale, setScale] = useState(1.0);
  const [offsetY, setOffsetY] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [hasHelmet, setHasHelmet] = useState(true);

  // 부모에서 프로필 사진이 오면 '우리 아기'를 첫 프리셋으로 노출(기본 라이더)
  const babies = profilePhoto
    ? [{ id: 'profile', name: profileName || '우리 아기', bgColor: '#eef2ff', emoji: '🍼', svgUrl: profilePhoto }, ...DEFAULT_BABIES]
    : DEFAULT_BABIES;

  const handlePhotoUpload = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setUploadedImage(dataUrl);
      setSelectedBabyId('custom');
      
      // Initialize configuration
      const defaultConfig = { scale: 1.0, offsetY: 0, offsetX: 0, rotation: 0, hasHelmet };
      onPhotoSelected(dataUrl, defaultConfig);
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handlePhotoUpload(e.dataTransfer.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const updateConfig = (newScale: number, newOffsetY: number, newOffsetX: number, newRotation: number, newHelmet: boolean) => {
    setScale(newScale);
    setOffsetY(newOffsetY);
    setOffsetX(newOffsetX);
    setRotation(newRotation);
    setHasHelmet(newHelmet);

    const activeUrl = uploadedImage || babies.find(b => b.id === selectedBabyId)?.svgUrl || babies[0].svgUrl;
    onPhotoSelected(activeUrl, {
      scale: newScale,
      offsetY: newOffsetY,
      offsetX: newOffsetX,
      rotation: newRotation,
      hasHelmet: newHelmet
    });
  };

  const selectPresetBaby = (id: string) => {
    setSelectedBabyId(id);
    setUploadedImage(null);
    const preset = babies.find(b => b.id === id);
    if (preset) {
      // Preset babies have nicely balanced proportions, reset sliders
      setScale(1.0);
      setOffsetY(0);
      setOffsetX(0);
      setRotation(0);
      onPhotoSelected(preset.svgUrl, {
        scale: 1.0,
        offsetY: 0,
        offsetX: 0,
        rotation: 0,
        hasHelmet
      });
    }
  };

  const activeImageUrl = uploadedImage || babies.find(b => b.id === selectedBabyId)?.svgUrl || babies[0].svgUrl;

  return (
    <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 max-w-lg mx-auto" id="baby-photo-uploader">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-xl bg-pink-100 text-pink-500">
          <Smile className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-800 text-lg">1단계: 레이서 아기 정하기</h3>
          <p className="text-xs text-slate-400">카트에 탑승할 우리 아기 사진을 넣거나 귀여운 캐릭터를 고르세요!</p>
        </div>
      </div>

      {/* Preset Selectors */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {babies.map((baby) => (
          <button
            key={baby.id}
            id={`preset-${baby.id}`}
            onClick={() => selectPresetBaby(baby.id)}
            className={`flex flex-col items-center p-3 rounded-2xl border-2 transition-all relative ${
              selectedBabyId === baby.id
                ? 'border-pink-500 bg-pink-50/50 scale-102 shadow-md'
                : 'border-slate-100 bg-slate-50 hover:bg-slate-100 hover:border-slate-200'
            }`}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-3xl shadow-inner mb-2"
              style={{ backgroundColor: baby.bgColor }}
            >
              <img src={baby.svgUrl} alt={baby.name} className="w-10 h-10 object-contain rounded-full" />
            </div>
            <span className="text-xs font-medium text-slate-700 text-center line-clamp-1">{baby.name}</span>
            {selectedBabyId === baby.id && (
              <div className="absolute -top-1.5 -right-1.5 bg-pink-500 text-white p-0.5 rounded-full shadow">
                <Heart className="w-3 h-3 fill-current" />
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Upload Zone */}
      <div
        id="drop-zone"
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={triggerFileInput}
        className={`relative border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all ${
          dragActive
            ? 'border-pink-500 bg-pink-50'
            : uploadedImage
            ? 'border-slate-300 bg-slate-50'
            : 'border-slate-200 hover:border-pink-400 hover:bg-slate-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handlePhotoUpload(e.target.files[0]);
            }
          }}
        />

        {uploadedImage ? (
          <div className="flex flex-col items-center w-full">
            <div className="relative w-28 h-28 mb-3 rounded-full overflow-hidden border-4 border-pink-500 shadow-lg flex items-center justify-center bg-white">
              <div 
                className="w-full h-full transition-transform" 
                style={{
                  transform: `scale(${scale}) translate(${offsetX}px, ${offsetY}px) rotate(${rotation}deg)`,
                  backgroundImage: `url(${uploadedImage})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              {/* Optional helmet mask overlay on preview */}
              {hasHelmet && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-start pt-1">
                  <div className="bg-red-500/80 text-[10px] text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider scale-90 border border-white">
                    Rider
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs font-semibold text-pink-500 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> 내 아기 사진 업로드 완료!
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">클릭하거나 다른 파일을 끌어다 놓으면 변경됩니다.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="p-3 bg-slate-100 rounded-full text-slate-500 mb-2 group-hover:bg-pink-100 group-hover:text-pink-500 transition-colors">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">여기에 진짜 우리 아기 사진 넣기</p>
            <p className="text-xs text-slate-400 mt-1">파일 선택 또는 드래그 & 드롭 (얼굴 위주 사진 권장)</p>
          </div>
        )}
      </div>

      {/* Adjusters (Shown for both custom and preset, but highly recommended for custom) */}
      <div className="mt-5 space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-100" id="face-adjust-panel">
        <div className="flex justify-between items-center">
          <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
            <Move className="w-3.5 h-3.5" /> 머리 크기 및 위치 조정
          </span>
          <button
            onClick={() => updateConfig(1.0, 0, 0, 0, hasHelmet)}
            className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> 초기화
          </button>
        </div>

        {/* Scale Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-slate-500">
            <span>크기 조절 (Zoom)</span>
            <span className="font-semibold text-slate-700">{scale.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.5"
            step="0.05"
            value={scale}
            onChange={(e) => updateConfig(parseFloat(e.target.value), offsetY, offsetX, rotation, hasHelmet)}
            className="w-full accent-pink-500 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
          />
        </div>

        {/* Offset X / Y Sliders */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>상하 이동</span>
              <span className="font-semibold text-slate-700">{offsetY > 0 ? `+${offsetY}` : offsetY}px</span>
            </div>
            <input
              type="range"
              min="-40"
              max="40"
              step="1"
              value={offsetY}
              onChange={(e) => updateConfig(scale, parseInt(e.target.value), offsetX, rotation, hasHelmet)}
              className="w-full accent-pink-500 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>좌우 이동</span>
              <span className="font-semibold text-slate-700">{offsetX > 0 ? `+${offsetX}` : offsetX}px</span>
            </div>
            <input
              type="range"
              min="-40"
              max="40"
              step="1"
              value={offsetX}
              onChange={(e) => updateConfig(scale, offsetY, parseInt(e.target.value), rotation, hasHelmet)}
              className="w-full accent-pink-500 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
          </div>
        </div>

        {/* Tilt / Rotation Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-slate-500">
            <span>회전 기울기 (Tilt)</span>
            <span className="font-semibold text-slate-700">{rotation}°</span>
          </div>
          <input
            type="range"
            min="-90"
            max="90"
            step="5"
            value={rotation}
            onChange={(e) => updateConfig(scale, offsetY, offsetX, parseInt(e.target.value), hasHelmet)}
            className="w-full accent-pink-500 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
          />
        </div>

        {/* Helmet Toggle */}
        <label className="flex items-center gap-2 cursor-pointer pt-1 border-t border-slate-200/50 mt-1">
          <input
            type="checkbox"
            checked={hasHelmet}
            onChange={(e) => updateConfig(scale, offsetY, offsetX, rotation, e.target.checked)}
            className="rounded border-slate-300 text-pink-500 focus:ring-pink-500 w-4 h-4"
          />
          <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-yellow-500 fill-current" /> 안전 레이서 헬멧 씌우기
          </span>
        </label>
      </div>
    </div>
  );
}
