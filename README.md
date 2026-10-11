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

### NFC cards

Every card holds one URL: `https://<your game address>/tap?card=<random id>`. Make cards
at `/admin/cards` (Android Chrome writes them directly; on other phones it generates links
to write with an NFC app such as "NFC Tools"). Write cards from your **deployed https
address**, since the address is stored on the card.

- **In the lobby**, each player taps their own card to link it as their charm (🔮).
  Any card nobody linked counts as a relic during the match.
- **Android Chrome**: press "Enable card reader" once; taps are read inside the game.
  Web NFC only works on https addresses.
- **iPhone**: hold the card to the top of the phone and tap the banner; it opens `/tap`,
  which reports the tap and returns to the game. Play in Safari, not a home-screen icon.
- **No cards?** Leave "On-screen tap button" on, or use the dev panel to simulate taps.

### Join links and QR codes

The lobby QR code and share link use, in order: the `PUBLIC_URL` environment variable if
the server has one (e.g. `PUBLIC_URL=https://haunted.example.com npm start`), otherwise
the computer's Wi-Fi address when the host opened the game on `localhost`, otherwise the
address the host opened. The full link is printed under the QR code.

### Editing alarms

Every surprise alarm (danger texts, mission pairs, whisper clue wording, village-wide
alarms, timings and weights) lives in `server/src/alarms/alarms.config.ts`.

### Dev panel

Add `?dev=1` to the URL to get a "Dev tools" panel that simulates card taps (link a
charm, tap your charm, tap a relic, or any card id) and, during the day, fires any alarm
immediately. The dev server allows it; a production build refuses it unless started
with `HV_DEV=1`.

### Testing several players on one computer

Each player's seat is saved in the browser, so normal tabs share one seat. Add
`?as=<anything>` to give a tab its own seat, e.g. `http://localhost:5173/?as=ben`
and `http://localhost:5173/?as=cy`.
