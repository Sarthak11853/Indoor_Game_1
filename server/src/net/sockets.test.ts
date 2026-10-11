import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import type { AckResult, ClientToServerEvents, ClientView, ServerToClientEvents, Session } from '@hv/shared';
import { createGameServer } from '../app';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

let server: ReturnType<typeof createGameServer>;
let url: string;
const clients: Client[] = [];

beforeEach(async () => {
  server = createGameServer();
  await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
  url = `http://localhost:${(server.httpServer.address() as AddressInfo).port}`;
});

afterEach(async () => {
  clients.splice(0).forEach((c) => c.disconnect());
  await server.io.close();
});

async function client() {
  const c: Client = connect(url, { transports: ['websocket'], forceNew: true });
  clients.push(c);
  await new Promise<void>((resolve) => c.once('connect', () => resolve()));
  return c;
}

/** Resolve with the next view this client receives that matches the check. */
function nextView(c: Client, check: (v: ClientView) => boolean = () => true) {
  return new Promise<ClientView>((resolve) => {
    const handler = (v: ClientView) => {
      if (!check(v)) return;
      c.off('view', handler);
      resolve(v);
    };
    c.on('view', handler);
  });
}

function ok<T extends object>(res: AckResult<T>) {
  if (!res.ok) throw new Error(res.error);
  return res;
}

const create = (c: Client, name: string) =>
  new Promise<Session>((r) => c.emit('room:create', { name }, (res) => r(ok(res).session)));
const join = (c: Client, code: string, name: string) =>
  new Promise<AckResult<{ session: Session }>>((r) => c.emit('room:join', { code, name }, r));
const resume = (c: Client, s: Session) =>
  new Promise<AckResult<{ session: Session }>>((r) => c.emit('room:resume', { code: s.code, token: s.token }, r));

describe('lobby over sockets', () => {
  it('shows everyone the same seating, with each phone knowing who it is', async () => {
    const ana = await client();
    const host = await create(ana, 'Ana');
    const ben = await client();
    const anaSeesBen = nextView(ana, (v) => v.public.players.length === 2);
    const benSession = ok(await join(ben, host.code, 'Ben')).session;
    const view = await anaSeesBen;
    expect(view.public.players.map((p) => p.name)).toEqual(['Ana', 'Ben']);
    expect(view.me.playerId).toBe(host.playerId);
    expect(benSession.playerId).not.toBe(host.playerId);
  });

  it('marks a dropped phone as disconnected and gives the seat back on resume', async () => {
    const ana = await client();
    const host = await create(ana, 'Ana');
    let ben = await client();
    const benSession = ok(await join(ben, host.code, 'Ben')).session;

    const gone = nextView(ana, (v) => v.public.players[1]?.connected === false);
    ben.disconnect();
    await gone;

    ben = await client();
    const back = nextView(ana, (v) => v.public.players[1]?.connected === true);
    const res = ok(await resume(ben, benSession));
    expect(res.session.playerId).toBe(benSession.playerId);
    expect((await back).public.players.map((p) => p.name)).toEqual(['Ana', 'Ben']);
  });

  it('lets the host reorder seats and kick, and tells the kicked phone', async () => {
    const ana = await client();
    const host = await create(ana, 'Ana');
    const ben = await client();
    const benSession = ok(await join(ben, host.code, 'Ben')).session;

    const reordered = nextView(ben, (v) => v.public.players[0]?.name === 'Ben');
    await new Promise((r) => ana.emit('lobby:reorder', { order: [benSession.playerId, host.playerId] }, r));
    await reordered;

    const kicked = new Promise((r) => ben.once('kicked', () => r(true)));
    await new Promise((r) => ana.emit('lobby:kick', { playerId: benSession.playerId }, r));
    expect(await kicked).toBe(true);
    expect((await resume(ben, benSession)).ok).toBe(false);
  });

  it('starts a match where each phone learns only its own role', async () => {
    const phones = [await client()];
    const host = await create(phones[0], 'Ana');
    for (const name of ['Ben', 'Cy', 'Dee']) {
      const c = await client();
      ok(await join(c, host.code, name));
      phones.push(c);
    }
    const reveals = phones.map((c) => nextView(c, (v) => v.public.phase === 'reveal'));
    ok(await new Promise<AckResult>((r) => phones[0].emit('game:start', r)));
    const views = await Promise.all(reveals);

    expect(views.filter((v) => v.me.role === 'possessed')).toHaveLength(1);
    for (const v of views) {
      expect(v.me.role).not.toBeNull();
      expect(v.public.players.every((p) => p.role === undefined)).toBe(true);
    }

    const nights = phones.map((c) => nextView(c, (v) => v.public.phase === 'night'));
    for (const c of phones) ok(await new Promise<AckResult>((r) => c.emit('game:ready', r)));
    expect((await Promise.all(nights)).every((v) => v.public.round === 1 && v.public.midnightAt)).toBe(true);
  });

  it('refuses dev tools when they are switched off', async () => {
    await server.io.close();
    server = createGameServer(undefined, false);
    await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
    url = `http://localhost:${(server.httpServer.address() as AddressInfo).port}`;
    const ana = await client();
    await create(ana, 'Ana');
    const res = await new Promise<AckResult>((r) => ana.emit('dev:alarm', { kind: 'danger' }, r));
    expect(res).toEqual({ ok: false, error: 'Dev tools are off.' });
  });

  it('rejects host actions from non-hosts and malformed payloads', async () => {
    const ana = await client();
    const host = await create(ana, 'Ana');
    const ben = await client();
    ok(await join(ben, host.code, 'Ben'));
    const res = await new Promise<AckResult>((r) => ben.emit('lobby:settings', { daySeconds: 60 }, r));
    expect(res).toEqual({ ok: false, error: 'Only the host can do that.' });
    const bad = await new Promise<AckResult>((r) => ana.emit('lobby:reorder', null as never, r));
    expect(bad.ok).toBe(false);
  });
});
