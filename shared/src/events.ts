// Socket.IO event names and payloads. Both sides import these interfaces,
// so a renamed or reshaped event is a compile error on both ends.
import type { AlarmKind, ClientView, RelicReward, Session, Settings } from './types';

export type AckResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };
export type Ack<T extends object = object> = (res: AckResult<T>) => void;

/** POST /api/tap body: the /tap page (iPhone, or Android with the game closed) reports a card tap. */
export interface TapRequest {
  code: string;
  token: string;
  cardId: string;
}

/** GET /api/public-url: where phones should be sent to join. */
export interface PublicUrlInfo {
  /** Set by the PUBLIC_URL environment variable on the server. */
  publicUrl: string | null;
  /** The server machine's Wi-Fi/LAN addresses, for dev on a local network. */
  lanAddresses: string[];
}

export interface ClientToServerEvents {
  'room:create': (p: { name: string }, ack: Ack<{ session: Session }>) => void;
  'room:join': (p: { code: string; name: string }, ack: Ack<{ session: Session }>) => void;
  'room:resume': (p: { code: string; token: string }, ack: Ack<{ session: Session }>) => void;
  'room:leave': (ack: Ack) => void;
  'lobby:reorder': (p: { order: string[] }, ack: Ack) => void;
  'lobby:settings': (p: Partial<Settings>, ack: Ack) => void;
  'lobby:kick': (p: { playerId: string }, ack: Ack) => void;
  'game:start': (ack: Ack) => void;
  'game:ready': (ack: Ack) => void;
  /** On-screen charm tap (NFC taps arrive through the card layer in a later milestone). */
  'game:charm': (ack: Ack) => void;
  /** Night target or vote suspect, depending on the phase. */
  'game:pick': (p: { targetId: string }, ack: Ack) => void;
  'game:skipDay': (ack: Ack) => void;
  'game:missionDone': (p: { alarmId: string }, ack: Ack) => void;
  /** On-screen relic tap during a relic race (real relic cards come with the NFC layer). */
  'game:relic': (ack: Ack) => void;
  'game:relicReward': (p: RelicReward, ack: Ack) => void;
  'spirit:hint': (p: { targetId: string; text: string }, ack: Ack) => void;
  'spirit:haunt': (p: { targetId: string }, ack: Ack) => void;
  /** A physical NFC card was tapped (via Web NFC, the /tap page or the dev panel). */
  'card:tap': (p: { cardId: string }, ack: Ack<{ message: string }>) => void;
  /** Development only: fire an alarm now. Refused by production servers. */
  'dev:alarm': (p: { kind: AlarmKind }, ack: Ack) => void;
  'game:playAgain': (ack: Ack) => void;
}

export interface ServerToClientEvents {
  /** Full view for this player: public state plus their own private state. */
  view: (view: ClientView) => void;
  /** This player was removed from the room by the host. */
  kicked: () => void;
}
