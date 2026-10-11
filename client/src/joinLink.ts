import { useEffect, useState } from 'react';
import type { PublicUrlInfo } from '@hv/shared';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];
export const isLocalHost = (hostname: string) => LOCAL_HOSTS.includes(hostname);

/** Prefer home-network style addresses (192.168.x.x, 10.x.x.x) over others such as Docker's. */
const rank = (ip: string) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : 2);

/**
 * The address other phones should use to reach this game:
 * the server's PUBLIC_URL if set; else, when this page is on localhost, the
 * computer's Wi-Fi address; else simply the address this page was opened from.
 */
export function publicBase(info: PublicUrlInfo | null): string {
  if (info?.publicUrl) return info.publicUrl.replace(/\/+$/, '');
  const lan = [...(info?.lanAddresses ?? [])].sort((a, b) => rank(a) - rank(b))[0];
  if (isLocalHost(location.hostname) && lan) return `${location.protocol}//${lan}${location.port ? `:${location.port}` : ''}`;
  return location.origin;
}

/** The public base address, or null while it is still being looked up. */
export function usePublicBase(): string | null {
  const [base, setBase] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/public-url')
      .then((r) => r.json() as Promise<PublicUrlInfo>)
      .then((info) => setBase(publicBase(info)))
      .catch(() => setBase(publicBase(null)));
  }, []);
  return base;
}
