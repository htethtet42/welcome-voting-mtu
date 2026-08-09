import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Category, ElectionState, AuditEntry, Candidate, VoteRecord } from '../types';
import { INITIAL_VOTES, INITIAL_ELECTION, CANDIDATES as SEED_CANDIDATES } from '../data';

interface ElectionContextType {
  election: ElectionState;
  candidates: Candidate[];
  voteCounts: Record<string, number>;
  voteRecords: VoteRecord[];
  auditLog: AuditEntry[];
  darkMode: boolean;

  // Voter actions
  castVote: (candidateId: string, category: Category, voter: { id: string; name: string; email: string }) => 'success' | 'already_voted' | 'closed' | 'not_eligible';

  // Admin actions
  openElection: (actorName: string, autoCloseMinutes?: number) => void;
  closeElection: (actorName: string) => void;
  publishResults: (actorName: string) => void;
  addCandidate: (candidate: Omit<Candidate, 'id'>, actorName: string) => void;
  updateCandidate: (id: string, updates: Partial<Candidate>, actorName: string) => void;
  toggleCandidateActive: (id: string, actorName: string) => void;
  resetVotes: (actorName: string) => void;

  toggleDarkMode: () => void;

  // Computed
  totalVotes: number;
  winners: Record<Category, Candidate | null>;
}

const ElectionContext = createContext<ElectionContextType | null>(null);

function load<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : fallback;
  } catch { return fallback; }
}

function makeAuditEntry(actor: string, action: string, details: string): AuditEntry {
  return { id: crypto.randomUUID(), actor, action, details, timestamp: new Date() };
}

