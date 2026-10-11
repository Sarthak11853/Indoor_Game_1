import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@hv/shared';
import { registerSocketHandlers } from './net/sockets';

const PORT = Number(process.env.PORT) || 3001;
// Works from both src/ (dev) and dist/ (prod): each is one level below server/.
const clientDist = fileURLToPath(new URL('../../client/dist', import.meta.url));

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
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer);
registerSocketHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`Haunted Village server listening on http://localhost:${PORT}`);
});
