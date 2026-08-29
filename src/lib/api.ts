/**
 * Base URL of the Go backend, e.g. "http://localhost:8081/api".
 *
 * Set VITE_API_URL in `.env` for local development and in the Vercel project
 * settings for deployments. Vite inlines this at build time, so changing it
 * requires a rebuild — it is not read at runtime.
 *
 * Previously this constant was hardcoded (to an ephemeral tunnel URL) and
 * duplicated across ElectionContext and Admin, where the two copies could
 * drift. Import it from here instead of redeclaring it.
 */
const configured = import.meta.env.VITE_API_URL?.trim();

if (!configured && import.meta.env.PROD) {
  // In production a missing value means every request silently hits the wrong
  // origin, so fail loudly at startup rather than at first fetch.
  throw new Error(
    'VITE_API_URL is not set. Configure it in the deployment environment and rebuild.'
  );
}

// Trailing slashes would produce "//api/votes" when concatenated.
export const API_URL = (configured || 'http://localhost:8081/api').replace(/\/+$/, '');

const TOKEN_KEY = 'mtu_admin_token';

/**
 * Admin session token issued by POST /api/admin/login.
 *
 * Kept in sessionStorage so it dies with the tab. The token is the ONLY thing
 * the backend trusts — the `isAdmin` flag in AuthContext is a UI convenience
 * and grants nothing on its own.
 */
export function getAdminToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* private browsing — the session simply won't persist across reloads */
  }
}

export function clearAdminToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** Authorization header for admin-only endpoints; empty when not logged in. */
export function authHeaders(): Record<string, string> {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const VOTER_TOKEN_KEY = 'mtu_voter_token';

/**
 * Voter session token, issued only after BOTH factors pass: Google verifies
 * the email, and the student roll number matches the official roll.
 *
 * The backend derives voter identity from this token. Nothing the client puts
 * in a request body is trusted for identity any more.
 */
export function getVoterToken(): string | null {
  try {
    return sessionStorage.getItem(VOTER_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setVoterToken(token: string): void {
  try {
    sessionStorage.setItem(VOTER_TOKEN_KEY, token);
  } catch {
    /* private browsing */
  }
}

export function clearVoterToken(): void {
  try {
    sessionStorage.removeItem(VOTER_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** Authorization header for voter endpoints (/votes, /my-ballots). */
export function voterHeaders(): Record<string, string> {
  const token = getVoterToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Google OAuth client ID, from Google Cloud Console. */
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
