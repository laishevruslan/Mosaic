import * as Y from 'yjs';

export const FACILITATION_Y_KEY = 'wbFacilitation';
export const DEFAULT_VOTE_DOTS = 3;

export type VoteSnapshot = {
  id: string;
  maxDots: number;
  closed: boolean;
  startedAt: number;
  votes: Record<string, Record<string, number>>;
};

export function facilitationMap(doc: Y.Doc) {
  return doc.getMap(FACILITATION_Y_KEY);
}

function asYMap(value: unknown): Y.Map<unknown> | undefined {
  return value instanceof Y.Map ? value : undefined;
}

function readVotes(map: Y.Map<unknown>): Record<string, Record<string, number>> {
  const votes: Record<string, Record<string, number>> = {};
  const votesMap = asYMap(map.get('votes'));
  votesMap?.forEach((voter, voterId) => {
    const voterMap = asYMap(voter);
    if (!voterMap) return;
    const row: Record<string, number> = {};
    voterMap.forEach((count, blockId) => {
      if (typeof count === 'number' && count > 0) row[blockId] = count;
    });
    votes[voterId] = row;
  });
  return votes;
}

export function readVoteSession(doc: Y.Doc): VoteSnapshot | undefined {
  const map = facilitationMap(doc);
  const id = map.get('id');
  if (typeof id !== 'string' || !id) return;
  const maxDots = Number(map.get('maxDots'));
  return {
    id,
    maxDots: Number.isFinite(maxDots) && maxDots > 0 ? maxDots : DEFAULT_VOTE_DOTS,
    closed: map.get('closed') === true,
    startedAt: Number(map.get('startedAt')) || 0,
    votes: readVotes(map),
  };
}

export function startVoteSession(
  doc: Y.Doc,
  maxDots = DEFAULT_VOTE_DOTS,
  now = Date.now()
): VoteSnapshot {
  const map = facilitationMap(doc);
  doc.transact(() => {
    map.set('id', `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
    map.set('maxDots', maxDots);
    map.set('closed', false);
    map.set('startedAt', now);
    map.set('votes', new Y.Map());
  });
  const session = readVoteSession(doc);
  if (!session) {
    return {
      id: String(map.get('id') ?? ''),
      maxDots,
      closed: false,
      startedAt: now,
      votes: {},
    };
  }
  return session;
}

export function closeVoteSession(doc: Y.Doc) {
  const map = facilitationMap(doc);
  if (typeof map.get('id') !== 'string') return;
  map.set('closed', true);
}

export function clearVoteSession(doc: Y.Doc) {
  const map = facilitationMap(doc);
  doc.transact(() => {
    map.delete('id');
    map.delete('maxDots');
    map.delete('closed');
    map.delete('startedAt');
    map.delete('votes');
  });
}

export function voterUsedDots(session: VoteSnapshot, voterId: string) {
  const row = session.votes[voterId];
  if (!row) return 0;
  return Object.values(row).reduce((sum, count) => sum + count, 0);
}

export function tallyVotes(session: VoteSnapshot) {
  const totals: Record<string, number> = {};
  for (const row of Object.values(session.votes)) {
    for (const [blockId, count] of Object.entries(row)) {
      totals[blockId] = (totals[blockId] ?? 0) + count;
    }
  }
  return totals;
}

export function castVote(
  doc: Y.Doc,
  voterId: string,
  blockId: string
): boolean {
  const session = readVoteSession(doc);
  if (!session || session.closed || !voterId || !blockId) return false;
  if (voterUsedDots(session, voterId) >= session.maxDots) return false;

  const map = facilitationMap(doc);
  doc.transact(() => {
    let votes = asYMap(map.get('votes'));
    if (!votes) {
      votes = new Y.Map();
      map.set('votes', votes);
    }
    let voter = asYMap(votes.get(voterId));
    if (!voter) {
      voter = new Y.Map();
      votes.set(voterId, voter);
    }
    const current = Number(voter.get(blockId) ?? 0);
    voter.set(blockId, current + 1);
  });
  return true;
}

export function getDocYjs(store: unknown): Y.Doc | undefined {
  const doc = (store as { doc?: Y.Doc }).doc;
  if (doc && typeof doc.getMap === 'function') return doc;
  return;
}
