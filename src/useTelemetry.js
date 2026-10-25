import { useEffect, useState } from 'react';
import { db } from './firebase';
import { doc, onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore';

export function useTelemetry(sessionId) {
  const [state, setState] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (!sessionId) return;

    const unsubState = onSnapshot(doc(db, 'telemetry', sessionId), snap => {
      if (snap.exists()) setState(snap.data());
    });

    const qSnaps = query(
      collection(db, 'telemetry', sessionId, 'snapshots'),
      orderBy('ts', 'desc'), limit(300)
    );
    const unsubSnaps = onSnapshot(qSnaps, snap => {
      setSnapshots(snap.docs.map(d => d.data()).reverse());
    });

    const qLogs = query(
      collection(db, 'telemetry', sessionId, 'logs'),
      orderBy('ts', 'desc'), limit(100)
    );
    const unsubLogs = onSnapshot(qLogs, snap => {
      setLogs(snap.docs.map(d => d.data()));
    });

    return () => { unsubState(); unsubSnaps(); unsubLogs(); };
  }, [sessionId]);

  return { state, snapshots, logs };
}
