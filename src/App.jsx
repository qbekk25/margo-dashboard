import { useState, useMemo, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useTelemetry } from './useTelemetry';
import { Line } from 'react-chartjs-2';
import MapView from './MapView';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import './styles.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const SESSIONS_STORAGE_KEY = 'margo_dashboard_sessions';

function fmt(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('pl-PL');
}
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ color }}>{icon}</div>
      <div className="stat-body">
        <div className="stat-label">{label}</div>
        <div className="stat-value" style={{ color }}>{value}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

function ProgressBar({ value, max, color = '#ef4444', label }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="bar-wrap">
      <div className="bar-labels">
        <span>{label}</span>
        <span>{fmt(value)} / {fmt(max)}</span>
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{
          width: pct + '%',
          background: `linear-gradient(90deg, ${color}, ${color}dd)`
        }} />
      </div>
    </div>
  );
}

export default function App() {
  // Przechowujemy listę zapisanych sesji: [{ id: 'sess_...', label: 'Nazwa konta' }]
  const [sessions, setSessions] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SESSIONS_STORAGE_KEY)) || []; } catch { return []; }
  });
  const [sessionId, setSessionId] = useState('');

  // Inicjalizacja pierwszej sesji
  useEffect(() => {
    if (sessions.length > 0 && !sessionId) {
      setSessionId(sessions[0].id);
    } else if (sessions.length === 0 && !sessionId) {
      // Jeśli nie ma zapisanych, zapytaj o pierwszy sessionId
      const id = prompt('Podaj sessionId z konsoli gry (np. sess_...):');
      if (id) {
        const newSession = { id, label: 'Konto 1' };
        setSessions([newSession]);
        setSessionId(id);
      }
    }
  }, [sessions, sessionId]);

  // Zapis sesji do localStorage
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    }
  }, [sessions]);

  const { state, snapshots, logs } = useTelemetry(sessionId);

  // Automatyczna aktualizacja nazwy konta w liście (gdy dowiemy się jak nazywa się postać)
  useEffect(() => {
    if (state?.hero?.name && sessionId) {
      setSessions(prev => {
        const idx = prev.findIndex(s => s.id === sessionId);
        if (idx >= 0 && prev[idx].label !== state.hero.name) {
          const newSessions = [...prev];
          newSessions[idx].label = state.hero.name;
          return newSessions;
        }
        return prev;
      });
    }
  }, [state?.hero?.name, sessionId]);

  // Obecność (presence)
  useEffect(() => {
    if (!sessionId) return;
    const write = () => {
      if (document.visibilityState === 'visible') {
        setDoc(doc(db, 'presence', sessionId), { ts: Date.now() }, { merge: true }).catch(() => {});
      }
    };
    write();
    const int = setInterval(write, 20000);
    return () => clearInterval(int);
  }, [sessionId]);

  const sendCommand = async (cmd, extra = {}) => {
    await setDoc(doc(db, 'commands', sessionId), { cmd, ts: Date.now(), ...extra }, { merge: true });
  };

  const addNewSession = () => {
    const id = prompt('Podaj nowy sessionId z konsoli gry:');
    if (id && !sessions.some(s => s.id === id)) {
      const newSession = { id, label: 'Nowe konto...' };
      setSessions(prev => [...prev, newSession]);
      setSessionId(id);
    }
  };

  const removeSession = (idToRemove, e) => {
    e.stopPropagation();
    if (!window.confirm('Usunąć to konto z listy?')) return;
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== idToRemove);
      if (sessionId === idToRemove) {
        setSessionId(filtered.length > 0 ? filtered[0].id : '');
      }
      return filtered;
    });
  };

  const chartData = useMemo(() => ({
    labels: snapshots.map(s => fmtTime(s.ts)),
    datasets: [{
      label: 'Pieniądze',
      data: snapshots.map(s => s.money ?? 0),
      borderColor: '#fbbf24',
      backgroundColor: (ctx) => {
        const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 260);
        g.addColorStop(0, 'rgba(251,191,36,0.35)');
        g.addColorStop(1, 'rgba(251,191,36,0)');
        return g;
      },
      tension: 0.35,
      pointRadius: 0,
      pointHoverRadius: 4,
      borderWidth: 2,
      fill: true
    }]
  }), [snapshots]);

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(20,15,12,0.95)',
        borderColor: '#6e2912',
        borderWidth: 1,
        titleColor: '#fbbf24',
        bodyColor: '#f3e8e2',
        callbacks: { label: (ctx) => ` 💰 ${fmt(ctx.parsed.y)}` }
      }
    },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#666', maxTicksLimit: 8 } },
      y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#666', callback: v => fmt(v) } }
    }
  };

  const profit = useMemo(() => {
    if (!snapshots.length || !state?.hero?.money) return null;
    const start = snapshots[0]?.money;
    if (start == null) return null;
    return state.hero.money - start;
  }, [snapshots, state]);

  const profitPerHour = useMemo(() => {
    if (snapshots.length < 2 || profit == null) return null;
    const hours = (snapshots[snapshots.length - 1].ts - snapshots[0].ts) / 3600000;
    if (hours <= 0.02) return null;
    return Math.round(profit / hours);
  }, [snapshots, profit]);

  if (!sessionId) {
    return (
      <div className="app">
        <div className="loading-screen">
          <h1>Margonem Dashboard</h1>
          <p>Brak wybranej sesji.</p>
          <button className="btn btn-start" onClick={addNewSession}>Dodaj konto</button>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="app">
        <div className="loading-screen">
          <div className="loading-orb" />
          <h1>Margonem Dashboard</h1>
          <p>Oczekiwanie na dane z gry… (sessionId: {sessionId})</p>
          <button className="btn btn-secondary" onClick={addNewSession}>Dodaj nowe konto</button>
        </div>
      </div>
    );
  }

  const heroName = state.hero.name || 'Bohater';

  return (
    <div className="app">
      <header className="top-bar">
        <div className="brand">
          <span className="brand-icon">⚔️</span>
          <div>
            <div className="brand-title">Margonem Dashboard</div>
            <div className="brand-sub">Profil: <b>{state.bot?.currentProfile || '—'}</b></div>
          </div>
        </div>

        <div className="top-right">
          {/* PRZEŁĄCZNIK KONT */}
          <div className="account-switcher">
            <select 
              value={sessionId} 
              onChange={(e) => setSessionId(e.target.value)}
              className="ae-select"
              style={{ padding: '6px 12px', borderRadius: '8px', background: '#1a1310', color: '#fbbf24', border: '1px solid #3e1e14', outline: 'none', cursor: 'pointer', fontWeight: 'bold' }}
            >
              {sessions.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <button className="btn btn-ghost" onClick={addNewSession} title="Dodaj nowe konto" style={{ padding: '6px 10px' }}>+</button>
            {sessions.length > 1 && (
              <button className="btn btn-ghost" onClick={(e) => removeSession(sessionId, e)} title="Usuń to konto z listy" style={{ padding: '6px 10px', color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}>✕</button>
            )}
          </div>

          <span className={`status-pill ${state.bot?.running ? 'on' : 'off'}`}>
            <i /> {state.bot?.running ? 'BOT AKTYWNY' : 'BOT ZATRZYMANY'}
          </span>
        </div>
      </header>

      <div className="main-grid">
        <aside className="col-left">
          <section className="card hero-card">
            <div className="hero-avatar">🧙</div>
            <div className="hero-info">
              <div className="hero-name">{heroName}</div>
              <div className="hero-meta">
                <span>Lvl <b>{state.hero.lvl ?? '?'}</b></span>
                <span>·</span>
                <span className={state.hero.isBlessed ? 'bless-on' : 'bless-off'}>
                  {state.hero.isBlessed ? '✨ Błogo' : '✗ Brak błogo'}
                </span>
              </div>
            </div>

            <div className="hero-bars">
              <ProgressBar value={state.hero.hp ?? 0} max={state.hero.maxhp ?? 1} color="#ef4444" label="❤️ HP" />
              {state.hero.mp != null && (
                <ProgressBar value={state.hero.mp} max={state.hero.maxmp ?? 1} color="#3b82f6" label="💧 MP" />
              )}
            </div>
          </section>

          <div className="stats-grid">
            <StatCard icon="💰" label="Pieniądze" value={fmt(state.hero.money)} color="#fbbf24" />
            <StatCard
              icon="📈" label="Zysk sesji"
              value={profit != null ? (profit >= 0 ? '+' : '') + fmt(profit) : '—'}
              sub={profitPerHour != null ? `≈ ${fmt(profitPerHour)}/h` : null}
              color={profit != null && profit >= 0 ? '#00ff7f' : '#ef4444'} />
            <StatCard icon="📍" label="Mapa" value={state.map || '—'} color="#22d3ee" />
            <StatCard icon="🎯" label="Cel" value={state.target || '—'} color="#a855f7" />
          </div>

          <section className="card">
            <div className="card-header">
              <span>🧭 Trasa</span>
              <span className="badge">{state.bot?.route?.length || 0} map</span>
            </div>
            <div className="route-progress">
              <div className="route-current">
                {(state.bot?.currentRouteIdx ?? 0) + 1}. {state.bot?.route?.[state.bot?.currentRouteIdx] || '—'}
              </div>
              <div className="route-bar">
                <div className="route-bar-fill" style={{
                  width: state.bot?.route?.length
                    ? `${((state.bot.currentRouteIdx + 1) / state.bot.route.length) * 100}%`
                    : '0%'
                }} />
              </div>
              <div className="route-next">
                Następna: {state.bot?.route?.[(state.bot?.currentRouteIdx + 1) % Math.max(1, state.bot?.route?.length)] || '—'}
              </div>
            </div>
          </section>

          <section className="card controls-card">
            <div className="card-header">🎮 Sterowanie</div>
            <div className="controls-grid">
              <button className="btn btn-start" onClick={() => sendCommand('start')}>▶ Start</button>
              <button className="btn btn-stop" onClick={() => sendCommand('stop')}>⏹ Stop</button>
              <button className="btn" onClick={() => sendCommand('skipMap')}>⏭ Nast. mapa</button>
              <button className="btn" onClick={() => sendCommand('forceSell')}>💰 Sprzedaj</button>
              <button className="btn btn-danger" onClick={() => sendCommand('reload')}>🔄 Odśwież grę</button>
            </div>
          </section>
        </aside>

        <main className="col-right">
          <section className="card map-card">
            <div className="card-header">
              <span>🗺️ Otoczenie — {state.map}</span>
              <span className="badge map-coords">({state.hero.x}, {state.hero.y})</span>
            </div>
            <MapView state={state} />
          </section>

          <section className="card chart-card">
            <div className="card-header">
              <span>💰 Zarobki w czasie</span>
              {profitPerHour != null && (
                <span className="badge gold">{fmt(profitPerHour)}/h</span>
              )}
            </div>
            <div className="chart-wrap">
              {snapshots.length === 0
                ? <div className="empty">Zbiera dane… pierwsze punkty po 5 min</div>
                : <Line data={chartData} options={chartOpts} />}
            </div>
          </section>

          <div className="bottom-row">
            <section className="card">
              <div className="card-header">
                <span>👥 Gracze</span>
                <span className="badge">{state.players?.length || 0}</span>
              </div>
              <div className="players-list">
                {state.players?.length === 0
                  ? <div className="empty">Brak innych graczy</div>
                  : state.players.map(p => (
                    <div key={p.id} className="player-row">
                      <span className="player-dot" />
                      <span className="player-name">{p.nick}</span>
                      <span className="player-lvl">lvl {p.lvl ?? '?'}</span>
                    </div>
                  ))}
              </div>
            </section>

            <section className="card logs-card">
              <div className="card-header">
                <span>📜 Logi</span>
                <span className="badge">{logs.length}</span>
              </div>
              <div className="logs-list">
                {logs.length === 0
                  ? <div className="empty">Brak logów</div>
                  : logs.map((l, i) => (
                    <div key={i} className="log-row">
                      <span className="log-time">{l.time}</span>
                      <span className="log-msg" style={{ color: l.color }}>{l.msg}</span>
                    </div>
                  ))}
              </div>
            </section>
          </div>

          {state.battle?.active && (
            <div className="battle-banner">
              ⚔️ Walka — runda {state.battle.round || 0}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
