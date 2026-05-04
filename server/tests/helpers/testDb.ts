import { afterEach } from 'vitest';
import { openDb, type DB } from '../../src/db/client.js';
import { migrate } from '../../src/db/migrate.js';
import { unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const created: { db: DB; path: string }[] = [];

afterEach(() => {
  while (created.length) {
    const { db, path } = created.pop()!;
    try { db.close(); } catch {}
    for (const ext of ['', '-wal', '-shm']) {
      try { unlinkSync(path + ext); } catch {}
    }
  }
});

export function makeTestDb(name: string): DB {
  const path = join(tmpdir(), `tidio-test-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  const db = openDb(path);
  migrate(db);
  created.push({ db, path });
  return db;
}
