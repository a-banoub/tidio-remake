import { loadEnv } from './env.js';
import { openDb } from './db/client.js';
import { migrate } from './db/migrate.js';
import { LiveSessions } from './live/sessions.js';
import { PhaseTransitionTimers } from './timers/phaseTransition.js';
import { createServer } from './server.js';
import { logger } from './logger.js';
import { loadGeoDb } from './geo/lookup.js';

const env = loadEnv();
await loadGeoDb(env.GEOIP_DB_PATH || null);
const db = openDb(env.DATABASE_PATH);
migrate(db);
const ls = new LiveSessions();
const timers = new PhaseTransitionTimers();
const server = createServer({ db, ls, timers, env });
server.listen(env.PORT, () => logger.info({ port: env.PORT }, 'tidio-remake server up'));
