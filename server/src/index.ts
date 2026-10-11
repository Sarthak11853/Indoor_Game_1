import { createGameServer } from './app';

const PORT = Number(process.env.PORT) || 3001;
const { httpServer, rooms } = createGameServer();

// Clear out abandoned rooms once a minute.
setInterval(() => {
  rooms.sweep().then((codes) => codes.length && console.log(`Expired rooms: ${codes.join(', ')}`));
}, 60_000).unref();

httpServer.listen(PORT, () => {
  console.log(`Haunted Village server listening on http://localhost:${PORT}`);
});
