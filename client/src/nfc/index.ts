// The NFC layer. The rest of the app only uses onCardTapped(cardId) and the
// small helpers below; how a tap arrives (Web NFC, the /tap page, the dev
// panel) never matters to the game.
import { useSyncExternalStore } from 'react';
import { parseCardId } from '@hv/shared';
import { actions } from '../game';

export interface NfcState {
  /** Web NFC is available here (Android Chrome over HTTPS). */
  supported: boolean;
  /** We are listening for cards right now. */
  active: boolean;
  error: string | null;
  /** Feedback for the most recent tap, shown briefly as a toast. */
  lastTap: { ok: boolean; message: string; at: number } | null;
}

let state: NfcState = {
  supported: typeof window !== 'undefined' && 'NDEFReader' in window,
  active: false,
  error: null,
  lastTap: null,
};
const listeners = new Set<() => void>();
const set = (patch: Partial<NfcState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export function useNfc(): NfcState {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
  );
}

/** The single entry point for every card tap. */
export async function onCardTapped(cardId: string) {
  const res = await actions.cardTap(cardId);
  set({ lastTap: { ok: res.ok, message: res.ok ? res.message : res.error, at: Date.now() } });
  return res;
}

/** Finds a card id in an NDEF message: a URL record (…/tap?card=ID) or a plain text id. */
export function cardIdFromMessage(message: NDEFMessage): string | null {
  for (const record of message.records) {
    if (!record.data || !['url', 'absolute-url', 'text'].includes(record.recordType)) continue;
    const id = parseCardId(new TextDecoder(record.encoding ?? 'utf-8').decode(record.data));
    if (id) return id;
  }
  return null;
}

let reader: NDEFReader | null = null;
let lastRead = { id: '', at: 0 };

/** Start listening for cards. The first time, this must run from a button press. */
export async function startNfc(): Promise<void> {
  if (!state.supported || state.active) return;
  try {
    reader = new NDEFReader();
    await reader.scan();
    reader.onreading = (event) => {
      const id = cardIdFromMessage(event.message);
      if (!id) return set({ lastTap: { ok: false, message: 'That card is not a Haunted Village card.', at: Date.now() } });
      // A card held against the phone can be read several times in a row.
      if (id === lastRead.id && Date.now() - lastRead.at < 1500) return;
      lastRead = { id, at: Date.now() };
      try {
        navigator.vibrate?.(60);
      } catch {
        // No vibration here: fine.
      }
      void onCardTapped(id);
    };
    reader.onreadingerror = () => set({ lastTap: { ok: false, message: 'Could not read that card. Try again.', at: Date.now() } });
    set({ active: true, error: null });
  } catch (err) {
    set({ error: err instanceof Error && err.name === 'NotAllowedError' ? 'NFC permission was denied.' : 'Could not start NFC.' });
  }
}

/** Restart listening after a refresh if the player already granted NFC permission. */
export async function resumeNfcIfGranted() {
  if (!state.supported) return;
  try {
    const status = await navigator.permissions.query({ name: 'nfc' as PermissionName });
    if (status.state === 'granted') await startNfc();
  } catch {
    // Permission query unsupported: wait for the player to press the button.
  }
}

/** Why the card reader is unavailable on this phone, in plain words (null if it is available). */
export function nfcUnavailableReason(): string | null {
  if (state.supported) return null;
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) {
    return 'On iPhone, hold your charm to the top of the phone and tap the banner that appears. Play in Safari, not from a home-screen icon.';
  }
  if (/Android/.test(ua) && !window.isSecureContext) return 'The card reader needs a secure (https) address.';
  if (/Android/.test(ua)) return 'The card reader needs Chrome on Android.';
  return 'No card reader on this device. Use the on-screen buttons.';
}
