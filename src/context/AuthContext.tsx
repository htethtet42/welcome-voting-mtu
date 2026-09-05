import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { AuthUser, JudgeRequestStatus } from '../types';
import {
  API_URL,
  setAdminToken,
  clearAdminToken,
  getAdminToken,
  authHeaders,
  setVoterToken,
  clearVoterToken,
  getVoterToken,
  voterHeaders,
  getJudgeRequestToken,
  setJudgeRequestToken,
  clearJudgeRequestToken,
} from '../lib/api';

/**
 * How often the pending screen asks whether an organiser has decided.
 *
 * Three seconds keeps approval feeling instant to a teacher who is watching.
 * The poll pauses while the tab is hidden and stops after JUDGE_POLL_MAX_MS,
 * because the backend runs on a 3-connection pool (main.go: SetMaxOpenConns)
 * shared with 300 students casting votes — a backgrounded tab must not keep
 * spending connections all evening.
 */
const JUDGE_POLL_MS = 3_000;
const JUDGE_POLL_MAX_MS = 30 * 60 * 1_000;

/** A judge access request as the waiting screen sees it. */
export interface JudgeRequest {
  token: string;
  /** Short code the judge shows an organiser (J-07). */
  code: string;
  name: string;
  email: string;
  status: JudgeRequestStatus;
  requestedAt: string;
  /** Set once approved, so the screen can show the multiplier before leaving. */
  weight?: number;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isJudge: boolean;
  /** Set once Google has verified the email and an identity step is awaited. */
  pendingVoter: { email: string; name: string; attemptsLeft: number } | null;
  /**
   * True when the signed-in account is not on the student roll and may only
   * request judge access. The sign-in screen hides the Student option, because
   * the roll-number step would reject this account whatever they typed.
   */
  judgeOnly: boolean;
  /** A judge access request awaiting, or having received, an organiser's decision. */
  judgeRequest: JudgeRequest | null;
  loginError: string | null;
  /** Step 1: exchange a Google ID token for an identity challenge. */
  signInWithGoogle: (credential: string) => Promise<boolean>;
  /** Step 2a (student): verify the roll number and start the voting session. */
  verifyRollNumber: (studentId: string) => Promise<boolean>;
  /** Step 2b (judge): join the approval queue. Grants nothing on its own. */
  requestJudgeAccess: (name: string, department: string) => Promise<boolean>;
  /** Abandon a pending or declined request and return to sign-in. */
  cancelJudgeRequest: () => void;
  loginAdmin: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const s = sessionStorage.getItem('mtu_user');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });
  const [pendingVoter, setPendingVoter] = useState<
    { email: string; name: string; attemptsLeft: number } | null
  >(null);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [judgeOnly, setJudgeOnly] = useState(false);
  const [judgeRequest, setJudgeRequest] = useState<JudgeRequest | null>(null);

  useEffect(() => {
    if (user) sessionStorage.setItem('mtu_user', JSON.stringify(user));
    else sessionStorage.removeItem('mtu_user');
  }, [user]);

  /**
   * Resume a request that was in flight before a reload.
   *
   * A teacher who backgrounds the tab, loses signal, or refreshes returns to
   * their place in the queue instead of taking a second code from an organiser
   * who is already looking at the first one.
   */
  useEffect(() => {
    if (user) return;
    const saved = getJudgeRequestToken();
    if (!saved) return;
    setJudgeRequest({
      token: saved,
      code: '',
      name: '',
      email: '',
      status: 'pending',
      requestedAt: new Date().toISOString(),
    });
    // Mount only: later changes are driven by requestJudgeAccess and the poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Poll for the organiser's decision.
   *
   * This is the only way an approved judge receives their voting session, which
   * is what lets the pending screen open the ballot by itself rather than
   * asking a teacher to sign in a second time and hope it works.
   */
  useEffect(() => {
    if (!judgeRequest || judgeRequest.status !== 'pending') return;

    const token = judgeRequest.token;
    const startedAt = Date.now();
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      // Nobody is looking, so nobody is waiting. Skip rather than spend a
      // database connection students are queuing for.
      if (typeof document !== 'undefined' && document.hidden) return;
      if (Date.now() - startedAt > JUDGE_POLL_MAX_MS) return;

      try {
        const response = await fetch(`${API_URL}/auth/judge-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestToken: token }),
        });

        if (!response.ok) {
          // 401 means the request expired or was purged. Anything else is
          // transient (a cold serverless instance, a flaky phone connection)
          // and the next tick retries.
          if (response.status === 401) {
            cancelled = true;
            clearJudgeRequestToken();
            setJudgeRequest(null);
            setLoginError('Your judge request expired. Please sign in again.');
          }
          return;
        }

        const data = await response.json();
        if (cancelled) return;

        if (data.status === 'approved') {
          cancelled = true;
          clearJudgeRequestToken();
          setVoterToken(data.token);
          setUser({
            id: `email:${data.email}`,
            email: data.email,
            name: data.name || 'Judge',
            role: 'judge',
            voteWeight: data.weight,
          });
          // Kept in state so the waiting screen can show the approved card and
          // the multiplier for a beat before it moves to the ballot.
          setJudgeRequest(prev =>
            prev ? { ...prev, status: 'approved', weight: data.weight, name: data.name, email: data.email } : prev
          );
          return;
        }

        if (data.status === 'declined') {
          cancelled = true;
          clearJudgeRequestToken();
          setJudgeRequest(prev => (prev ? { ...prev, status: 'declined' } : prev));
          return;
        }

        // Still pending. Fill in the code and name if this was a resumed
        // request restored from storage, which starts out with neither.
        setJudgeRequest(prev =>
          prev && (!prev.code || !prev.name)
            ? { ...prev, code: data.code, name: data.name, email: data.email, requestedAt: data.requestedAt }
            : prev
        );
      } catch {
        /* offline or server restarting — the next tick retries */
      }
    };

    poll();
    const interval = setInterval(poll, JUDGE_POLL_MS);
    // Ask immediately when the teacher comes back to the tab, so they are not
    // punished with an extra wait for having looked away.
    const onVisibility = () => { if (!document.hidden) poll(); };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [judgeRequest?.token, judgeRequest?.status]);

  /**
   * Step 1 — hand Google's ID token to the backend.
   *
   * The backend verifies the token's signature against Google's public keys,
   * confirms the email is on the official roll, and returns a short-lived
   * challenge. No voting session exists yet: the roll number is still required.
   *
   * This replaces a fake OTP that was generated in the browser and never sent,
   * which meant any email address could vote.
   */
  const signInWithGoogle = async (credential: string): Promise<boolean> => {
    setLoginError(null);
    try {
      const response = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });

      if (!response.ok) {
        const body = await response.text();
        if (response.status === 403 || body.includes('not_eligible')) {
          setLoginError(
            'This account is not on the student voter roll. Use the email registered with the university, or contact the event organizers.'
          );
          // (Only reachable when the backend runs with VOTER_ELIGIBILITY=roll.)
        } else if (response.status === 503) {
          setLoginError('Voter sign-in is not configured yet. Contact the organizers.');
        } else {
          setLoginError('Google sign-in failed. Please try again.');
        }
        return false;
      }

      const data = await response.json();
      setChallengeToken(data.challengeToken);
      // Off-roll accounts are admitted only far enough to request judge access.
      // The sign-in screen uses this to hide the Student option rather than let
      // a teacher walk into a roll-number check that cannot succeed.
      setJudgeOnly(!!data.judgeOnly);
      setPendingVoter({
        email: data.email,
        name: data.name,
        attemptsLeft: data.attemptsLeft ?? 5,
      });
      return true;
    } catch (error) {
      console.error('Google sign-in failed:', error);
      setLoginError('Could not reach the server. Check your connection.');
      return false;
    }
  };

  /**
   * Step 2 — verify the student roll number.
   *
   * Only on success does the backend issue a voting session token. Attempts
   * are capped server-side, so a roll number cannot be guessed.
   */
  const verifyRollNumber = async (studentId: string): Promise<boolean> => {
    if (!challengeToken || !pendingVoter) return false;
    setLoginError(null);

    try {
      const response = await fetch(`${API_URL}/auth/verify-roll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeToken, studentId }),
      });

      if (!response.ok) {
        let payload: any = null;
        try {
          payload = await response.json();
        } catch {
          /* non-JSON error body */
        }

        if (response.status === 429) {
          setLoginError('Too many incorrect attempts. Please sign in with Google again.');
          setPendingVoter(null);
          setChallengeToken(null);
        } else if (payload?.error === 'incorrect_roll_number') {
          const left = payload.attemptsLeft ?? 0;
          setLoginError(
            `That doesn't look like a valid roll number. ${left} attempt${left === 1 ? '' : 's'} remaining.`
          );
          setPendingVoter(prev => (prev ? { ...prev, attemptsLeft: left } : prev));
        } else {
          setLoginError('Your sign-in expired. Please sign in with Google again.');
          setPendingVoter(null);
          setChallengeToken(null);
        }
        return false;
      }

      const data = await response.json();
      setVoterToken(data.token);
      setUser({
        id: `email:${data.email}`,
        studentId: data.studentId,
        email: data.email,
        name: data.name || 'Voter',
        role: 'voter',
        voteWeight: 1,
      });
      setPendingVoter(null);
      setChallengeToken(null);
      return true;
    } catch (error) {
      console.error('Roll number verification failed:', error);
      setLoginError('Could not reach the server. Check your connection.');
      return false;
    }
  };

  /**
   * Step 2b — join the judge approval queue.
   *
   * This deliberately issues NO session. The name is a label so an organiser
   * can recognise the person in front of them, not a credential: the admin's
   * decision is the gate, which is what makes self-declaration safe. Anyone may
   * claim to be a teacher; nobody gets voting weight without being approved.
   */
  const requestJudgeAccess = async (name: string, department: string): Promise<boolean> => {
    if (!challengeToken) {
      setLoginError('Your sign-in expired. Please sign in with Google again.');
      return false;
    }
    setLoginError(null);

    try {
      const response = await fetch(`${API_URL}/auth/request-judge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeToken, name, department }),
      });

      if (!response.ok) {
        const body = await response.text();
        if (body.includes('name_required')) {
          setLoginError('Please enter your name so the organisers can recognise you.');
        } else if (response.status === 401) {
          setLoginError('Your sign-in expired. Please sign in with Google again.');
          setPendingVoter(null);
          setChallengeToken(null);
        } else {
          setLoginError('Could not send your request. Please try again.');
        }
        return false;
      }

      const data = await response.json();
      setJudgeRequestToken(data.requestToken);
      setJudgeRequest({
        token: data.requestToken,
        code: data.code,
        name: data.name,
        email: data.email,
        status: 'pending',
        requestedAt: new Date().toISOString(),
      });
      // The challenge has been spent; the request token is the credential now.
      setChallengeToken(null);
      setPendingVoter(null);
      return true;
    } catch (error) {
      console.error('Judge request failed:', error);
      setLoginError('Could not reach the server. Check your connection.');
      return false;
    }
  };

  /** Abandon a pending or declined request and return to the sign-in screen. */
  const cancelJudgeRequest = () => {
    clearJudgeRequestToken();
    setJudgeRequest(null);
    setJudgeOnly(false);
    setLoginError(null);
  };

  /**
   * Authenticates against the backend, which verifies the password against a
   * bcrypt hash and issues a session token.
   *
   * The credentials are NOT checked in the browser: previously they were
   * compared against constants compiled into the bundle, which any visitor
   * could read. The returned token is what authorizes every admin request.
   */
  const loginAdmin = async (email: string, password: string): Promise<boolean> => {
    setLoginError(null);
    try {
      const response = await fetch(`${API_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      if (!response.ok) {
        setLoginError('Invalid admin credentials.');
        return false;
      }

      const data = await response.json();
      setAdminToken(data.token);
      setUser({
        id: 'admin-001',
        studentId: 'ADMIN',
        email: data.email,
        name: data.name || 'Event Admin',
        role: 'admin',
      });
      return true;
    } catch (error) {
      console.error('Admin login failed:', error);
      setLoginError('Could not reach the server. Check your connection.');
      return false;
    }
  };

  const logout = () => {
    // Revoke the session server-side so the token cannot be replayed.
    // Fire-and-forget: local state is cleared regardless of the response.
    if (getAdminToken()) {
      fetch(`${API_URL}/admin/logout`, {
        method: 'POST',
        headers: authHeaders(),
      }).catch(() => { /* offline logout is still a local logout */ });
    }
    if (getVoterToken()) {
      fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: voterHeaders(),
      }).catch(() => { /* offline logout is still a local logout */ });
    }
    clearAdminToken();
    clearVoterToken();
    clearJudgeRequestToken();
    setUser(null);
    setPendingVoter(null);
    setChallengeToken(null);
    setJudgeRequest(null);
    setJudgeOnly(false);
    sessionStorage.removeItem('mtu_user');
  };

  const clearError = () => setLoginError(null);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'admin',
      isJudge: user?.role === 'judge',
      pendingVoter,
      judgeOnly,
      judgeRequest,
      loginError,
      signInWithGoogle,
      verifyRollNumber,
      requestJudgeAccess,
      cancelJudgeRequest,
      loginAdmin,
      logout,
      clearError,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
