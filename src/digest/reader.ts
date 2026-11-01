import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, NightDigest } from './types.js';

type Run = {
  at: string;
  job: string;
  status: DigestRow['lastStatus'];
  owner: string | null;
  error?: string;
};

function parseRun(line: string): Run | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }

  if (
    typeof value !== 'object' || value === null || Array.isArray(value) ||
    !('at' in value) || typeof value.at !== 'string' ||
    !Number.isFinite(Date.parse(value.at)) ||
    !('job' in value) || typeof value.job !== 'string' || !value.job.trim() ||
    !('status' in value) ||
    (value.status !== 'ok' && value.status !== 'retry' && value.status !== 'fail') ||
    !('owner' in value) || (value.owner !== null && typeof value.owner !== 'string') ||
    ('error' in value && typeof value.error !== 'string')
  ) {
    return null;
  }

  return {
    at: value.at,
    job: value.job,
    status: value.status,
    owner: value.owner,
    ...('error' in value && typeof value.error === 'string' ? { error: value.error } : {}),
  };
}

export function readNight(runsDir: string, night: string): NightDigest | null {
  if (!/^[\w-]+$/.test(night)) return null;

  let contents: string;
  try {
    contents = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }

  const rows = new Map<string, DigestRow>();
  let badLines = 0;
  const lines = contents === '' ? [] : contents.split(/\r?\n/);
  // A final newline terminates the last record; it isn't an extra bad line.
  if (lines.at(-1) === '') lines.pop();

  for (const line of lines) {
    const run = parseRun(line);
    if (!run) {
      badLines++;
      continue;
    }

    const row = rows.get(run.job);
    if (row) {
      row.runs++;
      if (run.status === 'retry') row.retries++;
      row.owner = run.owner;
      row.lastStatus = run.status;
      if (run.error !== undefined) row.lastError = run.error;
      row.lastAt = run.at;
    } else {
      rows.set(run.job, {
        job: run.job,
        owner: run.owner,
        runs: 1,
        retries: run.status === 'retry' ? 1 : 0,
        lastStatus: run.status,
        lastError: run.error ?? null,
        firstAt: run.at,
        lastAt: run.at,
      });
    }
  }

  return {
    rows: [...rows.values()].sort((a, b) => a.job < b.job ? -1 : a.job > b.job ? 1 : 0),
    badLines,
  };
}