export function ElectionProvider({ children }: { children: ReactNode }) {
  const [election, setElection] = useState<ElectionState>(() => {
    const stored = load<ElectionState | null>('mtu_election', null);
    if (!stored) return INITIAL_ELECTION;
    return { 
      ...stored, 
      opensAt: stored.opensAt ? new Date(stored.opensAt) : null, 
      closesAt: stored.closesAt ? new Date(stored.closesAt) : null, 
      publishedAt: stored.publishedAt ? new Date(stored.publishedAt) : null 
    };
  });

  const [candidates, setCandidates] = useState<Candidate[]>(() =>
    load<Candidate[]>('mtu_candidates_v2', SEED_CANDIDATES).map(candidate => {
      // Repair data saved by older versions where the Style and Smart categories were reversed.
      if (candidate.id.startsWith('smart-')) return { ...candidate, category: 'smart' };
      if (candidate.id.startsWith('style-')) return { ...candidate, category: 'style' };
      return candidate;
    })
  );

  const [voteCounts, setVoteCounts] = useState<Record<string, number>>(() =>
    load('mtu_votes', INITIAL_VOTES)
  );

  const [voteRecords, setVoteRecords] = useState<VoteRecord[]>(() =>
    load<VoteRecord[]>('mtu_vote_records', []).map(record => ({ ...record, createdAt: new Date(record.createdAt) }))
  );

  const [auditLog, setAuditLog] = useState<AuditEntry[]>(() => {
    const stored = load<AuditEntry[]>('mtu_audit', []);
    return stored.map(e => ({ ...e, timestamp: new Date(e.timestamp) }));
  });

  const [darkMode, setDarkMode] = useState(() => load('mtu_dark', true));

  useEffect(() => { localStorage.setItem('mtu_election', JSON.stringify(election)); }, [election]);
  useEffect(() => { localStorage.setItem('mtu_candidates', JSON.stringify(candidates)); }, [candidates]);
  useEffect(() => { localStorage.setItem('mtu_votes', JSON.stringify(voteCounts)); }, [voteCounts]);
  useEffect(() => { localStorage.setItem('mtu_vote_records', JSON.stringify(voteRecords)); }, [voteRecords]);
  useEffect(() => { localStorage.setItem('mtu_audit', JSON.stringify(auditLog)); }, [auditLog]);
  useEffect(() => {
    localStorage.setItem('mtu_dark', JSON.stringify(darkMode));
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Auto-close interval checker: automatically closes election when closesAt timestamp is passed
  useEffect(() => {
    const check = () => {
      if (election.status === 'open' && election.closesAt && new Date() > election.closesAt) {
        setElection(e => ({ ...e, status: 'closed' }));
        addAudit('System', 'ELECTION_AUTO_CLOSED', 'Election auto-closed at scheduled time');
      }
    };
    check();
    const id = setInterval(check, 1000); // Checked every second for precise auto-closing
    return () => clearInterval(id);
  }, [election.status, election.closesAt]);

  const addAudit = useCallback((actor: string, action: string, details: string) => {
    setAuditLog(prev => [makeAuditEntry(actor, action, details), ...prev].slice(0, 200));
  }, []);

  const castVote = useCallback((candidateId: string, category: Category, voter: { id: string; name: string; email: string }): 'success' | 'already_voted' | 'closed' | 'not_eligible' => {
    if (election.status !== 'open') return 'closed';
    if (voteRecords.some(record => record.voterId === voter.id && record.category === category)) return 'already_voted';
    const candidate = candidates.find(c => c.id === candidateId && c.isActive);
    if (!candidate || candidate.category !== category) return 'not_eligible';
    setVoteCounts(prev => ({ ...prev, [candidateId]: (prev[candidateId] ?? 0) + 1 }));
    setVoteRecords(prev => [{ id: crypto.randomUUID(), voterId: voter.id, voterName: voter.name, voterEmail: voter.email, candidateId, category, createdAt: new Date() }, ...prev]);
    addAudit(voter.name, 'VOTE_CAST', `Cast a ${category} ballot`);
    return 'success';
  }, [election.status, voteRecords, candidates, addAudit]);

  // Updated openElection: opens immediately, with optional timer support
  const openElection = useCallback((actorName: string, autoCloseMinutes?: number) => {
    setElection(e => {
      const now = new Date();
      const closesAt = autoCloseMinutes ? new Date(now.getTime() + autoCloseMinutes * 60000) : null;

      addAudit(
        actorName || 'Admin', 
        'ELECTION_OPENED', 
        `Election "${e.name}" opened${closesAt ? ` (Auto-closes in ${autoCloseMinutes} mins)` : ''}`
      );

      return { 
        ...e, 
        status: 'open', 
        opensAt: now,
        closesAt: closesAt 
      };
    });
  }, [addAudit]);

  // Updated closeElection: closes voting immediately
  const closeElection = useCallback((actorName: string) => {
    setElection(e => {
      addAudit(actorName || 'Admin', 'ELECTION_CLOSED', `Election "${e.name}" closed — computing winners`);
      return { 
        ...e, 
        status: 'closed',
        closesAt: new Date()
      };
    });
  }, [addAudit]);

  const publishResults = useCallback((actorName: string) => {
    setElection(e => {
      addAudit(actorName || 'Admin', 'RESULTS_PUBLISHED', `Results for "${e.name}" published to public`);
      return { ...e, status: 'published', publishedAt: new Date() };
    });
  }, [addAudit]);

  const addCandidate = useCallback((candidate: Omit<Candidate, 'id'>, actorName: string) => {
    const newC: Candidate = { ...candidate, id: `${candidate.category}-${Date.now()}` };
    setCandidates(prev => [...prev, newC]);
    addAudit(actorName, 'CANDIDATE_ADDED', `Added candidate "${newC.name}" (${newC.category})`);
  }, [addAudit]);

  const updateCandidate = useCallback((id: string, updates: Partial<Candidate>, actorName: string) => {
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    addAudit(actorName, 'CANDIDATE_UPDATED', `Updated candidate ${id}`);
  }, [addAudit]);

  const toggleCandidateActive = useCallback((id: string, actorName: string) => {
    setCandidates(prev => prev.map(c => {
      if (c.id !== id) return c;
      addAudit(actorName, c.isActive ? 'CANDIDATE_DEACTIVATED' : 'CANDIDATE_ACTIVATED', `${c.isActive ? 'Deactivated' : 'Activated'} candidate "${c.name}"`);
      return { ...c, isActive: !c.isActive };
    }));
  }, [addAudit]);

  const resetVotes = useCallback((actorName: string) => {
    setVoteCounts({ ...INITIAL_VOTES });
    setVoteRecords([]);
    addAudit(actorName, 'VOTES_RESET', 'All vote counts reset to initial values');
  }, [addAudit]);

  const toggleDarkMode = () => setDarkMode((p: boolean) => !p);

  const totalVotes = Object.values(voteCounts).reduce((a, b) => a + b, 0);

  const winners = (['king', 'queen', 'style', 'smart'] as Category[]).reduce((result, category) => {
    result[category] = candidates.filter(c => c.category === category && c.isActive).sort((a, b) => (voteCounts[b.id] ?? 0) - (voteCounts[a.id] ?? 0))[0] ?? null;
    return result;
  }, {} as Record<Category, Candidate | null>);

  return (
    <ElectionContext.Provider value={{
      election, candidates, voteCounts, voteRecords, auditLog, darkMode,
      castVote, openElection, closeElection, publishResults,
      addCandidate, updateCandidate, toggleCandidateActive,
      resetVotes, toggleDarkMode,
      totalVotes, winners,
    }}>
      {children}
    </ElectionContext.Provider>
  );
}

export function useElection() {
  const ctx = useContext(ElectionContext);
  if (!ctx) throw new Error('useElection outside ElectionProvider');
  return ctx;
}