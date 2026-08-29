import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { AuthUser } from '../types';
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
} from '../lib/api';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  /** Set once Google has verified the email and the roll number is awaited. */
  pendingVoter: { email: string; name: string; attemptsLeft: number } | null;
  loginError: string | null;
  /** Step 1: exchange a Google ID token for a roll-number challenge. */
  signInWithGoogle: (credential: string) => Promise<boolean>;
  /** Step 2: verify the student roll number and start the voting session. */
  verifyRollNumber: (studentId: string) => Promise<boolean>;
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

  useEffect(() => {
    if (user) sessionStorage.setItem('mtu_user', JSON.stringify(user));
    else sessionStorage.removeItem('mtu_user');
  }, [user]);

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
            `That doesn't look like a valid roll number. Use the format III.BE-CEIT-23. ${left} attempt${left === 1 ? '' : 's'} remaining.`
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
    setUser(null);
    setPendingVoter(null);
    setChallengeToken(null);
    sessionStorage.removeItem('mtu_user');
  };

  const clearError = () => setLoginError(null);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'admin',
      pendingVoter,
      loginError,
      signInWithGoogle,
      verifyRollNumber,
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
