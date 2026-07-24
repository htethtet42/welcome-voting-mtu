import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { AuthUser } from '../types';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from '../data';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  pendingOtp: { email: string; code: string } | null;
  loginError: string | null;
  requestOtp: (email: string) => void;
  verifyOtp: (code: string) => boolean;
  loginAdmin: (email: string, password: string) => boolean;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const s = sessionStorage.getItem('mtu_user');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });
  const [pendingOtp, setPendingOtp] = useState<{ email: string; code: string } | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (user) sessionStorage.setItem('mtu_user', JSON.stringify(user));
    else sessionStorage.removeItem('mtu_user');
  }, [user]);

  const requestOtp = (email: string) => {
    setLoginError(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setLoginError('Enter a valid email address.');
      return;
    }
    const code = generateOtp();
    // A frontend cannot safely send email itself. Connect a server/email provider
    // here before production; the code is visible only for this local preview.
    setPendingOtp({ email: normalizedEmail, code });
  };

  const verifyOtp = (code: string): boolean => {
    if (!pendingOtp) return false;
    if (code !== pendingOtp.code) {
      setLoginError('Incorrect OTP. Please try again.');
      return false;
    }
    const email = pendingOtp.email;
    const localPart = email.split('@')[0].replace(/[._-]+/g, ' ').trim();
    const name = localPart.replace(/\b\w/g, char => char.toUpperCase()) || 'Voter';
    setUser({
      id: `email:${email}`,
      studentId: 'EMAIL-VERIFIED',
      email,
      name,
      role: 'voter',
    });
    setPendingOtp(null);
    return true;
  };

  const loginAdmin = (email: string, password: string): boolean => {
    if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
      setUser({
        id: 'admin-001',
        studentId: 'ADMIN',
        email: ADMIN_EMAIL,
        name: 'Event Admin',
        role: 'admin',
      });
      setLoginError(null);
      return true;
    }
    setLoginError('Invalid admin credentials.');
    return false;
  };

  const logout = () => {
    setUser(null);
    setPendingOtp(null);
    sessionStorage.removeItem('mtu_user');
  };

  const clearError = () => setLoginError(null);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'admin',
      pendingOtp,
      loginError,
      requestOtp,
      verifyOtp,
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
