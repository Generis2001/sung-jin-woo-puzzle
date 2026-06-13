import { useEffect, useRef } from 'react';

const COLS = ['rgba(168,85,247,', 'rgba(96,165,250,', 'rgba(52,211,153,'];

interface Pt { x: number; y: number; vx: number; vy: number; r: number; a: number; c: string; }

export default function Particles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current!;
    const ctx = cv.getContext('2d')!;
    let W = 0, H = 0;
    let pts: Pt[] = [];
    let raf: number;

    const mkPt = (): Pt => ({
      x:  Math.random() * W,
      y:  Math.random() * H,
      vx: (Math.random() - 0.5) * 0.4,
      vy: -(Math.random() * 0.5 + 0.1),
      r:  Math.random() * 2.2 + 0.5,
      a:  Math.random() * 0.3 + 0.06,
      c:  COLS[Math.floor(Math.random() * COLS.length)],
    });

    const resize = () => {
      W = cv.width  = window.innerWidth;
      H = cv.height = window.innerHeight;
    };

    const frame = () => {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.y < -10 || p.x < -10 || p.x > W + 10) {
          pts[i] = mkPt(); pts[i].y = H + 4;
        }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28);
        ctx.fillStyle = p.c + p.a + ')'; ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };

    window.addEventListener('resize', resize);
    resize();
    for (let i = 0; i < 65; i++) pts.push(mkPt());
    frame();

    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(raf); };
  }, []);

  return <canvas id="bg-canvas" ref={canvasRef} />;
}
