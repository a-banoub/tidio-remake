import { Router } from 'express';
import { OperatorsRepo } from '../repositories/operators.js';
import type { ServerDeps } from '../server.js';
import { requireOperator, type OperatorAuthRequest } from './operatorAuth.js';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const TIMEZONE = /^[A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?$/;

export function settingsRouter(deps: ServerDeps) {
  const router = Router();
  const ops = new OperatorsRepo(deps.db);

  router.use(requireOperator(deps));

  router.put('/', (req: OperatorAuthRequest, res) => {
    const { quiet_hours_start, quiet_hours_end, timezone } = req.body ?? {};
    // Validate
    if (quiet_hours_start != null && quiet_hours_start !== '' && !HHMM.test(String(quiet_hours_start))) {
      return res.status(400).json({ error: 'bad_quiet_hours_start' });
    }
    if (quiet_hours_end != null && quiet_hours_end !== '' && !HHMM.test(String(quiet_hours_end))) {
      return res.status(400).json({ error: 'bad_quiet_hours_end' });
    }
    if (timezone != null && !TIMEZONE.test(String(timezone))) {
      return res.status(400).json({ error: 'bad_timezone' });
    }

    // Apply
    if (quiet_hours_start !== undefined || quiet_hours_end !== undefined) {
      ops.setQuietHours(req.operatorId!,
        quiet_hours_start === '' ? null : (quiet_hours_start ?? null),
        quiet_hours_end === '' ? null : (quiet_hours_end ?? null));
    }
    if (timezone !== undefined) {
      deps.db.prepare('UPDATE operators SET timezone = ? WHERE id = ?').run(timezone, req.operatorId!);
    }
    return res.json({ ok: true });
  });

  return router;
}
