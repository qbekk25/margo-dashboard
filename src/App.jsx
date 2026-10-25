import { useState, useMemo } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useTelemetry } from './useTelemetry';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Title, Tooltip, Legend
} from 'chart.js';
import './styles.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function App() {
  const [sessionId, setSessionId] = useState(
    () => prompt('Podaj sessionId z konsoli gry (np. sess_abc123):') || ''
  );
  const { state, snapshots, logs } = useTelemetry(sessionId);

  const sendCommand = async (cmd, extra = {}) => {
    await setDoc(doc(db, 'commands', sessionId), { cmd, ts: Date.now(), ...extra }, { merge: true });
  };

  const chartData = useMemo(() => ({
    labels: snapshots.map(s => new Date(s.ts).toLocaleTimeString()),
    datasets: [{
      label: 'Pieniądze',
      data: snapshots.map(s => s.money ?? 0),
      borderColor: '#00ff7f',
      backgroundColor: 'rgba(0,255,127,0.15)',
      tension: 0.3, pointRadius: 0, fill: true
    }]
  }), [snapshots]);

  if (!state) {
    return (
      <div className="app">
        <h1>Margonem Dashboard</h1>
        <p>Oczekiwanie na dane z gry… (sessionId: {sessionId})</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1>⚔️ Margonem Dashboard</h1>
        <span className={`pill ${state.bot?.running ? 'on' : 'off'}`}>
          {state.bot?.running ? 'BOT AKTYWNY' : 'BOT ZATRZYMANY'}
        </span>
      </header>

      <div className="grid">
        <section className="card">
          <h2>📍 Pozycja</h2>
          <p><b>Mapa:</b> {state.map}</p>
          <p><b>Pozycja:</b> ({state.hero.x}, {state.hero.y})</p>
          <p><b>Poziom:</b> {state.hero.lvl ?? '?'}</p>
          <p><b>Pieniądze:</b> {state.hero.money ?? '?'}</p>
          <p><b>Błogosławieństwo:</b> {state.hero.isBlessed ? '✓ AKTYWNE' : '✗ BRAK'}</p>
        </section>

        <section className="card">
          <h2>🧭 Trasa</h2>
          <p><b>Profil:</b> {state.bot?.currentProfile || '—'}</p>
          <p><b>Mapa:</b> {state.bot?.route?.[state.bot?.currentRouteIdx] || '—'}</p>
          <p><b>Postęp:</b> {state.bot?.currentRouteIdx + 1} / {state.bot?.route?.length || 0}</p>
          <p><b>Status:</b> {state.bot?.status || '—'}</p>
        </section>

        <section className="card">
          <h2>👥 Gracze w pobliżu</h2>
          {state.players?.length === 0 ? <p>Brak innych graczy</p> :
            state.players.map(p => (
              <div key={p.id} className="row"><span>{p.nick}</span><span>lvl {p.lvl ?? '?'}</span></div>
            ))}
        </section>

        <section className="card">
          <h2>🎮 Sterowanie</h2>
          <div className="controls">
            <button onClick={() => sendCommand('start')}>▶ Start</button>
            <button onClick={() => sendCommand('stop')}>⏹ Stop</button>
            <button onClick={() => sendCommand('skipMap')}>⏭ Nast. mapa</button>
            <button onClick={() => sendCommand('forceSell')}>💰 Sprzedaj</button>
            <button onClick={() => sendCommand('reload')}>🔄 Odśwież grę</button>
          </div>
        </section>
      </div>

      <section className="card chart-card">
        <h2>💰 Zarobki w czasie</h2>
        <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />
      </section>

      <section className="card logs-card">
        <h2>📜 Logi</h2>
        <div className="logs">
          {logs.length === 0 ? <p>Brak logów</p> :
            logs.map((l, i) => (
              <div key={i} className="log-row">
                <span style={{ color: l.color }}>{l.msg}</span>
                <span className="log-time">{l.time}</span>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}
