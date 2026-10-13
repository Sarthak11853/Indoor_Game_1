# Haunted Village

A real-time party game for **4–12 friends in one room**. Everyone plays on their own phone
in the browser (no install), with **physical NFC cards**: each player holds a *charm*, and a
few *relics* lie face-down on the table. A match lasts 10–15 minutes.

Villagers try to find the **Possessed** before the midnight clock strikes. Surprise alarms
keep everyone on edge: danger alarms, secret missions, whispered clues, blackouts, seat swaps
and relic races. The fallen return as **Spirits** who whisper hints or haunt the living.

**Play it online:** see [DEPLOY.md](DEPLOY.md) for free hosting on Render.

## How a round works

1. **Role reveal**: each phone privately shows *Villager* or *Possessed* (1 per 4 players).
2. **Night**: everyone taps their charm and picks a player. The Possessed choose a victim;
   Villagers choose whom to protect (2 protectors save the victim, 1 when ≤5 are alive).
3. **Morning**: the app reveals who was taken.
4. **Day**: talk it out while surprise alarms fire.
5. **Vote**: most votes is cast out and their role is revealed; ties save everyone.

Villagers win when every Possessed is out. The Possessed win when they equal the Villagers
or when the midnight clock (default 12 min) runs out.

## Run it locally

Requires Node 20+.

```bash
npm install
npm run dev      # client on http://localhost:5173, server on :3001
npm test         # server tests (game rules, alarms, cards, sockets)
npm run typecheck
npm run build && npm start   # production build on http://localhost:3001
```

Phones on the same Wi-Fi can join: the lobby QR code automatically uses your computer's
Wi-Fi address.

**Testing alone:** add `?as=<name>` to give each browser tab its own player, e.g.
`/?as=ana`, `/?as=ben`. Add `&dev=1` for a dev panel (development only) that simulates card
taps and fires any alarm on demand.

## NFC cards

Each card stores one link, `https://<game address>/tap?card=<random id>`. Cards are
interchangeable: in the lobby each player taps a card to make it *their charm*; any card
nobody claimed is a *relic*. Write cards at `/admin/cards` (see [DEPLOY.md](DEPLOY.md)).

- **Android (Chrome, https):** press "Enable card reader" once; taps are read in the game.
- **iPhone:** hold the card to the top of the phone and tap the banner; the `/tap` page
  reports the tap and returns to the game. Play in Safari, not from a home-screen icon.
- **No cards:** keep "On-screen tap button" on in the lobby settings.

## Customising

| What | Where |
|---|---|
| All alarm texts, missions, clue wording, timings and weights | `server/src/alarms/alarms.config.ts` |
| Default match lengths and limits | `shared/src/types.ts` (`DEFAULT_SETTINGS`, `PHASE_SECONDS`) |
| Sounds (synthesised, no files) | `client/src/fx/sound.ts` |
| Colours and effects | `client/src/styles.css` |

| Environment variable | Purpose |
|---|---|
| `PORT` | Port to listen on (default 3001). |
| `PUBLIC_URL` | Address used in QR codes and share links (Render's address is detected automatically). |
| `HV_DEV=1` | Allow the dev alarm trigger on a production build. |

## Project layout

```
shared/   Types and Socket.IO event names shared by both sides; NFC card id helpers
server/   Node + Express + Socket.IO. The server is authoritative.
  src/game/     Pure state machine (lobby → reveal → night → morning → day → vote → result)
  src/alarms/   Surprise alarm engine + alarms.config.ts
  src/rooms/    Room store interface (in-memory now, Redis-ready) and room service
  src/net/      Socket handlers, timers, /api/tap
client/   React + Vite + TypeScript PWA
  src/nfc/      The only NFC code: onCardTapped(cardId), Web NFC, card helpers
  src/screens/  Lobby and one screen per phase
  src/pages/    /tap (iPhone card route) and /admin/cards (card writer)
  src/fx/       Animations, particles, sounds
```

**Privacy:** the server sends each phone only its own private view (`server/src/game/view.ts`);
other players' roles never leave the server until they are out or the game ends.
