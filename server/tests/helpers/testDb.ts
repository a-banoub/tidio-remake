import { openDb, type DB } from '../../src/db/client.js';
import { migrate } from '../../src/db/migrate.js';
import { unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function makeTestDb(name: string): DB {
  const path = join(tmpdir(), `tidio-test-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  const db = openDb(path);
  migrate(db);
  return db;
}
