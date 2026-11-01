import { readdirSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readNight } from '../src/digest/reader.js';
import type { DigestRow } from '../src/digest/types.js';
import { readStatus } from '../src/status.js';

vi.mock('node:fs', () => ({ readdirSync: vi.fn() }));
vi.mock('../src/digest/reader.js', () => ({ readNight: vi.fn() }));

const config = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir: 'board-test-runs',
};

function row(job: string, lastStatus: DigestRow['lastStatus']): DigestRow {
  return {
    job,
    owner: null,
    runs: 10,
    retries: 7,
    lastStatus,
    lastError: null,
    firstAt: '2026-10-28T00:00:00+01:00',
    lastAt: '2026-10-28T01:00:00+01:00',
  };
}

describe('status night counts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(readdirSync).mockReturnValue([
      '2026-10-27.jsonl', 'unrelated.jsonl', '2026-10-28.jsonl',
    ] as unknown as ReturnType<typeof readdirSync>);
  });

  it('uses the shared reader and counts one last outcome per job, newest night first', () => {
    vi.mocked(readNight).mockImplementation((_runsDir, night) => ({
      rows: night === '2026-10-28'
        ? [row('a', 'ok'), row('b', 'retry'), row('c', 'fail'), row('d', 'ok')]
        : [row('e', 'fail')],
      badLines: 3,
    }));

    expect(readStatus(config).nights).toEqual([
      { night: '2026-10-28', counts: { ok: 2, retry: 1, fail: 1 } },
      { night: '2026-10-27', counts: { ok: 0, retry: 0, fail: 1 } },
    ]);
    expect(readNight).toHaveBeenNthCalledWith(1, config.runsDir, '2026-10-28');
    expect(readNight).toHaveBeenNthCalledWith(2, config.runsDir, '2026-10-27');
  });

  it('distinguishes an empty digest from a file removed after listing', () => {
    vi.mocked(readNight)
      .mockReturnValueOnce({ rows: [], badLines: 0 })
      .mockReturnValueOnce(null);
    expect(readStatus(config).nights).toEqual([
      { night: '2026-10-28', counts: { ok: 0, retry: 0, fail: 0 } },
      { night: '2026-10-27', counts: null },
    ]);
  });

  it('does not read digests when the runs directory is unavailable', () => {
    vi.mocked(readdirSync).mockImplementation(() => { throw new Error('missing directory'); });
    expect(readStatus(config).nights).toEqual([]);
    expect(readNight).not.toHaveBeenCalled();
  });
});
