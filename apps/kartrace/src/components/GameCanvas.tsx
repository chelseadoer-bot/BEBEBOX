import React, { useEffect, useRef, useState } from 'react';
import { soundManager } from '../utils/audio';
import { Kart, Obstacle, Collectible, Particle } from '../types';
import { Volume2, VolumeX, ArrowLeft, RotateCcw, Zap, Play, Award, Smartphone } from 'lucide-react';
import { FaceConfig } from './BabyPhotoUploader';

interface GameCanvasProps {
  kart: Kart;
  babyPhotoUrl: string;
  faceConfig: FaceConfig;
  onGameEnd: (score: number, distance: number, coins: number) => void;
  onExit: () => void;
}

export default function GameCanvas({
  kart,
  babyPhotoUrl,
  faceConfig,
  onGameEnd,
  onExit
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Core Game State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdownNum, setCountdownNum] = useState<string | number>('3');
  const [isMuted, setIsMuted] = useState(soundManager.getMuteState());
  const [showControlsHint, setShowControlsHint] = useState(true);

  // Refs for game variables to prevent closure stale states in requestAnimationFrame loop
  const gameStateRef = useRef({
    score: 0,
    distance: 0, // In meters (goal: 1000m)
    coins: 0,
    speed: 0, // current speed in pixels/frame
    maxSpeed: 12, // regular max speed
    targetSpeed: 0,
    acceleration: 0.15,
    deceleration: 0.08,
    isBoosterActive: false,
    boosterTimer: 0,
    isShieldActive: false,
    isInvincible: false,
    invincibleTimer: 0,
    
    // Player positioning
    playerX: 240, // Middle of 480px width
    playerY: 480, // Near bottom of 640px height
    playerWidth: 88,
    playerHeight: 116,
    playerAngle: 0, // for spin animations
    spinTimer: 0,
    steerDirection: 0, // -1: left, 1: right

    // Road scrolling offset
    roadOffsetY: 0,
    
    // Arrays for active elements
    obstacles: [] as Obstacle[],
    collectibles: [] as Collectible[],
    particles: [] as Particle[],
    floatingTexts: [] as { x: number; y: number; text: string; color: string; alpha: number; life: number }[],
    
    // Timers
    timeLeft: 60, // 60 seconds
    spawnTimer: 0,
    
    // Visual indicators
    screenShake: 0,
    finishLineY: -9999, // Starts far off
    gameFinished: false,
    gameFailed: false,
  });

  // Preloaded Images
  const babyImageRef = useRef<HTMLImageElement | null>(null);
  const customKartImageRef = useRef<HTMLImageElement | null>(null);
  const imagesLoadedRef = useRef({ baby: false, kart: false });

  // Key tracking
  const keysRef = useRef<{ [key: string]: boolean }>({});

  // Mobile controller touches
  const [isPressingLeft, setIsPressingLeft] = useState(false);
  const [isPressingRight, setIsPressingRight] = useState(false);
  const [isPressingBoost, setIsPressingBoost] = useState(false);

  // Initialize and preload assets
  useEffect(() => {
    // Load Baby Image
    const babyImg = new Image();
    babyImg.src = babyPhotoUrl;
    babyImg.onload = () => {
      babyImageRef.current = babyImg;
      imagesLoadedRef.current.baby = true;
    };

    // Load Custom Kart Image if applicable
    if (kart.isCustom && kart.svgPath) {
      const kartImg = new Image();
      kartImg.src = kart.svgPath;
      kartImg.onload = () => {
        customKartImageRef.current = kartImg;
        imagesLoadedRef.current.kart = true;
      };
    } else {
      imagesLoadedRef.current.kart = true;
    }

    // Set mute state from manager
    setIsMuted(soundManager.getMuteState());

    // Clean up
    return () => {
      soundManager.stopEngine();
    };
  }, [kart, babyPhotoUrl]);

  // Audio mute toggling
  const toggleMuted = () => {
    const nextMute = soundManager.toggleMute();
    setIsMuted(nextMute);
  };

  // Keyboard Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key] = true;
      if (e.key === ' ' || e.key === 'Spacebar') {
        // Spacebar nitro boost trigger
        e.preventDefault();
        triggerNitroBoost();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const triggerNitroBoost = () => {
    const state = gameStateRef.current;
    if (state.isBoosterActive || state.spinTimer > 0 || state.gameFinished || state.gameFailed) return;

    // Use boost if we collected coins or just want to allow a free charge boost!
    // To make the game incredibly fun, we'll allow an occasional boost, or give it when picking up Stars!
    // If we pick up stars we activate nitro automatically. Let's spawn stars and make them glorious!
  };

  // Start the 3-2-1 Countdown
  const startCountdown = () => {
    setIsCountingDown(true);
    setIsPlaying(false);
    setCountdownNum(3);
    soundManager.playChime(false);

    let count = 3;
    const interval = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdownNum(count);
        soundManager.playChime(false);
      } else if (count === 0) {
        setCountdownNum('START!');
        soundManager.playChime(true);
      } else {
        clearInterval(interval);
        setIsCountingDown(false);
        startGameLoop();
      }
    }, 900);
  };

  // Actual Game Loop Trigger
  const startGameLoop = () => {
    setIsPlaying(true);
    
    // Reset Game State Ref
    const state = gameStateRef.current;
    state.score = 0;
    state.distance = 0;
    state.coins = 0;
    state.speed = 0;
    state.targetSpeed = 6; // starts moving
    state.isBoosterActive = false;
    state.boosterTimer = 0;
    state.isShieldActive = false;
    state.isInvincible = false;
    state.invincibleTimer = 0;
    state.playerX = 240;
    state.playerY = 480;
    state.playerAngle = 0;
    state.spinTimer = 0;
    state.obstacles = [];
    state.collectibles = [];
    state.particles = [];
    state.floatingTexts = [];
    state.timeLeft = 60;
    state.spawnTimer = 0;
    state.screenShake = 0;
    state.finishLineY = -9999; // Represents crossing the finish line at 1000m
    state.gameFinished = false;
    state.gameFailed = false;

    soundManager.startEngine();
  };

  // Run countdown on mount or reset
  useEffect(() => {
    startCountdown();
    return () => {
      soundManager.stopEngine();
    };
  }, []);

  // Frame rendering and logic loop
  useEffect(() => {
    let animationId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      if (!canvasRef.current) {
        animationId = requestAnimationFrame(loop);
        return;
      }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const delta = (time - lastTime) / 1000;
      lastTime = time;

      if (isPlaying) {
        updateGameLogic(delta);
      }
      
      renderGame(ctx);

      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, isMuted, faceConfig, kart]);

  // Game Logic Updates
  const updateGameLogic = (delta: number) => {
    const state = gameStateRef.current;

    // 1. Time Limit Tick (60 seconds)
    if (!state.gameFinished && !state.gameFailed) {
      state.timeLeft -= delta;
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        // Check if finished or failed
        if (state.distance >= 1000) {
          triggerWin();
        } else {
          triggerFail();
        }
      }
    }

    // 2. Adjust Steer Direction from Keyboard & Mobile touch
    let inputSteer = 0;
    if (keysRef.current['ArrowLeft'] || keysRef.current['a'] || keysRef.current['A'] || isPressingLeft) {
      inputSteer = -1;
    } else if (keysRef.current['ArrowRight'] || keysRef.current['d'] || keysRef.current['D'] || isPressingRight) {
      inputSteer = 1;
    }
    state.steerDirection = inputSteer;

    // 3. Handle Spin/Stun state from hitting a banana
    if (state.spinTimer > 0) {
      state.spinTimer -= delta * 1000;
      state.playerAngle += 0.25; // spin!
      state.targetSpeed = 2; // slow drift
      if (state.spinTimer <= 0) {
        state.spinTimer = 0;
        state.playerAngle = 0;
      }
    } else {
      // Normal movement handling
      state.playerAngle = state.steerDirection * 0.08; // subtle tilting when turning

      // Accelerate / Decelerate
      let maxSpeedLimit = state.maxSpeed * (1 + (kart.speed - 3) * 0.1); // scaling based on speed stat
      if (state.isBoosterActive) {
        maxSpeedLimit = 20; // nitro mode super speed
        state.boosterTimer -= delta * 1000;
        if (state.boosterTimer <= 0) {
          state.isBoosterActive = false;
          state.isInvincible = false;
        }
      }

      // Invincibility flicker timer
      if (state.isInvincible && !state.isBoosterActive) {
        state.invincibleTimer -= delta * 1000;
        if (state.invincibleTimer <= 0) {
          state.isInvincible = false;
        }
      }

      // Steer speed
      const steerSpeed = 6 * (1 + (kart.handling - 3) * 0.12);
      state.playerX += state.steerDirection * steerSpeed;
      // Keep player strictly inside the road limits (road is between X: 80 and X: 400)
      if (state.playerX < 112) state.playerX = 112;
      if (state.playerX > 368) state.playerX = 368;

      // Accelerate towards maximum speed
      state.targetSpeed = maxSpeedLimit;
    }

    // Apply speed transitions
    if (state.speed < state.targetSpeed) {
      state.speed += state.acceleration;
    } else if (state.speed > state.targetSpeed) {
      state.speed -= state.deceleration;
    }

    // Update sound manager engine tone
    const speedRatio = state.speed / 20; // scale against 20 max speed
    soundManager.updateEngine(speedRatio, state.isBoosterActive);

    // 4. Update Distance and Score
    if (!state.gameFinished && !state.gameFailed) {
      state.distance += (state.speed * delta * 4); // distance multiplier
      state.score += Math.round(state.speed * delta * 2.5);

      // Check for finish line appearance at 1000m
      if (state.distance >= 1000 && state.finishLineY === -9999) {
        state.finishLineY = -100; // spawn finish line at the top
      }
    }

    // 5. Update Finish Line descending
    if (state.finishLineY !== -9999 && !state.gameFinished) {
      state.finishLineY += state.speed;
      if (state.finishLineY >= state.playerY - 20) {
        triggerWin();
      }
    }

    // 6. Shake Decay
    if (state.screenShake > 0) {
      state.screenShake -= 0.5;
    }

    // 7. Update Road Offset for scrolling road effect
    state.roadOffsetY = (state.roadOffsetY + state.speed) % 80;

    // 8. Spawn Obstacles and Collectibles
    state.spawnTimer += delta * 1000;
    // Spawn every 1.5 seconds if speed is moving
    if (state.spawnTimer > 1200 && state.speed > 1 && state.finishLineY === -9999 && !state.gameFinished && !state.gameFailed) {
      state.spawnTimer = 0;
      spawnEntity();
    }

    // 9. Update Particles
    state.particles.forEach((p, index) => {
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      if (p.alpha <= 0) {
        state.particles.splice(index, 1);
      }
    });

    // 10. Floating text decay
    state.floatingTexts.forEach((ft, index) => {
      ft.y -= 1; // drift up
      ft.life -= delta;
      ft.alpha = Math.max(0, ft.life);
      if (ft.life <= 0) {
        state.floatingTexts.splice(index, 1);
      }
    });

    // 11. Update active Obstacles
    state.obstacles.forEach((obs, index) => {
      obs.y += state.speed; // moves relative to background scrolling speed
      
      // Collision check with Player Kart
      if (!obs.passed && !state.gameFinished && !state.gameFailed) {
        const isColliding = checkRectCollision(
          state.playerX - state.playerWidth / 2,
          state.playerY - state.playerHeight / 2,
          state.playerWidth,
          state.playerHeight,
          obs.x,
          obs.y,
          obs.width,
          obs.height
        );

        if (isColliding) {
          obs.passed = true;
          handleObstacleCollision(obs);
        }
      }

      // Remove off-screen obstacles
      if (obs.y > 680) {
        state.obstacles.splice(index, 1);
      }
    });

    // 12. Update active Collectibles
    state.collectibles.forEach((col, index) => {
      col.y += state.speed;

      // Collision check
      if (!col.collected && !state.gameFinished && !state.gameFailed) {
        const isColliding = checkRectCollision(
          state.playerX - state.playerWidth / 2,
          state.playerY - state.playerHeight / 2,
          state.playerWidth,
          state.playerHeight,
          col.x,
          col.y,
          col.width,
          col.height
        );

        if (isColliding) {
          col.collected = true;
          handleCollectibleCollision(col);
          state.collectibles.splice(index, 1);
        }
      }

      // Remove offscreen
      if (col.y > 680) {
        state.collectibles.splice(index, 1);
      }
    });

    // 13. Spawn Sparkles from booster
    if (state.isBoosterActive && Math.random() < 0.4) {
      spawnBoosterParticles(state.playerX, state.playerY + state.playerHeight/2);
    }
  };

  // Helper Rect Collision
  const checkRectCollision = (x1: number, y1: number, w1: number, h1: number, x2: number, y2: number, w2: number, h2: number) => {
    // Add slightly generous hitbox padding for fun gameplay!
    // 카트를 크게 키운 만큼 여유 패딩도 키워 난이도 유지
    const padding = 16;
    return (
      x1 + padding < x2 + w2 - padding &&
      x1 + w1 - padding > x2 + padding &&
      y1 + padding < y2 + h2 - padding &&
      y1 + h1 - padding > y2 + padding
    );
  };

  // Spawn obstacles or items in random lanes
  const spawnEntity = () => {
    const state = gameStateRef.current;
    
    // Pick a lane: 1, 2, or 3
    // Lane 1 X: 140, Lane 2 X: 240, Lane 3 X: 340
    const lanes = [135, 240, 345];
    const targetLaneX = lanes[Math.floor(Math.random() * lanes.length)] + (Math.random() * 20 - 10);

    // Roll to spawn an obstacle (60% chance) vs collectible (40% chance)
    if (Math.random() < 0.55) {
      // Obstacle
      const types: ('banana' | 'cone' | 'barrier')[] = ['banana', 'cone', 'barrier'];
      const chosenType = types[Math.floor(Math.random() * types.length)];
      
      let width = 32;
      let height = 32;
      if (chosenType === 'barrier') {
        width = 44;
        height = 24;
      }

      state.obstacles.push({
        id: Date.now() + Math.random(),
        x: targetLaneX - width / 2,
        y: -50,
        type: chosenType,
        width,
        height,
        speedY: 0,
        passed: false
      });
    } else {
      // Collectible
      const roll = Math.random();
      let chosenType: 'coin' | 'star' | 'shield' = 'coin';
      
      if (roll < 0.70) {
        chosenType = 'coin'; // high chance
      } else if (roll < 0.88) {
        chosenType = 'star'; // nitro boost!
      } else {
        chosenType = 'shield'; // protection shield
      }

      state.collectibles.push({
        id: Date.now() + Math.random(),
        x: targetLaneX - 15,
        y: -50,
        type: chosenType,
        width: 30,
        height: 30,
        speedY: 0,
        collected: false
      });
    }
  };

  // Handle Obstacle Impact
  const handleObstacleCollision = (obs: Obstacle) => {
    const state = gameStateRef.current;

    // 1. If booster / nitro active, we smash through it and get points!
    if (state.isBoosterActive || state.isInvincible) {
      soundManager.playCrash();
      spawnExplosion(obs.x + obs.width / 2, obs.y + obs.height / 2, '#fb923c');
      state.score += 200;
      addFloatingText(obs.x, obs.y - 10, 'SMASH! +200', '#f97316');
      state.screenShake = 6;
      return;
    }

    // 2. If shield active, absorb the impact
    if (state.isShieldActive) {
      state.isShieldActive = false;
      soundManager.playCrash();
      spawnExplosion(obs.x + obs.width / 2, obs.y + obs.height / 2, '#38bdf8');
      addFloatingText(obs.x, obs.y - 10, 'SHIELD BROKEN!', '#38bdf8');
      state.screenShake = 8;
      // Brief invincibility to prevent instant re-crash
      state.isInvincible = true;
      state.invincibleTimer = 1000;
      return;
    }

    // 3. Normal hit penalty
    soundManager.playCrash();
    state.screenShake = 15;

    if (obs.type === 'banana') {
      // Banana causes spin
      state.spinTimer = 1200; // 1.2s spin stun
      spawnExplosion(obs.x + obs.width / 2, obs.y + obs.height / 2, '#eab308');
      addFloatingText(state.playerX, state.playerY - 40, '미끄러짐! SPIN', '#eab308');
      state.score = Math.max(0, state.score - 150);
    } else {
      // Obstacle/Cone causes crash stop
      state.speed = 1.5; // crash brake
      spawnExplosion(obs.x + obs.width / 2, obs.y + obs.height / 2, '#ef4444');
      addFloatingText(state.playerX, state.playerY - 40, '꽝! CRASH', '#ef4444');
      state.score = Math.max(0, state.score - 200);
      // Give invincibility briefly so you don't keep crashing while recovering
      state.isInvincible = true;
      state.invincibleTimer = 1500;
    }
  };

  // Handle item collected
  const handleCollectibleCollision = (col: Collectible) => {
    const state = gameStateRef.current;

    if (col.type === 'coin') {
      soundManager.playCoin();
      state.coins += 1;
      state.score += 300;
      addFloatingText(col.x, col.y - 10, '+300 COIN', '#fbbf24');
      spawnCoinParticles(col.x + 15, col.y + 15);
    } else if (col.type === 'star') {
      soundManager.playBoost();
      state.isBoosterActive = true;
      state.isInvincible = true;
      state.boosterTimer = 4000; // 4 seconds of NITRO!
      state.score += 500;
      addFloatingText(state.playerX, state.playerY - 40, '초특급 부스터!!! NITRO', '#a855f7');
      spawnExplosion(col.x + 15, col.y + 15, '#a855f7');
    } else if (col.type === 'shield') {
      soundManager.playCoin();
      state.isShieldActive = true;
      addFloatingText(col.x, col.y - 10, '보호막 장착! SHIELD', '#38bdf8');
      spawnExplosion(col.x + 15, col.y + 15, '#38bdf8');
    }
  };

  // Win trigger
  const triggerWin = () => {
    const state = gameStateRef.current;
    if (state.gameFinished || state.gameFailed) return;
    state.gameFinished = true;
    soundManager.stopEngine();
    setTimeout(() => {
      onGameEnd(state.score + Math.round(state.timeLeft * 500), Math.round(state.distance), state.coins);
    }, 1500);
  };

  // Fail trigger
  const triggerFail = () => {
    const state = gameStateRef.current;
    if (state.gameFinished || state.gameFailed) return;
    state.gameFailed = true;
    soundManager.stopEngine();
    setTimeout(() => {
      onGameEnd(state.score, Math.round(state.distance), state.coins);
    }, 1500);
  };

  // Text popup helpers
  const addFloatingText = (x: number, y: number, text: string, color: string) => {
    gameStateRef.current.floatingTexts.push({
      x,
      y,
      text,
      color,
      alpha: 1.0,
      life: 1.2
    });
  };

  // Sparkles
  const spawnExplosion = (x: number, y: number, color: string) => {
    const state = gameStateRef.current;
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 2;
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        alpha: 1.0,
        size: Math.random() * 5 + 3,
        decay: Math.random() * 0.04 + 0.02
      });
    }
  };

  const spawnCoinParticles = (x: number, y: number) => {
    const state = gameStateRef.current;
    for (let i = 0; i < 8; i++) {
      state.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4 - 3,
        color: '#facc15',
        alpha: 1.0,
        size: Math.random() * 4 + 2,
        decay: 0.04
      });
    }
  };

  const spawnBoosterParticles = (x: number, y: number) => {
    const state = gameStateRef.current;
    // Rainbow colors for nitro booster fire
    const colors = ['#f43f5e', '#ef4444', '#ec4899', '#a855f7', '#3b82f6', '#06b6d4'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    state.particles.push({
      x: x + (Math.random() - 0.5) * 20,
      y,
      vx: (Math.random() - 0.5) * 2,
      vy: Math.random() * 3 + 4, // flame flows backward
      color: randomColor,
      alpha: 1.0,
      size: Math.random() * 8 + 4,
      decay: 0.05
    });
  };

  // Render everything to Canvas
  const renderGame = (ctx: CanvasRenderingContext2D) => {
    const state = gameStateRef.current;
    const canvas = canvasRef.current!;

    ctx.save();
    
    // Screenshake effect
    if (state.screenShake > 0) {
      const dx = (Math.random() - 0.5) * state.screenShake;
      const dy = (Math.random() - 0.5) * state.screenShake;
      ctx.translate(dx, dy);
    }

    // 1. Draw Grass / Backdrop
    ctx.fillStyle = '#22c55e'; // default green grass
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Parallax trees or track stripes on sides
    ctx.fillStyle = '#16a34a'; // darker green stripes for scrolling
    const stripeSize = 80;
    const scrollOffset = state.roadOffsetY;
    
    for (let y = -stripeSize; y < canvas.height + stripeSize; y += stripeSize) {
      ctx.fillRect(0, y + scrollOffset, 80, stripeSize / 2);
      ctx.fillRect(canvas.width - 80, y + scrollOffset, 80, stripeSize / 2);
    }

    // 2. Draw Side Curbs / Red-White Kerb (retro arcade style!)
    const kerbWidth = 10;
    for (let y = -stripeSize; y < canvas.height + stripeSize; y += stripeSize) {
      const isRed = (Math.floor((y + scrollOffset) / stripeSize) % 2 === 0);
      ctx.fillStyle = isRed ? '#ef4444' : '#ffffff';
      
      // Left Curb
      ctx.fillRect(75, y + scrollOffset, kerbWidth, stripeSize);
      // Right Curb
      ctx.fillRect(395, y + scrollOffset, kerbWidth, stripeSize);
    }

    // 3. Draw Road Asphalt
    ctx.fillStyle = '#475569'; // slate grey road
    ctx.fillRect(85, 0, 310, canvas.height);

    // 4. Draw Lanes divider lines (scrolling)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.setLineDash([30, 30]);
    ctx.beginPath();
    // Lane 1 divider (around X: 190)
    ctx.moveTo(190, -80 + scrollOffset);
    ctx.lineTo(190, canvas.height + 80);
    // Lane 2 divider (around X: 290)
    ctx.moveTo(290, -80 + scrollOffset);
    ctx.lineTo(290, canvas.height + 80);
    ctx.stroke();
    ctx.setLineDash([]); // reset

    // 5. Draw roadside decorative elements (flowers, spectator stands, trees)
    // Draw simple trees
    for (let y = -120; y < canvas.height + 120; y += 160) {
      const currentY = y + scrollOffset;
      // Left side tree
      drawTree(ctx, 35, currentY);
      // Right side tree
      drawTree(ctx, canvas.width - 35, currentY + 80);
    }

    // 6. Draw Finish Line if active
    if (state.finishLineY !== -9999) {
      drawFinishLine(ctx, state.finishLineY);
    }

    // 7. Draw Obstacles
    state.obstacles.forEach((obs) => {
      drawObstacle(ctx, obs);
    });

    // 8. Draw Collectibles
    state.collectibles.forEach((col) => {
      drawCollectible(ctx, col);
    });

    // 9. Draw Booster / Nitro Speedlines overlay (if in nitro mode)
    if (state.isBoosterActive) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 20; i++) {
        const lx = Math.random() * canvas.width;
        const ly = Math.random() * canvas.height;
        const lLength = Math.random() * 80 + 40;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx, ly + lLength);
        ctx.stroke();
      }
    }

    // 10. Draw Particles
    state.particles.forEach((p) => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 11. Draw Player Kart & Baby Head
    ctx.save();
    ctx.translate(state.playerX, state.playerY);
    ctx.rotate(state.playerAngle);

    // If player is hit & flickering (invincible but not boost)
    let drawPlayer = true;
    if (state.isInvincible && !state.isBoosterActive) {
      // Flicker every 4 frames
      drawPlayer = Math.floor(Date.now() / 60) % 2 === 0;
    }

    if (drawPlayer) {
      // Render exhaust fire if booster is active
      if (state.isBoosterActive) {
        ctx.fillStyle = '#ff7c1e';
        const flameOffset = Math.sin(Date.now() * 0.05) * 5;
        // Draw left flame
        ctx.beginPath();
        ctx.moveTo(-16, state.playerHeight / 2);
        ctx.lineTo(-26, state.playerHeight / 2 + 25 + flameOffset);
        ctx.lineTo(-6, state.playerHeight / 2);
        ctx.closePath();
        ctx.fill();

        // Draw right flame
        ctx.beginPath();
        ctx.moveTo(6, state.playerHeight / 2);
        ctx.lineTo(16, state.playerHeight / 2 + 25 + flameOffset);
        ctx.lineTo(26, state.playerHeight / 2);
        ctx.closePath();
        ctx.fill();

        // Bright yellow core
        ctx.fillStyle = '#ffeb3b';
        ctx.beginPath();
        ctx.moveTo(-14, state.playerHeight / 2);
        ctx.lineTo(-20, state.playerHeight / 2 + 15 + flameOffset * 0.6);
        ctx.lineTo(-8, state.playerHeight / 2);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(8, state.playerHeight / 2);
        ctx.lineTo(14, state.playerHeight / 2 + 15 + flameOffset * 0.6);
        ctx.lineTo(20, state.playerHeight / 2);
        ctx.closePath();
        ctx.fill();
      }

      // Draw Kart Body
      if (kart.isCustom && customKartImageRef.current && imagesLoadedRef.current.kart) {
        // Draw uploaded custom car
        ctx.drawImage(
          customKartImageRef.current,
          -state.playerWidth / 2,
          -state.playerHeight / 2,
          state.playerWidth,
          state.playerHeight
        );
      } else {
        // Draw beautiful built-in vector karts based on color style
        drawPresetKart(ctx, -state.playerWidth / 2, -state.playerHeight / 2, state.playerWidth, state.playerHeight, kart.color);
      }

      // Draw Bubble Shield if active
      if (state.isShieldActive) {
        ctx.save();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 12;
        ctx.globalAlpha = 0.6 + Math.sin(Date.now() * 0.01) * 0.2;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(state.playerWidth, state.playerHeight) / 1.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Draw Baby Head precisely on driver's seat
      // Driver seat is typically positioned 35% down from the front of the car
      const headX = 0 + (faceConfig.offsetX || 0) * 0.35;
      const headY = -state.playerHeight * 0.18 + (faceConfig.offsetY || 0) * 0.35;
      const headRadius = 26 * (faceConfig.scale || 1.0);

      ctx.save();
      ctx.translate(headX, headY);
      ctx.rotate((faceConfig.rotation || 0) * Math.PI / 180);

      // Baby image rendering (cropped circle)
      if (babyImageRef.current && imagesLoadedRef.current.baby) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, headRadius, 0, Math.PI * 2);
        ctx.clip();
        
        ctx.drawImage(
          babyImageRef.current,
          -headRadius,
          -headRadius,
          headRadius * 2,
          headRadius * 2
        );
        ctx.restore();
      } else {
        // Fallback placeholder baby smiley face
        ctx.fillStyle = '#ffedd5';
        ctx.beginPath();
        ctx.arc(0, 0, headRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Eyes
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(-headRadius * 0.35, -headRadius * 0.1, headRadius * 0.1, 0, Math.PI * 2);
        ctx.arc(headRadius * 0.35, -headRadius * 0.1, headRadius * 0.1, 0, Math.PI * 2);
        ctx.fill();
        // Smile
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, headRadius * 0.15, headRadius * 0.4, 0, Math.PI);
        ctx.stroke();
      }

      // Draw cute Tiny Racing Helmet overlay
      if (faceConfig.hasHelmet) {
        ctx.fillStyle = '#ef4444'; // default racing red helmet
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        
        // Helmet top cap
        ctx.beginPath();
        ctx.arc(0, -headRadius * 0.1, headRadius * 1.05, Math.PI, 0); // top semicircle
        ctx.lineTo(headRadius * 1.05, -headRadius * 0.1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Helmet visors / goggles details
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)'; // dark visor
        ctx.beginPath();
        ctx.roundRect(-headRadius * 0.8, -headRadius * 0.6, headRadius * 1.6, headRadius * 0.45, headRadius * 0.15);
        ctx.fill();
        ctx.strokeStyle = '#38bdf8'; // neon blue reflection glow
        ctx.stroke();

        // Visor reflection gloss
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.beginPath();
        ctx.ellipse(-headRadius * 0.2, -headRadius * 0.45, headRadius * 0.4, headRadius * 0.08, Math.PI / 12, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore(); // head transform
    }

    ctx.restore(); // player transform

    // 12. Draw Floating text overlays
    state.floatingTexts.forEach((ft) => {
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.fillStyle = ft.color;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      
      // text shadow
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });

    ctx.restore(); // screenshake transform

    // 13. UI dashboard directly on top of canvas (clean, minimal)
    drawMiniDashboard(ctx, canvas);
  };

  // Preset car vector drawer
  const drawPresetKart = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;

    // 1. Draw Tires
    ctx.fillStyle = '#1e293b';
    ctx.shadowBlur = 0; // turn off shadow for parts
    ctx.shadowOffsetY = 0;
    // Front wheels
    ctx.fillRect(x - 4, y + 10, 8, 14);
    ctx.fillRect(x + w - 4, y + 10, 8, 14);
    // Rear wheels (thicker, bigger tire treads)
    ctx.fillRect(x - 6, y + h - 25, 10, 18);
    ctx.fillRect(x + w - 4, y + h - 25, 10, 18);

    // Wheel axle connections
    ctx.fillStyle = '#64748b';
    ctx.fillRect(x, y + 16, w, 2);
    ctx.fillRect(x, y + h - 16, w, 2);

    // 2. Spoiler (Wing) at back
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x - 8, y + h - 6, w + 16, 5); // Spoiler board
    ctx.fillStyle = color;
    ctx.fillRect(x - 8, y + h - 10, 6, 4); // left tip
    ctx.fillRect(x + w + 2, y + h - 10, 6, 4); // right tip

    // 3. Fenders & Side Pods
    ctx.fillStyle = '#334155';
    ctx.fillRect(x + 2, y + 25, w - 4, h - 38);

    // 4. Main Aerodynamic Nose Cone & Bonnet
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y); // tip of nose
    ctx.quadraticCurveTo(x + w - 6, y + 10, x + w - 4, y + 30);
    ctx.lineTo(x + 4, y + 30);
    ctx.quadraticCurveTo(x + 6, y + 10, x + w / 2, y);
    ctx.closePath();
    ctx.fill();

    // 5. Main cockpit chassis pod
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 24, w - 8, h - 35, 10);
    ctx.fill();

    // Racing stripe on center
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + w / 2 - 3, y + 4, 6, 32);

    // 6. Windshield / visor
    ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 30);
    ctx.lineTo(x + w - 8, y + 30);
    ctx.lineTo(x + w - 12, y + 23);
    ctx.lineTo(x + 12, y + 23);
    ctx.closePath();
    ctx.fill();

    // 7. Small Steering Wheel
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + 33, 5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  };

  // Tree Vector Drawer on side grass
  const drawTree = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.save();
    
    // Trunk
    ctx.fillStyle = '#78350f';
    ctx.fillRect(x - 4, y + 15, 8, 20);

    // Leaves layers
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.arc(x, y + 10, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#166534';
    ctx.beginPath();
    ctx.arc(x - 8, y + 2, 12, 0, Math.PI * 2);
    ctx.arc(x + 8, y + 2, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#22c55e'; // Highlight top leaves
    ctx.beginPath();
    ctx.arc(x, y - 6, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // Draw Checkered Finish Line
  const drawFinishLine = (ctx: CanvasRenderingContext2D, y: number) => {
    ctx.save();
    const cellW = 15;
    const cellH = 10;
    const roadWidth = 310;
    const roadStartX = 85;

    // Draw two rows of checkerboard
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < roadWidth / cellW + 1; col++) {
        const isWhite = (row + col) % 2 === 0;
        ctx.fillStyle = isWhite ? '#ffffff' : '#000000';
        ctx.fillRect(roadStartX + col * cellW, y + row * cellH, cellW, cellH);
      }
    }
    
    // Banner "FINISH"
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(85, y - 25, 310, 20);
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏆  F I N I S H  🏆', 240, y - 11);

    ctx.restore();
  };

  // Draw obstacles vectors on road
  const drawObstacle = (ctx: CanvasRenderingContext2D, obs: Obstacle) => {
    ctx.save();

    if (obs.type === 'banana') {
      // Banana Peel Vector
      ctx.translate(obs.x + obs.width / 2, obs.y + obs.height / 2);
      ctx.rotate(Math.sin(Date.now() * 0.01) * 0.2); // slight wiggle
      
      // Yellow peel skin
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#ca8a04';
      ctx.lineWidth = 1.5;

      // Draw center peel
      ctx.beginPath();
      ctx.ellipse(0, 0, 7, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Slid leaves
      ctx.beginPath();
      ctx.moveTo(-4, 2);
      ctx.quadraticCurveTo(-14, 12, -12, -4);
      ctx.quadraticCurveTo(-6, -2, -2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(4, 2);
      ctx.quadraticCurveTo(14, 12, 12, -4);
      ctx.quadraticCurveTo(6, -2, 2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // white pulp center
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.ellipse(0, -4, 4, 6, 0, 0, Math.PI * 2);
      ctx.fill();

    } else if (obs.type === 'cone') {
      // Traffic Cone Vector
      ctx.fillStyle = '#f97316'; // orange base
      ctx.fillRect(obs.x + 2, obs.y + obs.height - 4, obs.width - 4, 4);

      // cone trunk
      ctx.beginPath();
      ctx.moveTo(obs.x + obs.width / 2, obs.y);
      ctx.lineTo(obs.x + obs.width - 6, obs.y + obs.height - 4);
      ctx.lineTo(obs.x + 6, obs.y + obs.height - 4);
      ctx.closePath();
      ctx.fill();

      // white stripe
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(obs.x + obs.width / 2 - 4, obs.y + 10);
      ctx.lineTo(obs.x + obs.width / 2 + 4, obs.y + 10);
      ctx.lineTo(obs.x + obs.width / 2 + 6, obs.y + 18);
      ctx.lineTo(obs.x + obs.width / 2 - 6, obs.y + 18);
      ctx.closePath();
      ctx.fill();

    } else {
      // Striped Safety Road Barrier
      ctx.fillStyle = '#78350f'; // wood legs
      ctx.fillRect(obs.x, obs.y + obs.height - 6, 6, 6);
      ctx.fillRect(obs.x + obs.width - 6, obs.y + obs.height - 6, 6, 6);

      // Barrier boards with diagonal stripes
      ctx.fillStyle = '#000000';
      ctx.fillRect(obs.x, obs.y + 2, obs.width, obs.height - 8);

      ctx.fillStyle = '#facc15'; // Yellow striped parts
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 4;
      for (let offset = 0; offset < obs.width; offset += 12) {
        ctx.beginPath();
        ctx.moveTo(obs.x + offset, obs.y + 2);
        ctx.lineTo(obs.x + offset + 6, obs.y + obs.height - 6);
        ctx.stroke();
      }
    }

    ctx.restore();
  };

  // Draw collectible items
  const drawCollectible = (ctx: CanvasRenderingContext2D, col: Collectible) => {
    ctx.save();
    
    const scaleFactor = 1.0 + Math.sin(Date.now() * 0.01) * 0.1; // pulse bounce
    ctx.translate(col.x + col.width / 2, col.y + col.height / 2);
    ctx.scale(scaleFactor, scaleFactor);

    if (col.type === 'coin') {
      // Shiny Rotating Gold Coin
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 6;

      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();

      // inner coin ring
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.stroke();

      // inner symbol
      ctx.fillStyle = '#eab308';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 3);

    } else if (col.type === 'star') {
      // Magic Rainbow Nitro Star
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 10;

      // Rotating glow
      ctx.rotate(Date.now() * 0.003);

      const drawStarShape = (cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) => {
        let rot = Math.PI / 2 * 3;
        let sx = cx;
        let sy = cy;
        const step = Math.PI / spikes;

        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
          sx = cx + Math.cos(rot) * outerRadius;
          sy = cy + Math.sin(rot) * outerRadius;
          ctx.lineTo(sx, sy);
          rot += step;

          sx = cx + Math.cos(rot) * innerRadius;
          sy = cy + Math.sin(rot) * innerRadius;
          ctx.lineTo(sx, sy);
          rot += step;
        }
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
      };

      // Draw star border
      ctx.fillStyle = '#ffffff';
      drawStarShape(0, 0, 5, 14, 6);
      ctx.fill();

      // Draw color inner star
      // cycle colors for rainbow star
      const hue = (Date.now() / 15) % 360;
      ctx.fillStyle = `hsl(${hue}, 90%, 60%)`;
      drawStarShape(0, 0, 5, 11, 5);
      ctx.fill();

    } else if (col.type === 'shield') {
      // Bubble Shield Orb
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 10;

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.stroke();

      // core glowing orb
      ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();

      // tiny sparkles reflection
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-3, -3, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  // Draw clean, elegant dashboard overlay directly on canvas margins
  const drawMiniDashboard = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const state = gameStateRef.current;

    ctx.save();

    // 1. TOP HEADER PANEL (Timer and Distance Meter)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.beginPath();
    ctx.roundRect(10, 10, canvas.width - 20, 48, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.stroke();

    // Time Remaining
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText('남은 시간', 24, 26);
    
    ctx.fillStyle = state.timeLeft <= 10 ? '#ef4444' : '#ffffff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`${state.timeLeft.toFixed(1)}s`, 24, 46);

    // Score Panel
    ctx.textAlign = 'right';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText('SCORE', canvas.width - 24, 26);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(state.score.toString(), canvas.width - 24, 46);

    // 2. BOTTOM PANEL (Dashboard with Speedometer & Distance Progress Bar)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.beginPath();
    ctx.roundRect(10, canvas.height - 75, canvas.width - 20, 65, 20);
    ctx.fill();
    ctx.stroke();

    // Progress bar (Start to Finish 1000m)
    const progBarX = 24;
    const progBarY = canvas.height - 62;
    const progBarW = canvas.width - 48;
    const progBarH = 6;
    
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(progBarX, progBarY, progBarW, progBarH, 3);
    ctx.fill();

    const progressRatio = Math.min(1.0, state.distance / 1000);
    ctx.fillStyle = state.isBoosterActive ? '#c084fc' : '#10b981'; // violet-indigo bar for nitro, green for normal
    ctx.beginPath();
    ctx.roundRect(progBarX, progBarY, progBarW * progressRatio, progBarH, 3);
    ctx.fill();

    // Rider indicator on top of progress bar
    const indicatorX = progBarX + (progBarW * progressRatio);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(indicatorX, progBarY + 3, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 6px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('👶', indicatorX, progBarY + 5);

    // Progress tags
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'left';
    ctx.fillText('출발', progBarX, progBarY + 18);
    ctx.textAlign = 'right';
    ctx.fillText('결승선 (1000m)', progBarX + progBarW, progBarY + 18);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`${Math.round(state.distance)}m`, canvas.width / 2, progBarY + 18);

    // Speed indicator (KM/H)
    const currentSpeedKmh = Math.round(state.speed * 12);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px sans-serif';
    ctx.fillText('속도계', canvas.width - 65, canvas.height - 30);
    ctx.fillStyle = state.isBoosterActive ? '#c084fc' : '#ffffff';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`${currentSpeedKmh} km/h`, canvas.width - 65, canvas.height - 15);

    // Active powerup badge
    if (state.isBoosterActive) {
      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.roundRect(24, canvas.height - 30, 80, 16, 4);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ NITRO BOOST', 64, canvas.height - 19);
    } else if (state.isShieldActive) {
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.roundRect(24, canvas.height - 30, 80, 16, 4);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🛡️ SHIELD ACTIVE', 64, canvas.height - 19);
    }

    ctx.restore();
  };

  return (
    <div className="flex flex-col items-center select-none" ref={containerRef}>
      {/* Top action row */}
      <div className="w-full max-w-md flex justify-between items-center px-4 py-2 bg-slate-50 border-b border-slate-100 rounded-t-3xl">
        <button
          onClick={onExit}
          className="p-2 rounded-full hover:bg-slate-200 transition-colors flex items-center text-slate-500 hover:text-slate-700 text-xs font-semibold gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> 뒤로가기
        </button>

        <span className="font-bold text-sm text-slate-800 tracking-tight flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-amber-500 fill-current" />
          {kart.name}
        </span>

        <button
          onClick={toggleMuted}
          className="p-2 rounded-full hover:bg-slate-200 transition-colors text-slate-500"
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Canvas Area */}
      <div className="relative overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl rounded-b-3xl">
        <canvas
          ref={canvasRef}
          width={480}
          height={640}
          className="block max-w-full aspect-[3/4] h-auto sm:max-h-[75vh]"
          style={{ width: '480px' }}
        />

        {/* 3-2-1 Countdown Overlay */}
        {isCountingDown && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-xs">
            <span className="text-sm font-semibold text-pink-400 tracking-widest uppercase mb-2">READY...</span>
            <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center border-4 border-white/40 shadow-2xl scale-in animate-ping-once">
              <span className="text-white font-extrabold text-5xl tracking-tighter drop-shadow-md">
                {countdownNum}
              </span>
            </div>
            <p className="text-slate-300 text-xs mt-6 px-8 text-center leading-relaxed">
              좌우 방향키나 화면 터치로 장애물을 피하고<br />
              무지개 별을 획득해 부스터를 발동하세요!
            </p>
          </div>
        )}

        {/* Mobile controls inside canvas (overlay) */}
        {isPlaying && (
          <div className="absolute bottom-[90px] inset-x-0 h-28 pointer-events-none flex justify-between px-6 items-end select-none">
            {/* Left Button */}
            <button
              id="steer-left-btn"
              onTouchStart={() => setIsPressingLeft(true)}
              onTouchEnd={() => setIsPressingLeft(false)}
              onMouseDown={() => setIsPressingLeft(true)}
              onMouseUp={() => setIsPressingLeft(false)}
              onMouseLeave={() => setIsPressingLeft(false)}
              className={`w-16 h-16 rounded-full bg-black/40 border border-white/20 active:bg-pink-500/80 active:border-pink-300 flex items-center justify-center pointer-events-auto backdrop-blur-xs shadow-lg transition-transform active:scale-95 text-white font-extrabold text-2xl select-none`}
            >
              ◀
            </button>

            {/* Controller Help Label */}
            {showControlsHint && (
              <div className="bg-black/60 text-[10px] text-slate-300 px-3 py-1.5 rounded-full border border-white/10 pointer-events-auto cursor-pointer animate-pulse" onClick={() => setShowControlsHint(false)}>
                💻 키보드 [A / D] 또는 [◀ / ▶] 도 조작 가능
              </div>
            )}

            {/* Right Button */}
            <button
              id="steer-right-btn"
              onTouchStart={() => setIsPressingRight(true)}
              onTouchEnd={() => setIsPressingRight(false)}
              onMouseDown={() => setIsPressingRight(true)}
              onMouseUp={() => setIsPressingRight(false)}
              onMouseLeave={() => setIsPressingRight(false)}
              className={`w-16 h-16 rounded-full bg-black/40 border border-white/20 active:bg-pink-500/80 active:border-pink-300 flex items-center justify-center pointer-events-auto backdrop-blur-xs shadow-lg transition-transform active:scale-95 text-white font-extrabold text-2xl select-none`}
            >
              ▶
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
