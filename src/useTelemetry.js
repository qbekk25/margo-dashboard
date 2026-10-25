import { useEffect, useState, useRef } from 'react';
import { db } from './firebase';
import { doc, onSnapshot, collection, query, orderBy, where, limit, getDocs } from 'firebase/firestore';

export function useTelemetry(sessionId) {
  const [state, setState] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [logs, setLogs] = useState([]);

  const lastSnapTsRef = useRef(0);
  const lastLogTsRef = useRef(0);

  useEffect(() => {
    if (!sessionId) return;

    // ── 1. Aktualny stan: onSnapshot (1 dokument, tanio) ──
    const unsubState = onSnapshot(doc(db, 'telemetry', sessionId), snap => {
      if (snap.exists()) setState(snap.data());
    });

    // ── 2. Historia snapshotów: tylko initial load + polling nowych ──
    const loadInitialSnapshots = async () => {
      const q = query(
        collection(db, 'telemetry', sessionId, 'snapshots'),
        orderBy('ts', 'desc'), limit(100)
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => d.data()).reverse();
      setSnapshots(docs);
      if (docs.length > 0) lastSnapTsRef.current = docs[docs.length - 1].ts;
    };
    loadInitialSnapshots();

    // ── 3. Logi: initial load ──
    const loadInitialLogs = async () => {
      const q = query(
        collection(db, 'telemetry', sessionId, 'logs'),
        orderBy('ts', 'desc'), limit(50)
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => d.data());
      setLogs(docs);
      if (docs.length > 0) lastLogTsRef.current = docs[0].ts;
    };
    loadInitialLogs();

    // ── 4. Polling nowych snapshotów (co 30 s, tylko gdy karta widoczna) ──
    const snapInterval = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      if (!lastSnapTsRef.current) return;
      const q = query(
        collection(db, 'telemetry', sessionId, 'snapshots'),
        where('ts', '>', lastSnapTsRef.current),
        orderBy('ts', 'asc'),
        limit(50)
      );
      const snap = await getDocs(q);
      const newDocs = snap.docs.map(d => d.data());
      if (newDocs.length > 0) {
        setSnapshots(prev => [...prev, ...newDocs].slice(-300));
        lastSnapTsRef.current = newDocs[newDocs.length - 1].ts;
      }
    }, 30000);

    // ── 5. Polling nowych logów (co 15 s) ──
    const logInterval = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      if (!lastLogTsRef.current) return;
      const q = query(
        collection(db, 'telemetry', sessionId, 'logs'),
        where('ts', '>', lastLogTsRef.current),
        orderBy('ts', 'asc'),
        limit(30)
      );
      const snap = await getDocs(q);
      const newDocs = snap.docs.map(d => d.data());
      if (newDocs.length > 0) {
        setLogs(prev => [...newDocs.reverse(), ...prev].slice(0, 100));
        lastLogTsRef.current = Math.max(...newDocs.map(d => d.ts));
      }
    }, 4000);

    return () => {
      unsubState();
      clearInterval(snapInterval);
      clearInterval(logInterval);
    };
  }, [sessionId]);

  return { state, snapshots, logs };
}
