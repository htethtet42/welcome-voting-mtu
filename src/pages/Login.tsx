import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Crown, Mail, ShieldCheck, Eye, EyeOff, ArrowLeft, IdCard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useElection } from '../context/ElectionContext';
import { GOOGLE_CLIENT_ID } from '../lib/api';

type Mode = 'voter' | 'admin';
type Step = 'credentials' | 'roll';

export default function Login() {
  const { signInWithGoogle, verifyRollNumber, loginAdmin, pendingVoter, loginError, clearError } = useAuth();
  const { darkMode } = useElection();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? '/vote';

  const [mode, setMode] = useState<Mode>('voter');
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const bg = darkMode ? '#0D0D1A' : '#F8F5EF';
  const cardBg = darkMode ? '#161624' : '#FFFFFF';
  const textPrimary = darkMode ? '#F5F0E8' : '#1A1A2A';
  const textMuted = darkMode ? '#9CA3AF' : '#6B7280';
  const border = darkMode ? 'rgba(212,175,55,0.15)' : 'rgba(212,175,55,0.25)';
  const inputBg = darkMode ? '#0D0D1A' : '#F0EDE8';

  const googleButtonRef = useRef<HTMLDivElement>(null);

  /**
   * Renders Google's official Sign In button.
   *
   * The button must come from Google's script: it returns a signed ID token
   * that only Google can mint, which the backend verifies. A hand-rolled
   * button could not produce a trustworthy credential.
   */
  useEffect(() => {
    if (mode !== 'voter' || step !== 'credentials') return;
    if (!GOOGLE_CLIENT_ID) return;

    const google = (window as any).google;
    if (!google?.accounts?.id || !googleButtonRef.current) return;

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response: { credential: string }) => {
        setSubmitting(true);
        const ok = await signInWithGoogle(response.credential);
        setSubmitting(false);
        if (ok) setStep('roll');
      },
    });

    google.accounts.id.renderButton(googleButtonRef.current, {
      theme: darkMode ? 'filled_black' : 'outline',
      size: 'large',
      width: 320,
      text: 'signin_with',
      shape: 'pill',
    });
  }, [mode, step, darkMode, signInWithGoogle]);

  const handleRollVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const ok = await verifyRollNumber(rollNumber);
    setSubmitting(false);
    if (ok) navigate(from, { replace: true });
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const ok = await loginAdmin(email, adminPassword);
    setSubmitting(false);
    if (ok) navigate('/admin', { replace: true });
  };

  const handleBackToCredentials = () => {
    setStep('credentials');
    setRollNumber('');
    clearError();
    setCustomError(null);
  };

  // Google verified the email; the roll number is still outstanding.
  if (pendingVoter && step !== 'roll') {
    setStep('roll');
  }

  const inputClass = `w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors`;
  const activeError = customError || loginError;

  const inputStyle = (hasError: boolean) => ({
    background: inputBg,
    color: textPrimary,
    border: `1px solid ${hasError ? '#FF4D8D' : border}`,
  });

  return (
    <div
      style={{ background: bg, minHeight: '100vh' }}
      className="flex items-center justify-center px-4 py-12"
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center border-2 animate-float"
            style={{ background: 'rgba(212,175,55,0.1)', borderColor: 'rgba(212,175,55,0.4)' }}
          >
            <Crown size={30} style={{ color: '#D4AF37' }} />
          </div>
          <h1 className="font-display font-bold text-2xl" style={{ color: textPrimary }}>
            <span className="text-shimmer">MTU King &amp; Queen 2026</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: textMuted }}>Sign in to cast your vote</p>
        </div>

        <div className="rounded-3xl p-7 border" style={{ background: cardBg, borderColor: border }}>
          {/* Mode toggle */}
          <div
            className="flex p-1 rounded-xl mb-6"
            style={{ background: darkMode ? '#0D0D1A' : '#F0EDE8' }}
          >
            {(['voter', 'admin'] as Mode[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setStep('credentials'); clearError(); setCustomError(null); }}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize"
                style={{
                  background: mode === m ? (darkMode ? '#161624' : '#FFFFFF') : 'transparent',
                  color: mode === m ? '#D4AF37' : textMuted,
                  boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
                }}
              >
                {m === 'voter' ? '🎓 Student' : '🛡️ Admin'}
              </button>
            ))}
          </div>

          {/* ── VOTER STEP 1: GOOGLE SIGN-IN ── */}
          {mode === 'voter' && step === 'credentials' && (
            <div className="flex flex-col gap-5">
              <div className="text-center">
                <p className="text-sm font-medium mb-1" style={{ color: textPrimary }}>
                  Sign in with your student Google account
                </p>
                <p className="text-xs leading-relaxed" style={{ color: textMuted }}>
                  You will enter your student roll number on the next step.
                </p>
              </div>

              {/* Google renders its own button here */}
              <div className="flex justify-center min-h-[44px]" ref={googleButtonRef} />

              {!GOOGLE_CLIENT_ID && (
                <p className="text-xs px-3 py-2 rounded-lg text-center" style={{ background: 'rgba(255,77,141,0.1)', color: '#FF4D8D' }}>
                  Google sign-in is not configured. Set VITE_GOOGLE_CLIENT_ID and rebuild.
                </p>
              )}

              {submitting && (
                <p className="text-xs text-center" style={{ color: textMuted }}>
                  Verifying your account…
                </p>
              )}

              {activeError && (
                <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(255,77,141,0.1)', color: '#FF4D8D' }}>
                  {activeError}
                </p>
              )}
            </div>
          )}

          {/* ── VOTER STEP 2: STUDENT ROLL NUMBER ── */}
          {mode === 'voter' && step === 'roll' && (
            <form onSubmit={handleRollVerify} className="flex flex-col gap-4">
              <button
                type="button"
                onClick={handleBackToCredentials}
                className="flex items-center gap-1.5 text-xs self-start hover:opacity-80 transition-opacity font-medium cursor-pointer"
                style={{ color: '#D4AF37' }}
              >
                <ArrowLeft size={14} /> Back
              </button>

              <div
                className="rounded-xl p-4 text-center border"
                style={{ background: 'rgba(0,201,167,0.06)', borderColor: 'rgba(0,201,167,0.25)' }}
              >
                <p className="text-xs mb-1" style={{ color: textMuted }}>Signed in as</p>
                <p className="text-sm font-semibold" style={{ color: '#00C9A7' }}>
                  {pendingVoter?.email}
                </p>
                {pendingVoter?.name && (
                  <p className="text-xs mt-1" style={{ color: textMuted }}>{pendingVoter.name}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: textMuted }}>
                  Your student roll number
                </label>
                <div className="relative">
                  <IdCard size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: textMuted }} />
                  <input
                    type="text"
                    value={rollNumber}
                    onChange={e => { setRollNumber(e.target.value); clearError(); }}
                    placeholder="e.g. III.BE.CEIT-23"
                    className={`${inputClass} pl-10 font-mono tracking-wide`}
                    style={inputStyle(!!loginError)}
                    autoFocus
                    required
                  />
                </div>
              </div>

              {loginError && (
                <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(255,77,141,0.1)', color: '#FF4D8D' }}>
                  {loginError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || !rollNumber.trim()}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C84A)', color: '#0D0D1A' }}
              >
                <ShieldCheck size={15} className="inline mr-2" />
                {submitting ? 'Verifying…' : 'Verify & Start Voting'}
              </button>
            </form>
          )}

          {/* ── ADMIN LOGIN ── */}
          {mode === 'admin' && (
            <form onSubmit={handleAdminLogin} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: textMuted }}>
                  Admin Email
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: textMuted }} />
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); clearError(); setCustomError(null); }}
                    placeholder="..............."
                    className={`${inputClass} pl-10`}
                    style={inputStyle(!!loginError)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: textMuted }}>
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={e => { setAdminPassword(e.target.value); clearError(); }}
                    placeholder="••••••••"
                    className={`${inputClass} pr-10`}
                    style={inputStyle(!!loginError)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: textMuted }}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {loginError && (
                <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(255,77,141,0.1)', color: '#FF4D8D' }}>
                  {loginError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:scale-105 mt-1 disabled:opacity-60 disabled:hover:scale-100 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C84A)', color: '#0D0D1A' }}
              >
                {submitting ? 'Signing In…' : 'Sign In as Admin'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}