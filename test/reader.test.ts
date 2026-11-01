import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

describe('night reader', () => {
  let runsDir: string;

  beforeEach(() => {
    runsDir = join(process.cwd(), `.reader-test-${randomUUID()}`);
    mkdirSync(runsDir);
  });

  afterEach(() => {
    rmSync(runsDir, { recursive: true, force: true });
  });

  function writeNight(lines: unknown[]): void {
    writeFileSync(join(runsDir, 'night.jsonl'), lines.map((line) => JSON.stringify(line)).join('\n'));
  }

  it('aggregates the read-only night fixture into five sorted jobs', () => {
    expect(readNight('runs', '2026-10-28')).toEqual({
      badLines: 1,
      rows: [
        {
          job: 'digest/render', owner: null, runs: 1, retries: 0,
          lastStatus: 'ok', lastError: null,
          firstAt: '2026-10-29T05:41:09+01:00', lastAt: '2026-10-29T05:41:09+01:00',
        },
        {
          job: 'fixtures/refresh', owner: 'rook', runs: 4, retries: 3,
          lastStatus: 'ok', lastError: 'upstream 503',
          firstAt: '2026-10-29T01:30:00+01:00', lastAt: '2026-10-29T01:37:00+01:00',
        },
        {
          job: 'lane/sync', owner: 'rook', runs: 8, retries: 1,
          lastStatus: 'ok', lastError: 'lock held',
          firstAt: '2026-10-28T23:00:06+01:00', lastAt: '2026-10-29T05:00:04+01:00',
        },
        {
          job: 'notes/backup', owner: 'lane-07', runs: 1, retries: 0,
          lastStatus: 'fail', lastError: 'quota exceeded',
          firstAt: '2026-10-29T04:00:01+01:00', lastAt: '2026-10-29T04:00:01+01:00',
        },
        {
          job: 'rig/rotate-logs', owner: 'lane-07', runs: 1, retries: 0,
          lastStatus: 'ok', lastError: null,
          firstAt: '2026-10-28T23:00:02+01:00', lastAt: '2026-10-28T23:00:02+01:00',
        },
      ],
    });
  });

  it('returns null for a missing file and an empty digest for an empty file', () => {
    expect(readNight(runsDir, 'missing')).toBeNull();
    expect(readNight(runsDir, '../.env')).toBeNull();
    writeFileSync(join(runsDir, 'night.jsonl'), '');
    expect(readNight(runsDir, 'night')).toEqual({ rows: [], badLines: 0 });
  });

  it('counts invalid JSON and invalid record shapes without losing valid runs', () => {
    const run = { at: '2026-10-28T23:00:02+01:00', job: 'job', status: 'ok', owner: null };
    const invalid = [
      null, [], 42, 'text', {}, { ...run, at: 42 }, { ...run, at: 'not a timestamp' },
      { ...run, job: '' }, { ...run, job: 42 }, { ...run, status: 'unknown' },
      { ...run, owner: 42 }, { at: run.at, job: run.job, status: run.status },
      { ...run, error: {} },
    ];
    const file = join(runsDir, 'night.jsonl');
    writeFileSync(file, `${JSON.stringify(run)}\n{broken\n\n${invalid.map((line) => JSON.stringify(line)).join('\n')}\n${JSON.stringify(run)}\n`);
    expect(readNight(runsDir, 'night')).toEqual({
      badLines: invalid.length + 2,
      rows: [{
        job: 'job', owner: null, runs: 2, retries: 0, lastStatus: 'ok', lastError: null,
        firstAt: run.at, lastAt: run.at,
      }],
    });
  });

  it('uses log order, preserves offsets and null owners, and keeps the latest reported error', () => {
    writeNight([
      { at: '2026-10-29T02:00:00+02:00', job: '__proto__', status: 'retry', owner: 'rook', error: 'first' },
      { at: '2026-10-29T01:30:00+01:00', job: '__proto__', status: 'fail', owner: 'rook', error: 'last' },
      { at: '2026-10-29T01:31:00+01:00', job: '__proto__', status: 'ok', owner: null },
    ]);
    expect(readNight(runsDir, 'night')).toEqual({
      badLines: 0,
      rows: [{
        job: '__proto__', owner: null, runs: 3, retries: 1, lastStatus: 'ok', lastError: 'last',
        firstAt: '2026-10-29T02:00:00+02:00', lastAt: '2026-10-29T01:31:00+01:00',
      }],
    });
  });

  it('accepts CRLF records without counting the trailing newline', () => {
    const run = { at: '2026-10-28T23:00:02+01:00', job: 'job', status: 'retry', owner: null };
    writeFileSync(join(runsDir, 'night.jsonl'), `${JSON.stringify(run)}\r\n${JSON.stringify(run)}\r\n`);
    expect(readNight(runsDir, 'night')?.badLines).toBe(0);
    expect(readNight(runsDir, 'night')?.rows[0].runs).toBe(2);
  });

  it('does not hide filesystem errors other than a missing file', () => {
    mkdirSync(join(runsDir, 'night.jsonl'));
    expect(() => readNight(runsDir, 'night')).toThrow();
  });
});
