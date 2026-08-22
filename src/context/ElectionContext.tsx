import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type {
  Category,
  ElectionState,
  AuditEntry,
  Candidate,
  VoteRecord,
} from '../types';
import { INITIAL_ELECTION, CANDIDATES as SEED_CANDIDATES } from '../data';

interface ElectionContextType {
  election: ElectionState;
  candidates: Candidate[];
  voteCounts: Record<string, number>;
  voteRecords: VoteRecord[];
  auditLog: AuditEntry[];
  darkMode: boolean;

  // Voter actions (Database)
  castVote: (
    candidateId: string,
    category: Category,
    voter: { id: string; name: string; email: string }
  ) => Promise<
    'success' | 'already_voted' | 'closed' | 'not_eligible' | 'error'
  >;

  fetchGlobalLedger: () => Promise<void>;

  // Admin actions
  setElectionType: (
    type: 'fresher' | 'major',
    actorName: string
  ) => Promise<void>;

  openElection: (
    actorName: string,
    autoCloseMinutes?: number
  ) => Promise<void>;

  closeElection: (actorName: string) => Promise<void>;

  publishResults: (actorName: string) => Promise<void>;

  addCandidate: (
    candidate: Omit<Candidate, 'id'>,
    actorName: string
  ) => Promise<void>;

  updateCandidate: (
    id: string,
    updates: Partial<Candidate>,
    actorName: string
  ) => Promise<void>;

  toggleCandidateActive: (
    id: string,
    actorName: string
  ) => Promise<void>;

  resetVotes: (actorName: string) => Promise<void>;

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
  } catch {
    return fallback;
  }
}

function makeAuditEntry(
  actor: string,
  action: string,
  details: string
): AuditEntry {
  return {
    id: crypto.randomUUID(),
    actor,
    action,
    details,
    timestamp: new Date(),
  };
}

const API_URL =
  'https://yancdy-ip-116-206-123-5.tunnelmole.net/api';

/**
 * Normalize candidate category values coming from either
 * the old local seed data or MySQL.
 */
function normalizeCandidate(candidate: Candidate): Candidate {
  let updatedCat = candidate.category;

  // Normalize legacy "popular" category
  if ((candidate as any).category === 'popular') {
    const isFemale =
      (candidate as any).gender === 'female' ||
      candidate.id.toLowerCase().includes('woman') ||
      candidate.id.toLowerCase().includes('female');

    updatedCat = isFemale ? 'popular_woman' : 'popular_man';
  }

  // Normalize legacy IDs
  if (candidate.id.startsWith('smart-')) {
    updatedCat = 'smart';
  }

  if (candidate.id.startsWith('style-')) {
    updatedCat = 'style';
  }

  return {
    ...candidate,
    category: updatedCat as Category,
  };
}

