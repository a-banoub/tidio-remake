import { describe, it, expect, afterEach } from 'vitest';
import { openDb } from '../../src/db/client.js';
import { migrate } from '../../src/db/migrate.js';
import { unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TEST_DB = join(tmpdir(), 'tidio-test-migrate.db');

afterEach(() => {
  for (const ext of ['', '-wal', '-shm']) {
    try { unlinkSync(TEST_DB + ext); } catch {}
  }
});

describe('migrate', () => {
  it('creates all tables on fresh db', () => {
    const db = openDb(TEST_DB);
    migrate(db);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name);
    for (const t of ['visitors', 'sessions', 'messages', 'operators', 'conversations', 'page_views', 'lead_signals', 'push_subscriptions', 'operator_tokens', 'quick_replies']) {
      expect(tables).toContain(t);
    }
    db.close();
  });

  it('is idempotent', () => {
    const db = openDb(TEST_DB);
    migrate(db);
    migrate(db);
    expect((db.prepare('SELECT COUNT(*) as c FROM migrations').get() as any).c).toBe(2);
    db.close();
  });
});
