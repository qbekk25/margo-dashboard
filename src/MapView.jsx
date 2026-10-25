import { useEffect, useRef, useState } from 'react';

export default function MapView({ state }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [size, setSize] = useState(500);

  // Dynamiczne skalowanie mapy do kontenera
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        const width = entry.contentRect.width;
        // Maksymalny rozmiar mapy to 600px, minimalny to tyle ile się zmieści
        setSize(Math.min(width, 600));
      }
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

    // Tło
    ctx.fillStyle = '#0a0705';
    ctx.fillRect(0, 0, cssSize, cssSize);

    // Podłoga + ściany
    for (let i = 0; i < walls.data.length; i++) {
      const row = Math.floor(i / walls.size);
      const col = i % walls.size;
      const isWall = walls.data[i] === '1';
      const x = col * tileSize;
      const y = row * tileSize;

      const dx = (col - radius) / radius;
      const dy = (row - radius) / radius;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const fogAlpha = Math.max(0.35, 1 - dist * 0.7);

      ctx.globalAlpha = fogAlpha;
      if (isWall) {
        ctx.fillStyle = '#2d2118';
        ctx.fillRect(x, y, tileSize + 0.5, tileSize + 0.5);
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(x, y, tileSize, 1);
      } else {
        ctx.fillStyle = '#1a1310';
        ctx.fillRect(x, y, tileSize + 0.5, tileSize + 0.5);
      }
    }
    ctx.globalAlpha = 1;

    // Subtelna siatka
    ctx.strokeStyle = 'rgba(255,180,80,0.04)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= walls.size; i++) {
      const p = i * tileSize;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, cssSize); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(cssSize, p); ctx.stroke();
    }

    // Bramy
    (state.gateways || []).forEach(gw => {
      const relX = gw.x - heroX + radius;
      const relY = gw.y - heroY + radius;
      if (relX < 0 || relX >= walls.size || relY < 0 || relY >= walls.size) return;
      const cx = relX * tileSize + tileSize / 2;
      const cy = relY * tileSize + tileSize / 2;

      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(cx, cy - tileSize * 0.45);
      ctx.lineTo(cx + tileSize * 0.45, cy);
      ctx.lineTo(cx, cy + tileSize * 0.45);
      ctx.lineTo(cx - tileSize * 0.45, cy);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // NPC
    (state.npcs || []).forEach(npc => {
      const relX = npc.x - heroX + radius;
      const relY = npc.y - heroY + radius;
      if (relX < 0 || relX >= walls.size || relY < 0 || relY >= walls.size) return;
      const cx = relX * tileSize + tileSize / 2;
      const cy = relY * tileSize + tileSize / 2;
      const r = tileSize * 0.35;

      let color = '#ef4444';
      if (npc.wt >= 20) color = '#a855f7';
      else if (npc.wt >= 10) color = '#f97316';

      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Inni gracze
    (state.players || []).forEach(p => {
      if (p.x == null || p.y == null) return;
      const relX = p.x - heroX + radius;
      const relY = p.y - heroY + radius;
      if (relX < 0 || relX >= walls.size || relY < 0 || relY >= walls.size) return;
      const cx = relX * tileSize + tileSize / 2;
      const cy = relY * tileSize + tileSize / 2;
      const r = tileSize * 0.4;

      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // Bohater – poświata + kropka
    const heroCx = radius * tileSize + tileSize / 2;
    const heroCy = radius * tileSize + tileSize / 2;

    const grad = ctx.createRadialGradient(heroCx, heroCy, 0, heroCx, heroCy, tileSize * 2.5);
    grad.addColorStop(0, 'rgba(0,255,127,0.45)');
    grad.addColorStop(1, 'rgba(0,255,127,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(heroCx - tileSize * 2.5, heroCy - tileSize * 2.5, tileSize * 5, tileSize * 5);

    ctx.fillStyle = '#00ff7f';
    ctx.beginPath();
    ctx.arc(heroCx, heroCy, tileSize * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [state, size]);

  return (
    <div className="map-wrap" ref={containerRef}>
      <canvas ref={canvasRef} className="map-canvas" />
      <div className="map-legend">
        <span><i className="dot hero" /> Ty</span>
        <span><i className="dot mob" /> Mob</span>
        <span><i className="dot elite1" /> Elita I</span>
        <span><i className="dot elite2" /> Elita II</span>
        <span><i className="dot player" /> Gracz</span>
        <span><i className="dot gate" /> Brama</span>
      </div>
    </div>
  );
}