export function ElectionProvider({
  children,
}: {
  children: ReactNode;
}) {
  // ---------------------------------------------------------
  // ELECTION STATE
  // ---------------------------------------------------------

  const [election, setElection] = useState<ElectionState>(() => {
    const stored = load<ElectionState | null>(
      'mtu_election_v3',
      null
    );

    if (!stored) return INITIAL_ELECTION;

    return {
      ...stored,
      opensAt: stored.opensAt
        ? new Date(stored.opensAt)
        : null,
      closesAt: stored.closesAt
        ? new Date(stored.closesAt)
        : null,
      publishedAt: stored.publishedAt
        ? new Date(stored.publishedAt)
        : null,
    };
  });

  // ---------------------------------------------------------
  // CANDIDATES
  // ---------------------------------------------------------

  const [candidates, setCandidates] = useState<Candidate[]>(() => {
    const loaded = load<Candidate[]>(
      'mtu_candidates_v3',
      SEED_CANDIDATES
    );

    return loaded.map(normalizeCandidate);
  });

  // ---------------------------------------------------------
  // OTHER STATE
  // ---------------------------------------------------------

  const [auditLog, setAuditLog] = useState<AuditEntry[]>(() => {
    const stored = load<AuditEntry[]>('mtu_audit', []);

    return stored.map((e) => ({
      ...e,
      timestamp: new Date(e.timestamp),
    }));
  });

  const [darkMode, setDarkMode] = useState<boolean>(() =>
    load('mtu_dark', true)
  );

  const [voteRecords, setVoteRecords] = useState<VoteRecord[]>([]);
  const [voteCounts, setVoteCounts] = useState<
    Record<string, number>
  >({});

  // ---------------------------------------------------------
  // AUDIT
  // ---------------------------------------------------------

  const addAudit = useCallback(
    (actor: string, action: string, details: string) => {
      setAuditLog((prev) =>
        [
          makeAuditEntry(actor, action, details),
          ...prev,
        ].slice(0, 200)
      );
    },
    []
  );

  // ---------------------------------------------------------
  // LOCAL STORAGE
  // ---------------------------------------------------------

  useEffect(() => {
    localStorage.setItem(
      'mtu_candidates_v3',
      JSON.stringify(candidates)
    );
  }, [candidates]);

  useEffect(() => {
    localStorage.setItem(
      'mtu_audit',
      JSON.stringify(auditLog)
    );
  }, [auditLog]);

  useEffect(() => {
    localStorage.setItem(
      'mtu_dark',
      JSON.stringify(darkMode)
    );

    document.documentElement.classList.toggle(
      'dark',
      darkMode
    );
  }, [darkMode]);

  // =========================================================
  // GLOBAL ELECTION SYNCHRONIZATION
  // =========================================================

  useEffect(() => {
    const syncElection = async () => {
      try {
        const response = await fetch(
          `${API_URL}/election?t=${Date.now()}`,
          {
            cache: 'no-store',
          }
        );

        if (!response.ok) {
          throw new Error(
            `Election API returned ${response.status}`
          );
        }

        const data = await response.json();

        if (!data) return;

        setElection((prev) => ({
          ...prev,
          type: data.type ?? prev.type,
          status: data.status ?? prev.status,
          opensAt: data.opensAt
            ? new Date(data.opensAt)
            : null,
          closesAt: data.closesAt
            ? new Date(data.closesAt)
            : null,
          publishedAt: data.publishedAt
            ? new Date(data.publishedAt)
            : prev.publishedAt,
        }));
      } catch (error) {
        console.error(
          '❌ Failed to sync global election:',
          error
        );
      }
    };

    syncElection();

    const interval = setInterval(
      syncElection,
      3000
    );

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncElection();
      }
    };

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange
    );

    return () => {
      clearInterval(interval);

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      );
    };
  }, []);

  // =========================================================
  // GLOBAL CANDIDATE SYNCHRONIZATION
  // =========================================================

  const fetchGlobalCandidates = useCallback(
    async () => {
      try {
        const response = await fetch(
          `${API_URL}/candidates?t=${Date.now()}`,
          {
            cache: 'no-store',
            headers: {
              'Bypass-Tunnel-Reminder': 'true',
              'Cache-Control': 'no-cache',
            },
          }
        );

        if (!response.ok) {
          throw new Error(
            `Candidates API returned ${response.status}`
          );
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error(
            'Candidates API returned invalid data'
          );
        }

        const normalizedCandidates =
          data.map(normalizeCandidate);

        setCandidates(normalizedCandidates);

        console.log(
          '🌐 Global candidates synchronized:',
          normalizedCandidates.length
        );
      } catch (error) {
        console.error(
          '❌ Failed to sync candidates:',
          error
        );
      }
    },
    []
  );

  // Initial candidate synchronization + polling
  useEffect(() => {
    fetchGlobalCandidates();

    // Synchronize every 3 seconds
    const interval = setInterval(
      fetchGlobalCandidates,
      3000
    );

    // Synchronize when returning to tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchGlobalCandidates();
      }
    };

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange
    );

    return () => {
      clearInterval(interval);

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      );
    };
  }, [fetchGlobalCandidates]);

  // =========================================================
  // AUTO CLOSE
  // =========================================================

  useEffect(() => {
    const check = () => {
      if (
        election.status === 'open' &&
        election.closesAt &&
        new Date() > election.closesAt
      ) {
        setElection((e) => ({
          ...e,
          status: 'closed',
        }));

        addAudit(
          'System',
          'ELECTION_AUTO_CLOSED',
          'Election auto-closed at scheduled time'
        );
      }
    };

    check();

    const id = setInterval(check, 1000);

    return () => clearInterval(id);
  }, [
    election.status,
    election.closesAt,
    addAudit,
  ]);

  // =========================================================
  // DATABASE FUNCTIONS - BALLOTS
  // =========================================================

  const fetchGlobalLedger = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_URL}/ballots`,
        {
          cache: 'no-store',
          headers: {
            'Bypass-Tunnel-Reminder': 'true',
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          'Failed to fetch ballots'
        );
      }

      const data = await response.json();

      const formattedData: VoteRecord[] = (
        data || []
      ).map((record: any) => ({
        ...record,
        createdAt: new Date(record.createdAt),
      }));

      setVoteRecords(formattedData);

      const counts: Record<string, number> = {};

      formattedData.forEach((record) => {
        counts[record.candidateId] =
          (counts[record.candidateId] || 0) + 1;
      });

      setVoteCounts(counts);
    } catch (error) {
      console.error(
        '❌ Error loading global ballots:',
        error
      );
    }
  }, []);

  // Poll ballots every 5 seconds
  useEffect(() => {
    fetchGlobalLedger();

    const interval = setInterval(
      fetchGlobalLedger,
      5000
    );

    return () => clearInterval(interval);
  }, [fetchGlobalLedger]);

  // =========================================================
  // CAST VOTE
  // =========================================================

  const castVote = useCallback(
    async (
      candidateId: string,
      category: Category,
      voter: {
        id: string;
        name: string;
        email: string;
      }
    ) => {
      if (election.status !== 'open') {
        return 'closed';
      }

      const candidate = candidates.find(
        (c) =>
          c.id === candidateId &&
          c.isActive
      );

      if (
        !candidate ||
        candidate.category !== category
      ) {
        return 'not_eligible';
      }

      try {
        const response = await fetch(
          `${API_URL}/votes`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Bypass-Tunnel-Reminder': 'true',
            },
            body: JSON.stringify({
              voterId: voter.id,
              voterEmail: voter.email,
              voterName: voter.name,
              candidateId,
              category,
            }),
          }
        );

        if (response.status === 409) {
          return 'already_voted';
        }

        if (!response.ok) {
          throw new Error(
            'Database insertion failed'
          );
        }

        const newRecord: VoteRecord = {
          id: crypto.randomUUID(),
          voterId: voter.id,
          voterEmail: voter.email,
          voterName: voter.name,
          candidateId,
          category,
          createdAt: new Date(),
        };

        setVoteRecords((prev) => [
          newRecord,
          ...prev,
        ]);

        setVoteCounts((prev) => ({
          ...prev,
          [candidateId]:
            (prev[candidateId] || 0) + 1,
        }));

        addAudit(
          voter.name,
          'VOTE_CAST',
          `Cast a secure ${category} ballot`
        );

        return 'success';
      } catch (error) {
        console.error(
          '❌ Error casting vote:',
          error
        );

        return 'error';
      }
    },
    [
      election.status,
      candidates,
      addAudit,
    ]
  );

  // =========================================================
  // ADMIN - ELECTION TYPE
  // =========================================================

  const setElectionType = useCallback(
    async (
      type: 'fresher' | 'major',
      actorName: string
    ) => {
      try {
        const response = await fetch(
          `${API_URL}/election`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Bypass-Tunnel-Reminder': 'true',
            },
            body: JSON.stringify({ type }),
          }
        );

        if (!response.ok) {
          throw new Error(
            `Failed to update election type: ${response.status}`
          );
        }

        const data =
          await response.json().catch(
            () => null
          );

        setElection((prev) => ({
          ...prev,
          type: data?.type ?? type,
        }));

        addAudit(
          actorName || 'Admin',
          'ELECTION_TYPE_CHANGED',
          `Election type changed to ${type}`
        );
      } catch (error) {
        console.error(
          '❌ Error updating election type:',
          error
        );
      }
    },
    [addAudit]
  );

  // =========================================================
  // ADMIN - OPEN ELECTION
  // =========================================================

  const openElection = useCallback(
    async (
      actorName: string,
      autoCloseMinutes?: number
    ) => {
      const now = new Date();

      const closesAt = autoCloseMinutes
        ? new Date(
            now.getTime() +
              autoCloseMinutes * 60000
          )
        : null;

      try {
        const response = await fetch(
          `${API_URL}/election`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Bypass-Tunnel-Reminder': 'true',
            },
            body: JSON.stringify({
              status: 'open',
              opensAt: now.toISOString(),
              closesAt:
                closesAt?.toISOString() ?? null,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(
            `Failed to open election: ${response.status}`
          );
        }

        setElection((e) => ({
          ...e,
          status: 'open',
          opensAt: now,
          closesAt,
        }));

        const closesAtText =
          autoCloseMinutes
            ? ` (Auto-closes in ${autoCloseMinutes} mins)`
            : '';

        addAudit(
          actorName || 'Admin',
          'ELECTION_OPENED',
          `Election opened${closesAtText}`
        );
      } catch (error) {
        console.error(
          '❌ Error opening election:',
          error
        );
      }
    },
    [addAudit]
  );

  // =========================================================
  // ADMIN - CLOSE ELECTION
  // =========================================================

  const closeElection = useCallback(
    async (actorName: string) => {
      try {
        const response = await fetch(
          `${API_URL}/election`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Bypass-Tunnel-Reminder': 'true',
            },
            body: JSON.stringify({
              status: 'closed',
              closesAt: new Date().toISOString(),
            }),
          }
        );

        if (!response.ok) {
          throw new Error(
            `Failed to close election: ${response.status}`
          );
        }

        setElection((e) => ({
          ...e,
          status: 'closed',
          closesAt: new Date(),
        }));

        addAudit(
          actorName || 'Admin',
          'ELECTION_CLOSED',
          'Election closed — computing winners'
        );
      } catch (error) {
        console.error(
          '❌ Error closing election:',
          error
        );
      }
    },
    [addAudit]
  );

  // =========================================================
  // ADMIN - PUBLISH RESULTS
  // =========================================================

  const publishResults = useCallback(
    async (actorName: string) => {
      try {
        const response = await fetch(
          `${API_URL}/election`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Bypass-Tunnel-Reminder': 'true',
            },
            body: JSON.stringify({
              status: 'published',
            }),
          }
        );

        if (!response.ok) {
          throw new Error(
            `Failed to publish election: ${response.status}`
          );
        }

        setElection((e) => ({
          ...e,
          status: 'published',
          publishedAt: new Date(),
        }));

        addAudit(
          actorName || 'Admin',
          'RESULTS_PUBLISHED',
          'Results published to public'
        );
      } catch (error) {
        console.error(
          '❌ Error publishing election:',
          error
        );
      }
    },
    [addAudit]
  );

  // =========================================================
  // ADMIN - ADD CANDIDATE
  // =========================================================

  const addCandidate = useCallback(
    async (
      candidate: Omit<Candidate, 'id'>,
      actorName: string
    ) => {
      try {
        const response = await fetch(
          `${API_URL}/candidates`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Bypass-Tunnel-Reminder': 'true',
            },
            body: JSON.stringify(candidate),
          }
        );

        if (!response.ok) {
          throw new Error(
            `Failed to add candidate: ${response.status}`
          );
        }

        const newCandidate: Candidate =
          await response.json();

        const normalizedCandidate =
          normalizeCandidate(newCandidate);

        setCandidates((prev) => {
          // Avoid duplicate candidate if polling
          // already inserted it
          const exists = prev.some(
            (c) => c.id === normalizedCandidate.id
          );

          if (exists) {
            return prev;
          }

          return [
            ...prev,
            normalizedCandidate,
          ];
        });

        addAudit(
          actorName || 'Admin',
          'CANDIDATE_ADDED',
          `Added candidate "${normalizedCandidate.name}" (${normalizedCandidate.category})`
        );

        console.log(
          '✅ Candidate added globally:',
          normalizedCandidate
        );
      } catch (error) {
        console.error(
          '❌ Error adding candidate:',
          error
        );

        throw error;
      }
    },
    [addAudit]
  );

  // =========================================================
  // ADMIN - EDIT CANDIDATE
  // =========================================================

  const updateCandidate = useCallback(
    async (
      id: string,
      updates: Partial<Candidate>,
      actorName: string
    ) => {
      try {
        const existingCandidate =
          candidates.find(
            (candidate) => candidate.id === id
          );

        if (!existingCandidate) {
          throw new Error(
            `Candidate ${id} not found`
          );
        }

        const updatedCandidate: Candidate = {
          ...existingCandidate,
          ...updates,
          id,
        };

        const response = await fetch(
          `${API_URL}/candidates`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Bypass-Tunnel-Reminder': 'true',
            },
            body: JSON.stringify(
              updatedCandidate
            ),
          }
        );

        if (!response.ok) {
          throw new Error(
            `Failed to update candidate: ${response.status}`
          );
        }

        const serverCandidate: Candidate =
          await response.json();

        const normalizedCandidate =
          normalizeCandidate(serverCandidate);

        setCandidates((prev) =>
          prev.map((candidate) =>
            candidate.id === id
              ? normalizedCandidate
              : candidate
          )
        );

        addAudit(
          actorName || 'Admin',
          'CANDIDATE_UPDATED',
          `Updated candidate "${normalizedCandidate.name}"`
        );

        console.log(
          '✅ Candidate updated globally:',
          normalizedCandidate
        );
      } catch (error) {
        console.error(
          '❌ Error updating candidate:',
          error
        );

        throw error;
      }
    },
    [candidates, addAudit]
  );

  // =========================================================
  // ADMIN - ACTIVATE / DEACTIVATE CANDIDATE
  // =========================================================

  const toggleCandidateActive = useCallback(
    async (
      id: string,
      actorName: string
    ) => {
      try {
        const existingCandidate =
          candidates.find(
            (candidate) => candidate.id === id
          );

        if (!existingCandidate) {
          throw new Error(
            `Candidate ${id} not found`
          );
        }

        const updatedCandidate: Candidate = {
          ...existingCandidate,
          isActive:
            !existingCandidate.isActive,
        };

        const response = await fetch(
          `${API_URL}/candidates`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Bypass-Tunnel-Reminder': 'true',
            },
            body: JSON.stringify(
              updatedCandidate
            ),
          }
        );

        if (!response.ok) {
          throw new Error(
            `Failed to change candidate status: ${response.status}`
          );
        }

        const serverCandidate: Candidate =
          await response.json();

        const normalizedCandidate =
          normalizeCandidate(serverCandidate);

        setCandidates((prev) =>
          prev.map((candidate) =>
            candidate.id === id
              ? normalizedCandidate
              : candidate
          )
        );

        addAudit(
          actorName || 'Admin',
          normalizedCandidate.isActive
            ? 'CANDIDATE_ACTIVATED'
            : 'CANDIDATE_DEACTIVATED',
          `${
            normalizedCandidate.isActive
              ? 'Activated'
              : 'Deactivated'
          } candidate "${normalizedCandidate.name}"`
        );

        console.log(
          '✅ Candidate status updated globally:',
          normalizedCandidate
        );
      } catch (error) {
        console.error(
          '❌ Error changing candidate status:',
          error
        );

        throw error;
      }
    },
    [candidates, addAudit]
  );

  // =========================================================
  // RESET VOTES
  // =========================================================

  const resetVotes = useCallback(
  async (actorName: string) => {
    try {
      const response = await fetch(
        `${API_URL}/ballots`,
        {
          method: 'DELETE',
          headers: {
            'Bypass-Tunnel-Reminder': 'true',
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to reset votes: ${response.status}`
        );
      }

      // Immediately clear votes on the admin device
      setVoteCounts({});
      setVoteRecords([]);

      addAudit(
        actorName || 'Admin',
        'VOTES_RESET',
        'All votes were permanently erased from the database'
      );

      console.log('✅ All votes reset globally');
    } catch (error) {
      console.error(
        '❌ Error resetting votes:',
        error
      );

      throw error;
    }
  },
  [addAudit]
);

  // =========================================================
  // DARK MODE
  // =========================================================

  const toggleDarkMode = () =>
    setDarkMode((previous) => !previous);

  // =========================================================
  // COMPUTED
  // =========================================================

  const totalVotes = Object.values(
    voteCounts
  ).reduce((a, b) => a + b, 0);

  const winners = (
    [
      'king',
      'queen',
      'style',
      'smart',
      'popular_man',
      'popular_woman',
    ] as Category[]
  ).reduce(
    (result, category) => {
      result[category] =
        candidates
          .filter(
            (candidate) =>
              candidate.category === category &&
              candidate.isActive
          )
          .sort(
            (a, b) =>
              (voteCounts[b.id] ?? 0) -
              (voteCounts[a.id] ?? 0)
          )[0] ?? null;

      return result;
    },
    {} as Record<Category, Candidate | null>
  );

  // =========================================================
  // PROVIDER
  // =========================================================

  return (
    <ElectionContext.Provider
      value={{
        election,
        candidates,
        voteCounts,
        voteRecords,
        auditLog,
        darkMode,

        setElectionType,
        castVote,
        fetchGlobalLedger,

        openElection,
        closeElection,
        publishResults,

        addCandidate,
        updateCandidate,
        toggleCandidateActive,

        resetVotes,
        toggleDarkMode,

        totalVotes,
        winners,
      }}
    >
      {children}
    </ElectionContext.Provider>
  );
}

export function useElection() {
  const ctx = useContext(ElectionContext);

  if (!ctx) {
    throw new Error(
      'useElection outside ElectionProvider'
    );
  }

  return ctx;
}