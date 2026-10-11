// NFC card ids and URLs, shared by the server, the phone app and the card writer.
// Each physical card stores one NDEF URL record: https://<host>/tap?card=<cardId>.
// Ids are random and carry no meaning; the server decides per room what a card is.

export const CARD_ID_PATTERN = /^[A-Za-z0-9_-]{4,32}$/;
const ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export function randomCardId(length = 10): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join('');
}

export function cardUrl(base: string, cardId: string): string {
  return `${base.replace(/\/+$/, '')}/tap?card=${encodeURIComponent(cardId)}`;
}

/** Accepts a full card URL or a bare id; returns the id, or null if it isn't one. */
export function parseCardId(text: string): string | null {
  const trimmed = text.trim();
  let id: string | null = trimmed;
  try {
    id = new URL(trimmed).searchParams.get('card');
  } catch {
    // Not a URL: treat it as a bare id.
  }
  return id && CARD_ID_PATTERN.test(id) ? id : null;
}
