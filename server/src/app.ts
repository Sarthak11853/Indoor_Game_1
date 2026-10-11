import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { registerSocketHandlers, type IO } from './net/sockets';
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

  // In production the server also hosts the built client (one service, one URL).
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.use((_req, res) => res.sendFile(`${clientDist}/index.html`));
  }

  const httpServer = createServer(app);
  const io: IO = new Server(httpServer);
  registerSocketHandlers(io, rooms, dev);
  return { httpServer, io, rooms };
}
