import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir: '',
};

const night = '2026-10-28';
const validLine = JSON.stringify({
  at: '2026-10-28T07:15:00+01:00',
  job: 'backup',
  status: 'ok',
  owner: 'ops',
});

async function requestDigest(path: string, fileContents: string | null): Promise<Response> {
  const runsDir = mkdtempSync(join(process.cwd(), 'test', '.digest-runs-'));

  try {
    if (fileContents !== null) {
      writeFileSync(join(runsDir, `${night}.jsonl`), fileContents);
    }

    return await createApp({ ...config, runsDir }).request(path);
  } finally {
    rmSync(runsDir, { recursive: true, force: true });
  }
}

describe.each([
  {
    name: 'HTML digest',
    path: `/digest/${night}`,
    readBody: async (response: Response) => response.text(),
  },
  {
    name: 'JSON digest',
    path: `/api/digest/${night}`,
    readBody: async (response: Response) => response.json(),
  },
])('$name route', ({ path, readBody }) => {
  it('returns 200 for a night with data', async () => {
    const response = await requestDigest(path, `${validLine}\n`);

    expect(response.status).toBe(200);
    const body = await readBody(response);
    expect(JSON.stringify(body)).toContain('backup');
  });

  it('returns 404 when the night file is missing', async () => {
    const response = await requestDigest(path, null);

    expect(response.status).toBe(404);
  });

  it('handles an empty night', async () => {
    const response = await requestDigest(path, '');

    expect(response.status).toBe(200);
    const body = await readBody(response);
    if (path.startsWith('/api/')) {
      expect(body).toMatchObject({ rows: [], badLines: 0 });
    } else {
      expect(body).toContain('nothing ran');
    }
  });

  it('keeps serving a night when a JSONL line is malformed', async () => {
    const response = await requestDigest(path, `${validLine}\nnot JSON\n`);

    expect(response.status).toBe(200);
    const body = await readBody(response);
    expect(JSON.stringify(body)).toContain('backup');
    if (path.startsWith('/api/')) {
      expect(body).toMatchObject({
        rows: [{ job: 'backup' }],
        badLines: 1,
      });
    }
  });
});
