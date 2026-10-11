import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, type ServerInfo } from '@hv/shared';
import { socket } from './socket';

export function App() {
  const [connected, setConnected] = useState(socket.connected);
  const [info, setInfo] = useState<ServerInfo | null>(null);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('serverInfo', setInfo);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('serverInfo', setInfo);
    };
  }, []);

  return (
    <main className="screen center">
      <h1 className="title">Haunted Village</h1>
      <p className="muted">
        {connected ? `Connected to ${info?.name ?? 'server'}` : 'Reaching the village…'}
      </p>
      <p className="muted small">Midnight strikes in {DEFAULT_SETTINGS.midnightSeconds / 60} minutes.</p>
    </main>
  );
}
