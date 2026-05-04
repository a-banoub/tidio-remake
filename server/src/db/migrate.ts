import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DB } from './client.js';
import { logger } from '../logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'migrations');

export function migrate(db: DB): void {
  db.exec('CREATE TABLE IF NOT EXISTS migrations (id INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)');
  const applied = new Set(db.prepare('SELECT id FROM migrations').all().map((r: any) => r.id));
  const files = readdirSync(MIGRATIONS_DIR).filter(f => /^\d{3}-.*\.sql$/.test(f)).sort();
  for (const file of files) {
    const id = parseInt(file.slice(0, 3), 10);
    if (applied.has(id)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    try {
      db.transaction(() => {
        db.exec(sql);
        db.prepare('INSERT INTO migrations (id, applied_at) VALUES (?, ?)').run(id, Date.now());
      })();
    } catch (err) {
      logger.error({ id, file, err }, 'migration failed');
      throw err;
    }
    logger.info({ id, file }, 'migration applied');
  }
}
