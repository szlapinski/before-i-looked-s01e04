import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { Status } from '../src/status.js';
import { StatusBoard } from '../src/views/status.js';

const status: Status = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  lastBeat: null,
  nights: [
    { night: '2026-10-28', counts: { ok: 3, retry: 1, fail: 1 } },
    { night: '2026-10-27', counts: { ok: 0, retry: 0, fail: 0 } },
  ],
};

async function render(boardStatus: Status) {
  const app = new Hono();
  app.get('/', (c) => c.html(<StatusBoard status={boardStatus} />));
  return (await app.request('/')).text();
}

describe('night links on the status board', () => {
  it('links every night and displays all three job outcomes', async () => {
    const html = await render(status);
    expect(html).toContain('href="/digest/2026-10-28">2026-10-28</a> · ok: 3 · retry: 1 · fail: 1');
    expect(html).toContain('href="/digest/2026-10-27">2026-10-27</a> · ok: 0 · retry: 0 · fail: 0');
    expect(html.indexOf('2026-10-28')).toBeLessThan(html.indexOf('2026-10-27'));
  });

  it('shows missing counts as dashes without dropping the night link', async () => {
    const html = await render({
      ...status,
      nights: [{ night: '2026-10-28', counts: null }],
    });
    expect(html).toContain('href="/digest/2026-10-28">2026-10-28</a> · ok: — · retry: — · fail: —');
  });

  it('preserves the no-nights message', async () => {
    const html = await render({ ...status, nights: [] });
    expect(html).toContain('nothing in runs/');
    expect(html).not.toContain('href="/digest/');
  });
});
