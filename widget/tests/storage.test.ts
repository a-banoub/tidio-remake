import { describe, it, expect, beforeEach } from 'vitest';
import { ConvStore } from '../src/storage.js';

describe('ConvStore', () => {
  beforeEach(() => sessionStorage.clear());

  it('save + load roundtrip', () => {
    const store = new ConvStore();
    store.save({ messages: [{ id: 1, sender: 'visitor', body: 'hi', sent_at: 100 }], openedAt: 50 });
    const loaded = store.load();
    expect(loaded?.messages).toHaveLength(1);
  });

  it('clear removes', () => {
    const store = new ConvStore();
    store.save({ messages: [], openedAt: 0 });
    store.clear();
    expect(store.load()).toBeNull();
  });
});
