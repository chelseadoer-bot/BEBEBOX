export interface Kart {
  id: string;
  name: string;
  color: string;
  speed: number; // Max speed multiplier
  handling: number; // Handling multiplier
  svgPath: string; // SVG representation or custom image data URI
  isCustom?: boolean;
}

export interface HighScore {
  name: string;
  score: number;
  date: string;
  kartName: string;
  distance: number;
}

export interface Obstacle {
  id: number;
  x: number;
  y: number;
  type: 'banana' | 'cone' | 'barrier';
  width: number;
  height: number;
  speedY: number;
  passed: boolean;
}

export interface Collectible {
  id: number;
  x: number;
  y: number;
  type: 'coin' | 'star' | 'shield';
  width: number;
  height: number;
  speedY: number;
  collected: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
  decay: number;
}
