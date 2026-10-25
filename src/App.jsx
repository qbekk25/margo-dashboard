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
  if (n == null) return '---';
  return Number(n).toLocaleString('pl-PL');
}
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

const IconMoney = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>;
const IconMap = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const IconTarget = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
const IconTrend = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
const IconTerminal = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>;
const IconSun = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;
const IconMoon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;

function StatCard({ icon, label, value, sub, color, onReset }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ color }}>{icon}</div>
      <div className="stat-body">
        <div className="stat-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {label}
          {onReset && (
            <span onClick={onReset} style={{ cursor: 'pointer', color: 'var(--text-dim)', fontSize: '9px', border: '1px solid var(--border)', padding: '2px 4px', borderRadius: '4px' }} title="Ustaw obecny stan jako punkt startowy dla zysku">
              RESET
            </span>
          )}
        </div>
        <div className="stat-value" style={{ color }}>{value}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

export default function App() {
  const [sessions, setSessions] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SESSIONS_STORAGE_KEY)) || []; } catch { return []; }
  });
  const [sessionId, setSessionId] = useState('');
  const [now, setNow] = useState(Date.now());
  const [theme, setTheme] = useState(() => localStorage.getItem('margo_theme') || 'dark');
  
  // NOWE: Baza do liczenia zysku
  const [baseMoney, setBaseMoney] = useState(null);

  useEffect(() => {
    document.body.className = theme === 'light' ? 'light-mode' : '';
    localStorage.setItem('margo_theme', theme);
  }, [theme]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (sessions.length > 0 && !sessionId) setSessionId(sessions[0].id);
  }, [sessions, sessionId]);

  useEffect(() => {
    if (sessions.length > 0) localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  const { state, snapshots, logs } = useTelemetry(sessionId);

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

  // Ustawienie punktu startowego dla zysku, gdy tylko pojawią się pierwsze dane
  useEffect(() => {
    if (baseMoney === null && snapshots.length > 0 && snapshots[0]?.money != null) {
      setBaseMoney(snapshots[0].money);
    }
  }, [snapshots, baseMoney]);

  useEffect(() => {
    if (!sessionId) return;
    const write = () => {
      if (document.visibilityState === 'visible') setDoc(doc(db, 'presence', sessionId), { ts: Date.now() }, { merge: true }).catch(() => {});
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
      const newSession = { id, label: 'Inicjalizacja...' };
      setSessions(prev => [...prev, newSession]);
      setSessionId(id);
    }
  };

  const removeSession = (idToRemove, e) => {
    e.stopPropagation();
    if (!window.confirm('Usunąć to konto?')) return;
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== idToRemove);
      if (sessionId === idToRemove) setSessionId(filtered.length > 0 ? filtered[0].id : '');
      return filtered;
    });
  };

  const chartData = useMemo(() => ({
    labels: snapshots.map(s => fmtTime(s.ts)),
    datasets: [{
      label: 'Kapitał',
      data: snapshots.map(s => s.money ?? 0),
      borderColor: theme === 'light' ? '#0284c7' : '#00e5ff',
      backgroundColor: (ctx) => {
        const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 260);
        g.addColorStop(0, theme === 'light' ? 'rgba(2,132,199,0.2)' : 'rgba(0,229,255,0.2)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        return g;
      },
      tension: 0.4, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2, fill: true
    }]
  }), [snapshots, theme]);

  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: theme === 'light' ? 'rgba(255,255,255,0.95)' : 'rgba(10,12,18,0.95)',
        borderColor: theme === 'light' ? '#e2e8f0' : '#00e5ff',
        borderWidth: 1,
        titleColor: theme === 'light' ? '#0f172a' : '#fff',
        bodyColor: theme === 'light' ? '#0284c7' : '#00e5ff',
        callbacks: { label: (ctx) => ` ${fmt(ctx.parsed.y)}` }
      }
    },
    scales: {
      x: { grid: { color: theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.03)' }, ticks: { color: theme === 'light' ? '#64748b' : '#666', maxTicksLimit: 6 } },
      y: { grid: { color: theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.03)' }, ticks: { color: theme === 'light' ? '#64748b' : '#666', callback: v => fmt(v) } }
    }
  };

  // NOWE: Zysk obliczany od baseMoney
  const profit = useMemo(() => {
    if (baseMoney === null || state?.hero?.money == null) return null;
    return state.hero.money - baseMoney;
  }, [state?.hero?.money, baseMoney]);

  const isDead = state?.hero?.hp <= 0 || state?.bot?.status?.includes('NIEPRZYTOMNA') || state?.bot?.status?.includes('ODRADZANIE');
  const isStuck = !isDead && state?.bot?.running && state?.hero?.lastMoveTs && (now - state.hero.lastMoveTs > 60000);
  const isLagging = !isDead && state?.bot?.running && state?.ts && (now - state.ts > 130000);

  if (!sessionId || !state) {
    return (
      <div className="app">
        <div className="loading-screen">
          <div className="loading-orb" />
          <h1>SYSTEM INICJALIZACJA</h1>
          <p>Oczekiwanie na strumień danych...</p>
          <button className="btn btn-primary" onClick={addNewSession}>Dodaj instancję</button>
        </div>
      </div>
    );
  }

  const heroName = state.hero.name || '---';

  return (
    <div className="app">
      <header className="top-bar">
        <div className="brand">
          <div className="brand-title">MARGONEM // TELEMETRY</div>
          <div className="brand-sub">NODE: <b>{sessionId.split('_')[1] || 'UNKNOWN'}</b></div>
        </div>

        <div className="top-right">
          <button className="btn btn-outline theme-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Zmień motyw">
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>

          <div className="account-switcher">
            <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} className="ae-select">
              {sessions.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <button className="btn btn-outline" onClick={addNewSession} title="Dodaj konto">+</button>
            {sessions.length > 1 && <button className="btn btn-outline" onClick={(e) => removeSession(sessionId, e)} title="Usuń konto">-</button>}
          </div>

          <span className={`status-pill ${isDead ? 'dead' : state.bot?.running ? 'on' : 'off'}`}>
            <i /> {isDead ? 'SYSTEM OFFLINE' : state.bot?.running ? 'SYSTEM ONLINE' : 'STANDBY'}
          </span>
        </div>
      </header>

      {isDead && <div className="death-alert">WYKRYTO ZGON POSTACI // OCZEKIWANIE NA RESPAWN W MIEŚCIE</div>}
      {isLagging && <div className="lag-alert">BRAK POŁĄCZENIA Z KLIENTEM GRY // ZALECANE ODŚWIEŻENIE STRONY (F5)</div>}
      {!isLagging && isStuck && <div className="stuck-alert">WYKRYTO ZABLOKOWANIE POSTACI // POSTAĆ NIE RUSZYŁA SIĘ OD PONAD MINUTĘ</div>}

      <div className="main-grid">
        <aside className="col-left">
          <section className="card hero-card">
            <div className="hero-header">
              <div className="hero-avatar-box">{heroName.substring(0, 2).toUpperCase()}</div>
              <div className="hero-info">
                <div className="hero-name">{heroName}</div>
                <div className="hero-meta">
                  <span>LVL <b>{state.hero.lvl ?? '?'}</b></span>
                  <span className={`bless ${state.hero.isBlessed ? 'on' : 'off'}`}>
                    {state.hero.isBlessed ? 'BLESS ACTIVE' : 'NO BLESS'}
                  </span>
                </div>
              </div>
            </div>

            <div className="hero-bars">
              <div className="bar-wrap">
                <div className="bar-labels"><span>STRUKTURA ŻYCIA</span><span>{state.hero.hp} / {state.hero.maxhp}</span></div>
                <div className="bar-track"><div className="bar-fill hp" style={{ width: `${(state.hero.hp / state.hero.maxhp) * 100}%` }} /></div>
              </div>
              {state.hero.mp != null && (
                <div className="bar-wrap">
                  <div className="bar-labels"><span>MANA</span><span>{state.hero.mp} / {state.hero.maxmp}</span></div>
                  <div className="bar-track"><div className="bar-fill mp" style={{ width: `${(state.hero.mp / state.hero.maxmp) * 100}%` }} /></div>
                </div>
              )}
            </div>
          </section>

          <div className="stats-grid">
            <StatCard icon={<IconMoney />} label="KAPITAŁ" value={fmt(state.hero.money)} color={theme === 'light' ? '#0284c7' : '#00e5ff'} />
            
            {/* DODANY PRZYCISK RESET DLA ZYSKU */}
            <StatCard 
              icon={<IconTrend />} 
              label="ZYSK SESJI" 
              value={profit != null ? (profit >= 0 ? '+' : '') + fmt(profit) : '---'} 
              color={profit >= 0 ? (theme === 'light' ? '#10b981' : '#00ff88') : (theme === 'light' ? '#ef4444' : '#ff3366')} 
              onReset={() => setBaseMoney(state.hero.money)}
            />
            
            <StatCard icon={<IconMap />} label="LOKALIZACJA" value={state.map || '---'} color={theme === 'light' ? '#8b5cf6' : '#a855f7'} />
            <StatCard icon={<IconTarget />} label="AKTYWNY CEL" value={state.target || '---'} color={theme === 'light' ? '#ef4444' : '#ff3366'} />
          </div>

          <section className="card controls-card">
            <div className="card-header"><span>KONSOLA STEROWANIA</span></div>
            <div className="controls-grid">
              <button className="btn btn-start" onClick={() => sendCommand('start')}>START</button>
              <button className="btn btn-stop" onClick={() => sendCommand('stop')}>STOP</button>
              <button className="btn" onClick={() => sendCommand('skipMap')}>NASTĘPNA MAPA</button>
              <button className="btn" onClick={() => sendCommand('forceSell')}>SPRZEDAŻ</button>
              <button className="btn btn-danger" onClick={() => sendCommand('reload')}>RESTART KLIENTA</button>
            </div>
          </section>
        </aside>

        <main className="col-right">
          <section className="card map-card">
            <div className="card-header">
              <span>RADAR LOKALNY</span>
              <span className="badge mono">{state.hero.x} : {state.hero.y}</span>
            </div>
            <MapView state={state} theme={theme} />
          </section>

          <section className="card chart-card">
            <div className="card-header"><span>ANALIZA KAPITAŁU</span></div>
            <div className="chart-wrap">
              {snapshots.length === 0 ? <div className="empty">Oczekiwanie na dane...</div> : <Line data={chartData} options={chartOpts} />}
            </div>
          </section>

          <div className="bottom-row">
            <section className="card">
              <div className="card-header"><span>PODMIOTY W ZASIĘGU</span><span className="badge">{state.players?.length || 0}</span></div>
              <div className="players-list">
                {state.players?.length === 0 ? <div className="empty">Brak innych graczy</div> : state.players.map(p => (
                  <div key={p.id} className="player-row">
                    <span className="player-dot" />
                    <span className="player-name">{p.nick}</span>
                    <span className="player-lvl">LVL {p.lvl ?? '?'}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="card logs-card">
              <div className="card-header"><span>LOG SYSTEMOWY</span><IconTerminal /></div>
              <div className="logs-list">
                {logs.length === 0 ? <div className="empty">Brak logów</div> : logs.map((l, i) => (
                  <div key={i} className="log-row">
                    <span className="log-time">{l.time}</span>
                    <span className="log-msg" style={{ color: l.color }}>{l.msg}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
