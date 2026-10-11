import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@hv/shared';

// One connection for the whole app, to the same origin that served the page.
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();
