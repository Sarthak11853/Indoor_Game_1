// localStorage can be missing or throw (private mode, blocked storage),
// so every access is wrapped. The game still works, it just can't rejoin.

/** ?as=<name> gives each browser tab its own saved seat, for testing several players on one computer. */
const profile = new URLSearchParams(location.search).get('as') ?? '';
const key = (name: string) => `hv.${name}${profile ? `.${profile}` : ''}`;

export function load<T>(name: string): T | null {
  try {
    const raw = localStorage.getItem(key(name));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function save(name: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key(name));
    else localStorage.setItem(key(name), JSON.stringify(value));
  } catch {
    // Storage unavailable: nothing to do.
  }
}
