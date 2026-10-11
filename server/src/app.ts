import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import type { AckResult, PublicUrlInfo, TapRequest } from '@hv/shared';
import { registerSocketHandlers, respond, type IO } from './net/sockets';
import { MemoryRoomStore } from './rooms/store';
import { RoomService } from './rooms/service';

// Works from both src/ (dev) and dist/ (prod): each is one level below server/.
const clientDist = fileURLToPath(new URL('../../client/dist', import.meta.url));

/** Dev tools (alarm triggers, simulated card taps) are on except in the production build. */
export const DEV_TOOLS = process.env.NODE_ENV !== 'production' || process.env.HV_DEV === '1';

export function createGameServer(rooms = new RoomService(new MemoryRoomStore()), dev = DEV_TOOLS) {
  const app = express();
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Where phones should go to join: PUBLIC_URL if set, else this machine's LAN addresses.
  app.get('/api/public-url', (_req, res) => {
    const info: PublicUrlInfo = { publicUrl: process.env.PUBLIC_URL?.trim() || null, lanAddresses: lanAddresses() };
    res.json(info);
  });

  // The /tap page (iPhone, or any phone with the game closed) reports card taps here.
  app.post('/api/tap', express.json({ limit: '2kb' }), (req, res) => {
    const body = (req.body ?? {}) as Partial<TapRequest>;
    void respond<{ message: string }>(
      (result: AckResult<{ message: string }>) => res.json(result),
      async () => {
        const { session } = await rooms.resume(body.code, body.token);
        return hub.tapCard(session.code, session.playerId, body.cardId);
      },
    );
  });

  // In production the server also hosts the built client (one service, one URL).
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.use((_req, res) => res.sendFile(`${clientDist}/index.html`));
  }

  const httpServer = createServer(app);
  const io: IO = new Server(httpServer);
  const hub = registerSocketHandlers(io, rooms, dev);
  return { httpServer, io, rooms };
}

function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((net) => net && net.family === 'IPv4' && !net.internal)
    .map((net) => net!.address);
}
