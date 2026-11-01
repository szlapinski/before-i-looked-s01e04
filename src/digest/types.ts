export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: 'ok' | 'retry' | 'fail';
  // The latest reported error, retained even if a later run succeeds.
  lastError: string | null;
  // First and last records in log order, with their original timestamp offsets.
  firstAt: string;
  lastAt: string;
};

export type NightDigest = {
  // One row per job, sorted by job, shared by the page and JSON response.
  rows: DigestRow[];
  badLines: number;
};

// Type-only contract; the reader implementation belongs in src/digest/.
// A missing file returns null; an empty file returns no rows and zero bad lines.
export declare function readNight(runsDir: string, night: string): NightDigest | null;
