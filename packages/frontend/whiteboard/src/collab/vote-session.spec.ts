import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import {
  castVote,
  clearVoteSession,
  closeVoteSession,
  readVoteSession,
  startVoteSession,
  tallyVotes,
  voterUsedDots,
} from './vote-session';

describe('dot voting Yjs session', () => {
  it('survives a reload of the same Y.Doc and caps dots per voter', () => {
    const doc = new Y.Doc();
    const session = startVoteSession(doc, 3, 1_000);
    expect(session.maxDots).toBe(3);
    expect(castVote(doc, 'ada', 'sticky-1')).toBe(true);
    expect(castVote(doc, 'ada', 'sticky-1')).toBe(true);
    expect(castVote(doc, 'ada', 'sticky-2')).toBe(true);
    expect(castVote(doc, 'ada', 'sticky-3')).toBe(false);

    const update = Y.encodeStateAsUpdate(doc);
    const restored = new Y.Doc();
    Y.applyUpdate(restored, update);
    const loaded = readVoteSession(restored);
    expect(loaded?.id).toBe(session.id);
    expect(voterUsedDots(loaded!, 'ada')).toBe(3);
    expect(tallyVotes(loaded!)).toEqual({ 'sticky-1': 2, 'sticky-2': 1 });

    closeVoteSession(restored);
    expect(readVoteSession(restored)?.closed).toBe(true);
    expect(castVote(restored, 'bob', 'sticky-1')).toBe(false);

    clearVoteSession(restored);
    expect(readVoteSession(restored)).toBeUndefined();
  });
});
