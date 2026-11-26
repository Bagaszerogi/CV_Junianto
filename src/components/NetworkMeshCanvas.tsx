import { useEffect, useRef } from 'react';
import type { ThemeMode } from './HeroSection';

interface NetworkMeshCanvasProps {
  theme: ThemeMode;
}

const HUB_LABELS = [
  'PMS',
  'POS',
  'CCTV',
  'IPTV',
  'Door lock',
  'Signage',
  'Firewall',
  'Wi-Fi',
  'VMware',
];

interface MeshNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

interface MeshHub {
  l: string;
  a: number;
  rad: number;
  sp: number;
  x: number;
  y: number;
}

export function NetworkMeshCanvas({ theme }: NetworkMeshCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let nodes: MeshNode[] = [];
    let hubs: MeshHub[] = [];
    let rafId = 0;
    let resizeTimer: number | undefined;

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let gx = mx;
    let gy = my;
    let ox = 0;
    let oy = 0;

    const readThemeColors = () => {
      const style = getComputedStyle(document.documentElement);
      return {
        ice: style.getPropertyValue('--ice').trim() || '#2c5fa8',
        brass: style.getPropertyValue('--brass').trim() || '#9a6b17',
        ink: style.getPropertyValue('--ink').trim() || '#101a38',
      };
    };

    let colors = readThemeColors();

    const sizeCanvas = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth || window.innerWidth;
      height = canvas.clientHeight || window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const nodeCount = Math.round(Math.min(84, (width * height) / 14500));
      nodes = Array.from({ length: nodeCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.4 + 0.6,
      }));

      hubs = HUB_LABELS.map((l, i) => ({
        l,
        a: (i / HUB_LABELS.length) * Math.PI * 2,
        rad: 0.2 + 0.12 * (i % 3),
        sp: 0.00012 + 0.00004 * (i % 4),
        x: 0,
        y: 0,
      }));
    };

    const handlePointerMove = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height);

      gx += (mx - gx) * 0.07;
      gy += (my - gy) * 0.07;
      if (glowRef.current) {
        glowRef.current.style.transform = `translate(${gx.toFixed(1)}px, ${gy.toFixed(1)}px)`;
      }

      const px = mx / Math.max(1, window.innerWidth) - 0.5;
      const py = my / Math.max(1, window.innerHeight) - 0.5;
      ox += (px * -28 - ox) * 0.05;
      oy += (py * -18 - oy) * 0.05;

      const cxh = width * (width > 860 ? 0.68 : 0.5);
      const cyh = height * (width > 860 ? 0.48 : 0.7);
      const radiusBase = Math.min(width, height);

      hubs.forEach((h) => {
        const angle = h.a + t * h.sp;
        h.x = cxh + Math.cos(angle) * radiusBase * h.rad * 1.85 + ox * 1.5;
        h.y = cyh + Math.sin(angle) * radiusBase * h.rad * 1.15 + oy * 1.5;
      });

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (!reduce) {
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < 0 || n.x > width) n.vx *= -1;
          if (n.y < 0 || n.y > height) n.vy *= -1;

          const dx = mx - n.x;
          const dy = my - n.y;
          const d = Math.hypot(dx, dy);
          if (d < 220 && d > 1) {
            n.x += (dx / d) * 0.32;
            n.y += (dy / d) * 0.32;
          }
        }

        const x = n.x + ox * 0.38;
        const y = n.y + oy * 0.38;
        ctx.globalAlpha = 0.52;
        ctx.fillStyle = colors.ice;
        ctx.beginPath();
        ctx.arc(x, y, n.r, 0, Math.PI * 2);
        ctx.fill();

        for (let j = i + 1; j < nodes.length; j++) {
          const m = nodes[j];
          const ex = n.x - m.x;
          const ey = n.y - m.y;
          const dd = ex * ex + ey * ey;
          if (dd < 14000) {
            ctx.globalAlpha = (1 - dd / 14000) * 0.25;
            ctx.strokeStyle = colors.ice;
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(m.x + ox * 0.38, m.y + oy * 0.38);
            ctx.stroke();
          }
        }
      }

      hubs.forEach((h, i) => {
        const nx = hubs[(i + 1) % hubs.length];
        ctx.globalAlpha = 0.28;
        ctx.strokeStyle = colors.brass;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(h.x, h.y);
        ctx.lineTo(nx.x, nx.y);
        ctx.stroke();

        const packet = (t * 0.0003 + i * 0.13) % 1;
        ctx.globalAlpha = 0.88;
        ctx.fillStyle = colors.brass;
        ctx.beginPath();
        ctx.arc(h.x + (nx.x - h.x) * packet, h.y + (nx.y - h.y) * packet, 2, 0, Math.PI * 2);
        ctx.fill();

        const pulse = 1 + Math.sin(t * 0.002 + i) * 0.25;
        ctx.globalAlpha = 0.18;
        ctx.beginPath();
        ctx.arc(h.x, h.y, 12 * pulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(h.x, h.y, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.82;
        ctx.fillStyle = colors.ink;
        ctx.font = '500 11.5px "Hanken Grotesk", system-ui, sans-serif';
        ctx.fillText(h.l, h.x + 10, h.y - 9);
      });

      ctx.globalAlpha = 1;
      if (!reduce) {
        rafId = window.requestAnimationFrame(draw);
      }
    };

    const handleResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        colors = readThemeColors();
        sizeCanvas();
        if (reduce) draw(0);
      }, 150);
    };

    colors = readThemeColors();
    sizeCanvas();
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('resize', handleResize);

    if (reduce) {
      draw(0);
    } else {
      rafId = window.requestAnimationFrame(draw);
    }

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(resizeTimer);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('resize', handleResize);
    };
  }, [theme]);

  return (
    <>
      <div id="glow" ref={glowRef} className="no-print" aria-hidden="true" />
      <canvas
        id="mesh"
        ref={canvasRef}
        aria-hidden="true"
        className="no-print pointer-events-none absolute inset-0 h-full w-full"
      />
      <div
        aria-hidden="true"
        className="no-print hero-vignette pointer-events-none absolute inset-0"
      />
    </>
  );
}
