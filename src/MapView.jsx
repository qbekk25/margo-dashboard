import { useEffect, useRef, useState } from 'react';

export default function MapView({ state }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [size, setSize] = useState(500);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) setSize(Math.min(entry.contentRect.width, 600));
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!state?.walls || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const cssSize = size;

    canvas.width = cssSize * dpr;
    canvas.height = cssSize * dpr;
    canvas.style.width = cssSize + 'px';
    canvas.style.height = cssSize + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const walls = state.walls;
    const tileSize = cssSize / walls.size;
    const radius = walls.radius;
    const heroX = state.hero.x;
    const heroY = state.hero.y;

    // Tło (bardzo ciemny granat)
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, cssSize, cssSize);

    for (let i = 0; i < walls.data.length; i++) {
      const row = Math.floor(i / walls.size);
      const col = i % walls.size;
      const isWall = walls.data[i] === '1';
      const x = col * tileSize;
      const y = row * tileSize;

      const dx = (col - radius) / radius;
      const dy = (row - radius) / radius;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const fogAlpha = Math.max(0.2, 1 - dist * 0.8);

      ctx.globalAlpha = fogAlpha;
      if (isWall) {
        ctx.fillStyle = '#141c2b'; // Ciemny niebieski sciany
        ctx.fillRect(x, y, tileSize + 0.5, tileSize + 0.5);
      } else {
        ctx.fillStyle = '#080b12'; // Jeszcze ciemniejsza podłoga
        ctx.fillRect(x, y, tileSize + 0.5, tileSize + 0.5);
      }
    }
    ctx.globalAlpha = 1;

    // Siatka
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.03)'; // Cyjanowa siatka
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= walls.size; i++) {
      const p = i * tileSize;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, cssSize); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(cssSize, p); ctx.stroke();
    }

    // Bramy (Fioletowe romby)
    (state.gateways || []).forEach(gw => {
      const relX = gw.x - heroX + radius;
      const relY = gw.y - heroY + radius;
      if (relX < 0 || relX >= walls.size || relY < 0 || relY >= walls.size) return;
      const cx = relX * tileSize + tileSize / 2;
      const cy = relY * tileSize + tileSize / 2;

      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.moveTo(cx, cy - tileSize * 0.4);
      ctx.lineTo(cx + tileSize * 0.4, cy);
      ctx.lineTo(cx, cy + tileSize * 0.4);
      ctx.lineTo(cx - tileSize * 0.4, cy);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // NPC (Czerwone i Różowe kropki)
    (state.npcs || []).forEach(npc => {
      const relX = npc.x - heroX + radius;
      const relY = npc.y - heroY + radius;
      if (relX < 0 || relX >= walls.size || relY < 0 || relY >= walls.size) return;
      const cx = relX * tileSize + tileSize / 2;
      const cy = relY * tileSize + tileSize / 2;
      const r = tileSize * 0.3;

      let color = '#ff3366'; // Zwykłe
      if (npc.wt >= 20) color = '#e879f9'; // Elita 2
      else if (npc.wt >= 10) color = '#fca5a5'; // Elita 1

      ctx.shadowColor = color;
      ctx.shadowBlur = 5;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Gracze (Żółte kwadraty)
    (state.players || []).forEach(p => {
      if (p.x == null || p.y == null) return;
      const relX = p.x - heroX + radius;
      const relY = p.y - heroY + radius;
      if (relX < 0 || relX >= walls.size || relY < 0 || relY >= walls.size) return;
      const cx = relX * tileSize + tileSize / 2;
      const cy = relY * tileSize + tileSize / 2;
      
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(cx - tileSize*0.3, cy - tileSize*0.3, tileSize*0.6, tileSize*0.6);
      ctx.shadowBlur = 0;
    });

    // Bohater (Neonowy zielony okrąg)
    const heroCx = radius * tileSize + tileSize / 2;
    const heroCy = radius * tileSize + tileSize / 2;

    const grad = ctx.createRadialGradient(heroCx, heroCy, 0, heroCx, heroCy, tileSize * 2);
    grad.addColorStop(0, 'rgba(0, 255, 136, 0.4)');
    grad.addColorStop(1, 'rgba(0, 255, 136, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(heroCx - tileSize * 2, heroCy - tileSize * 2, tileSize * 4, tileSize * 4);

    ctx.fillStyle = '#00ff88';
    ctx.beginPath();
    ctx.arc(heroCx, heroCy, tileSize * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }, [state, size]);

  return (
    <div className="map-wrap" ref={containerRef}>
      <canvas ref={canvasRef} className="map-canvas" />
      <div className="map-legend">
        <span><i className="dot hero" /> BOHATER</span>
        <span><i className="dot mob" /> WROGOWIE</span>
        <span><i className="dot player" /> GRACZE</span>
        <span><i className="dot gate" /> BRAMY</span>
      </div>
    </div>
  );
}
