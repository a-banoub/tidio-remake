import Database from 'better-sqlite3';
import { logger } from '../logger.js';

export type DB = Database.Database;

export function openDb(path: string): DB {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  logger.info({ path }, 'database opened');
  return db;
}
