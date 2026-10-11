import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerInfo, ServerToClientEvents } from '@hv/shared';

export type IO = Server<ClientToServerEvents, ServerToClientEvents>;

const info = (): ServerInfo => ({ name: 'Haunted Village', serverTime: Date.now() });

export function registerSocketHandlers(io: IO) {
  io.on('connection', (socket) => {
    socket.emit('serverInfo', info());
    socket.on('hello', (ack) => ack(info()));
  });
}
