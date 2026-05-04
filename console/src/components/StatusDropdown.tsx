import { operatorStatus } from '../state/store.js';
import { getWs } from '../wsBoot.js';
import type { OperatorStatus } from '../state/types.js';

const COLORS: Record<OperatorStatus, string> = {
  online: 'bg-green-500',
  away: 'bg-yellow-500',
  dnd: 'bg-red-500',
};

const LABELS: Record<OperatorStatus, string> = {
  online: 'Online',
  away: 'Away',
  dnd: 'Do not disturb',
};

export function StatusDropdown() {
  const status = operatorStatus.value;
  function change(next: OperatorStatus) {
    operatorStatus.value = next;
    getWs()?.send({ type: 'set_status', status: next });
  }
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${COLORS[status]}`} />
      <select
        value={status}
        onChange={(e) => change((e.target as HTMLSelectElement).value as OperatorStatus)}
        className="text-sm border border-slate-300 rounded px-2 py-1"
      >
        <option value="online">{LABELS.online}</option>
        <option value="away">{LABELS.away}</option>
        <option value="dnd">{LABELS.dnd}</option>
      </select>
    </div>
  );
}
