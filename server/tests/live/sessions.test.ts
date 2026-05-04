import { describe, it, expect } from 'vitest';
import { LiveSessions } from '../../src/live/sessions.js';

describe('LiveSessions', () => {
  it('add socket creates entry', () => {
    const ls = new LiveSessions();
    const fakeSocket = {} as any;
    ls.add('v_a', 's_1', fakeSocket, { url: '/x', title: 'X', enteredAt: 100 });
    const live = ls.get('v_a');
    expect(live?.sockets.size).toBe(1);
    expect(live?.activeSessionId).toBe('s_1');
    expect(live?.currentPage.url).toBe('/x');
  });
  it('add second socket appends + updates active', () => {
    const ls = new LiveSessions();
    ls.add('v_a', 's_1', {} as any, { url: '/x', title: 'X', enteredAt: 100 });
    ls.add('v_a', 's_2', {} as any, { url: '/y', title: 'Y', enteredAt: 200 });
    const live = ls.get('v_a');
    expect(live?.sockets.size).toBe(2);
    expect(live?.activeSessionId).toBe('s_2');
    expect(live?.currentPage.url).toBe('/y');
  });
  it('remove socket cleans entry when last', () => {
    const ls = new LiveSessions();
    const sock = {} as any;
    ls.add('v_a', 's_1', sock, { url: '/x', title: 'X', enteredAt: 100 });
    ls.remove('v_a', sock);
    expect(ls.get('v_a')).toBeUndefined();
  });
  it('list returns all live visitors', () => {
    const ls = new LiveSessions();
    ls.add('v_a', 's_1', {} as any, { url: '/x', title: 'X', enteredAt: 100 });
    ls.add('v_b', 's_2', {} as any, { url: '/y', title: 'Y', enteredAt: 200 });
    expect(ls.list()).toHaveLength(2);
  });
});
