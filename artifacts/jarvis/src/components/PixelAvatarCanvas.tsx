import React, { useEffect, useRef } from 'react';

export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'happy' | 'focus';

interface PixelAvatarCanvasProps {
  state: AvatarState;
  audioLevelRef?: React.RefObject<number | null>;
  scale?: number;
  fps?: number;
  customSpriteUrl?: string | null;
  className?: string;
}

// Multi-frame animation definition for each state
const STATE_FRAMES: Record<AvatarState, string[]> = {
  idle: ['/sprites/idle_1.png', '/sprites/idle_2.png'],
  listening: ['/sprites/listen_1.png', '/sprites/listen_2.png'],
  thinking: ['/sprites/think_1.png', '/sprites/think_2.png'],
  speaking: ['/sprites/talk_1.png', '/sprites/talk_2.png'],
  happy: ['/sprites/happy_1.png', '/sprites/happy_2.png'],
  focus: ['/sprites/focus_1.png', '/sprites/focus_2.png'],
};

export const PixelAvatarCanvas: React.FC<PixelAvatarCanvasProps> = ({
  state,
  audioLevelRef,
  scale = 1.0,
  fps = 10,
  customSpriteUrl = null,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imagesRef = useRef<Record<string, HTMLImageElement[]>>({});
  const customImageRef = useRef<HTMLImageElement | null>(null);
  const stateRef = useRef<AvatarState>(state);
  const mouthOpenRef = useRef<boolean>(false);
  const lastDrawnFrameRef = useRef<string | null>(null);

  // Keep state ref in sync without triggering useEffect re-runs
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Preload all multi-frame sprite images once
  useEffect(() => {
    Object.entries(STATE_FRAMES).forEach(([st, urls]) => {
      imagesRef.current[st] = [];
      urls.forEach((url, idx) => {
        const img = new Image();
        img.src = url;
        img.onload = () => {
          imagesRef.current[st][idx] = img;
        };
      });
    });
  }, []);

  // Custom sprite override
  useEffect(() => {
    if (!customSpriteUrl) {
      customImageRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      customImageRef.current = img;
    };
    img.src = customSpriteUrl;
  }, [customSpriteUrl]);

  // Main High-Efficiency Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let lastTime = performance.now();
    let tick = 0;

    const baseW = 400;
    const baseH = 620;

    if (canvas.width !== baseW) canvas.width = baseW;
    if (canvas.height !== baseH) canvas.height = baseH;

    const render = (currentTime: number) => {
      const elapsed = currentTime - lastTime;
      const interval = 1000 / fps;

      if (elapsed >= interval) {
        lastTime = currentTime - (elapsed % interval);
        tick++;

        const currentState = stateRef.current;
        const frames = imagesRef.current[currentState] || [];
        let activeFrameImg: HTMLImageElement | undefined;
        let proceduralKey = '';

        if (customImageRef.current && customImageRef.current.complete) {
          activeFrameImg = customImageRef.current;
        } else {
          // Animation State Machine
          if (currentState === 'idle') {
            const idleSeq = [0, 0, 0, 0, 0, 1, 1, 0, 0, 0];
            const frameIdx = idleSeq[tick % idleSeq.length];
            activeFrameImg = frames[frameIdx] || frames[0];
          } else if (currentState === 'listening') {
            const listenSeq = [0, 0, 0, 1, 1, 0];
            const frameIdx = listenSeq[tick % listenSeq.length];
            activeFrameImg = frames[frameIdx] || frames[0];
            proceduralKey = `listen_${tick % 6}`;
          } else if (currentState === 'thinking') {
            const thinkSeq = [0, 0, 0, 0, 0, 1, 1, 0, 0];
            const frameIdx = thinkSeq[tick % thinkSeq.length];
            activeFrameImg = frames[frameIdx] || frames[0];
            proceduralKey = `think_${tick % 8}`;
          } else if (currentState === 'speaking') {
            const audioLevel = audioLevelRef?.current ?? 0;
            if (audioLevel > 0.01) {
              if (!mouthOpenRef.current && audioLevel > 0.05) {
                mouthOpenRef.current = true;
              } else if (mouthOpenRef.current && audioLevel < 0.02) {
                mouthOpenRef.current = false;
              }
              const mouthIdx = mouthOpenRef.current ? 0 : 1;
              activeFrameImg = frames[mouthIdx] || frames[0];
            } else {
              const talkSeq = [0, 0, 1, 0, 1, 1, 0];
              const frameIdx = talkSeq[tick % talkSeq.length];
              activeFrameImg = frames[frameIdx] || frames[0];
            }
          } else if (currentState === 'happy') {
            const happySeq = [0, 0, 1, 1, 1, 0];
            const frameIdx = happySeq[tick % happySeq.length];
            activeFrameImg = frames[frameIdx] || frames[0];
            proceduralKey = `happy_${tick % 8}`;
          } else if (currentState === 'focus') {
            const focusSeq = [0, 0, 0, 1, 1, 0];
            const frameIdx = focusSeq[tick % focusSeq.length];
            activeFrameImg = frames[frameIdx] || frames[0];
            proceduralKey = `focus_${tick % 8}`;
          }
        }

        const frameKey = `${currentState}_${activeFrameImg?.src || ''}_${proceduralKey}`;
        if (frameKey !== lastDrawnFrameRef.current || currentState === 'speaking') {
          lastDrawnFrameRef.current = frameKey;

          ctx.clearRect(0, 0, baseW, baseH);
          ctx.imageSmoothingEnabled = false;

          // Ground shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
          ctx.beginPath();
          ctx.ellipse(200, 582, 68, 14, 0, 0, Math.PI * 2);
          ctx.fill();

          // Procedural accents
          if (currentState === 'listening') {
            const waveTick = tick % 6;
            ctx.fillStyle = 'rgba(6, 182, 212, 0.85)';
            if (waveTick >= 1) ctx.fillRect(302, 168, 4, 12);
            if (waveTick >= 3) ctx.fillRect(314, 156, 4, 34);
          } else if (currentState === 'thinking') {
            const floatBob = Math.floor(Math.sin(tick * 0.3) * 4);
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(290, 85 + floatBob, 5, 5);
            ctx.fillRect(285, 95 + floatBob, 4, 4);
            ctx.fillRect(296, 75 + floatBob, 3, 3);
          } else if (currentState === 'happy') {
            const sparkTick = tick % 8;
            ctx.fillStyle = '#fbbf24';
            const sX = 300 + (sparkTick % 2 === 0 ? 8 : -8);
            const sY = 110 + (sparkTick % 2 === 0 ? -6 : 6);
            ctx.fillRect(sX, sY, 6, 6);
            ctx.fillStyle = '#38bdf8';
            ctx.fillRect(330, 150 + (sparkTick % 3) * 2, 5, 5);
            ctx.fillStyle = '#f472b6';
            ctx.fillRect(110, 190 + (sparkTick % 2) * 3, 5, 5);
          } else if (currentState === 'focus') {
            const glareTick = tick % 8;
            if (glareTick < 3) {
              ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
              ctx.fillRect(260 + glareTick * 5, 175, 6, 4);
            }
            ctx.fillStyle = 'rgba(56, 189, 248, 0.6)';
            const moteY = 500 - ((tick * 8) % 360);
            ctx.fillRect(120, moteY, 5, 5);
            ctx.fillRect(280, ((moteY + 80) % 400) + 100, 4, 4);
          }

          // Draw the active sprite frame
          if (activeFrameImg && activeFrameImg.complete && activeFrameImg.naturalWidth > 0) {
            ctx.drawImage(activeFrameImg, 0, 0, baseW, baseH);
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [fps, audioLevelRef]);

  return (
    <div className={`relative flex items-center justify-center pointer-events-none select-none ${className}`}>
      <canvas
        ref={canvasRef}
        className="pixelated transition-transform duration-200"
        style={{
          width: `${160 * scale}px`,
          height: `${248 * scale}px`,
          imageRendering: 'pixelated',
          willChange: 'transform',
        }}
      />
    </div>
  );
};
