import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Category, ElectionState, AuditEntry, Candidate, VoteRecord } from '../types';
import { INITIAL_ELECTION, CANDIDATES as SEED_CANDIDATES } from '../data';
import { useAuth } from './AuthContext';

interface ElectionContextType {
  election: ElectionState;
  candidates: Candidate[];
  voteCounts: Record<string, number>;
  voteRecords: VoteRecord[];
  auditLog: AuditEntry[];
  darkMode: boolean;

  // Voter actions (Database)
  castVote: (candidateId: string, category: Category, voter: { id: string; name: string; email: string }) => Promise<'success' | 'already_voted' | 'closed' | 'not_eligible' | 'error'>;
  fetchGlobalLedger: () => Promise<void>;

  // Admin actions (LocalStorage)
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

// Helper for LocalStorage
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
  const { isAdmin } = useAuth();

  // 1. LOCAL STORAGE STATE
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
      if (candidate.id.startsWith('smart-')) return { ...candidate, category: 'smart' };
      if (candidate.id.startsWith('style-')) return { ...candidate, category: 'style' };
      return candidate;
    })
  );

  const [auditLog, setAuditLog] = useState<AuditEntry[]>(() => {
    const stored = load<AuditEntry[]>('mtu_audit', []);
    return stored.map(e => ({ ...e, timestamp: new Date(e.timestamp) }));
  });

  const [darkMode, setDarkMode] = useState<boolean>(() => load('mtu_dark', true));

  // 2. DATABASE STATE
  const [voteRecords, setVoteRecords] = useState<VoteRecord[]>([]);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});

  const API_URL = 'http://localhost:8080/api';

  const addAudit = useCallback((actor: string, action: string, details: string) => {
    setAuditLog(prev => [makeAuditEntry(actor, action, details), ...prev].slice(0, 200));
  }, []);

  // Sync Local Storage
  useEffect(() => { localStorage.setItem('mtu_election', JSON.stringify(election)); }, [election]);
  useEffect(() => { localStorage.setItem('mtu_candidates_v2', JSON.stringify(candidates)); }, [candidates]);
  useEffect(() => { localStorage.setItem('mtu_audit', JSON.stringify(auditLog)); }, [auditLog]);
  useEffect(() => {
    localStorage.setItem('mtu_dark', JSON.stringify(darkMode));
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Auto-close interval checker
  useEffect(() => {
    const check = () => {
      if (election.status === 'open' && election.closesAt && new Date() > election.closesAt) {
        setElection(e => ({ ...e, status: 'closed' }));
        addAudit('System', 'ELECTION_AUTO_CLOSED', 'Election auto-closed at scheduled time');
      }
    };
    check();
    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  }, [election.status, election.closesAt, addAudit]);

  // --- DATABASE FUNCTIONS ---

  const fetchGlobalLedger = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/ballots`);
      if (!response.ok) throw new Error('Failed to fetch ballots');
      
      const data = await response.json();
      
      const formattedData: VoteRecord[] = data.map((record: any) => ({
        ...record,
        createdAt: new Date(record.createdAt)
      }));
      
      setVoteRecords(formattedData);

      // Re-calculate vote counts based on Database data
      const counts: Record<string, number> = {};
      formattedData.forEach(record => {
        counts[record.candidateId] = (counts[record.candidateId] || 0) + 1;
      });
      setVoteCounts(counts);

    } catch (error) {
      console.error("Error loading global ballots:", error);
    }
  }, []);

  // Fetch ledger automatically for admins
  useEffect(() => {
    if (isAdmin) {
      fetchGlobalLedger();
    }
  }, [isAdmin, fetchGlobalLedger]);

  const castVote = useCallback(async (candidateId: string, category: Category, voter: { id: string; name: string; email: string }) => {
    if (election.status !== 'open') return 'closed';
    const candidate = candidates.find(c => c.id === candidateId && c.isActive);
    if (!candidate || candidate.category !== category) return 'not_eligible';

    try {
      const response = await fetch(`${API_URL}/votes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voterId: voter.id,
          voterEmail: voter.email,
          voterName: voter.name,
          candidateId: candidateId,
          category: category
        }),
      });

      if (response.status === 409) return 'already_voted';
      if (!response.ok) throw new Error('Database insertion failed');

      // Optimistically update local state so UI feels instant
      const newRecord: VoteRecord = {
        id: crypto.randomUUID(),
        voterId: voter.id,
        voterEmail: voter.email,
        voterName: voter.name,
        candidateId: candidateId,
        category: category,
        createdAt: new Date()
      };

      setVoteRecords(prev => [newRecord, ...prev]);
      setVoteCounts(prev => ({ ...prev, [candidateId]: (prev[candidateId] || 0) + 1 }));
      addAudit(voter.name, 'VOTE_CAST', `Cast a secure ${category} ballot`);
      
      return 'success';
    } catch (error) {
      console.error("Error casting vote:", error);
      return 'error';
    }
  }, [election.status, candidates, addAudit]);

  // --- ADMIN FUNCTIONS ---

  const openElection = useCallback((actorName: string, autoCloseMinutes?: number) => {
    setElection(e => {
      const now = new Date();
      const closesAt = autoCloseMinutes ? new Date(now.getTime() + autoCloseMinutes * 60000) : null;
      addAudit(
        actorName || 'Admin', 
        'ELECTION_OPENED', 
        `Election "${e.name}" opened${closesAt ? ` (Auto-closes in ${autoCloseMinutes} mins)` : ''}`
      );
      return { ...e, status: 'open', opensAt: now, closesAt: closesAt };
    });
  }, [addAudit]);

  const closeElection = useCallback((actorName: string) => {
    setElection(e => {
      addAudit(actorName || 'Admin', 'ELECTION_CLOSED', `Election "${e.name}" closed — computing winners`);
      return { ...e, status: 'closed', closesAt: new Date() };
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
    setVoteCounts({});
    setVoteRecords([]);
    addAudit(actorName, 'VOTES_RESET', 'WARNING: Local vote counts reset (DB untouched)');
  }, [addAudit]);

  const toggleDarkMode = () => setDarkMode(p => !p);

  const totalVotes = Object.values(voteCounts).reduce((a, b) => a + b, 0);

  const winners = (['king', 'queen', 'style', 'smart'] as Category[]).reduce((result, category) => {
    result[category] = candidates.filter(c => c.category === category && c.isActive).sort((a, b) => (voteCounts[b.id] ?? 0) - (voteCounts[a.id] ?? 0))[0] ?? null;
    return result;
  }, {} as Record<Category, Candidate | null>);

  return (
    <ElectionContext.Provider value={{
      election, candidates, voteCounts, voteRecords, auditLog, darkMode,
      castVote, fetchGlobalLedger, openElection, closeElection, publishResults,
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