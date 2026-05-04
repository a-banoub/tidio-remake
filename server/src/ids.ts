import { randomBytes } from 'node:crypto';
const hex = (n: number) => randomBytes(n).toString('hex');
export const newVisitorId = () => `v_${hex(6)}`;
export const newSessionId = () => `s_${hex(6)}`;
export const newConversationId = () => `c_${hex(8)}`;
export const newToken = () => hex(32);
