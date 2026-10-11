# Haunted Village

A real-time party game for 4–12 players in one room: phones in the browser plus physical NFC cards.

## Layout

```
shared/   TypeScript types + Socket.IO event names used by both sides
server/   Node + Socket.IO, authoritative game state (src/game is pure, unit-tested)
client/   React + Vite + TypeScript mobile web app
```

## Run it locally

Requires Node 20+.

```bash
npm install
npm run dev        # server on :3001, client on http://localhost:5173
npm test           # server unit tests
npm run typecheck  # all packages
npm run build && npm start   # production: one server on :3001 serving the client
```

Phones on the same Wi-Fi can open the "Network" URL that Vite prints. Open that same
URL on the host's device too, so the lobby QR code points somewhere phones can reach.

### Editing alarms

Every surprise alarm (danger texts, mission pairs, whisper clue wording, village-wide
alarms, timings and weights) lives in `server/src/alarms/alarms.config.ts`.

### Dev panel

Add `?dev=1` to the URL to get a "Dev tools" panel during the day that fires any alarm
immediately. The dev server allows it; a production build refuses it unless started
with `HV_DEV=1`.

### Testing several players on one computer

Each player's seat is saved in the browser, so normal tabs share one seat. Add
`?as=<anything>` to give a tab its own seat, e.g. `http://localhost:5173/?as=ben`
and `http://localhost:5173/?as=cy`.
