import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Crown, Mail, KeyRound, ShieldCheck, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useElection } from '../context/ElectionContext';

type Mode = 'voter' | 'admin';
type Step = 'credentials' | 'otp';

export default function Login() {
  const { requestOtp, verifyOtp, loginAdmin, pendingOtp, loginError, clearError } = useAuth();
  const { darkMode } = useElection();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? '/vote';

  const [mode, setMode] = useState<Mode>('voter');
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  const bg = darkMode ? '#0D0D1A' : '#F8F5EF';
  const cardBg = darkMode ? '#161624' : '#FFFFFF';
  const textPrimary = darkMode ? '#F5F0E8' : '#1A1A2A';
  const textMuted = darkMode ? '#9CA3AF' : '#6B7280';
  const border = darkMode ? 'rgba(212,175,55,0.15)' : 'rgba(212,175,55,0.25)';
  const inputBg = darkMode ? '#0D0D1A' : '#F0EDE8';

  const handleVoterRequest = (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setCustomError(null);

    // Validate email syntax and @gmail.com domain
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.endsWith('@gmail.com')) {
      setCustomError('"Please enter a valid email address with correct syntax (e.g., example@gmail.com)."');
      return;
    }

    requestOtp(cleanEmail);
  };

  const handleOtpVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = verifyOtp(otp);
    if (ok) navigate(from, { replace: true });
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = loginAdmin(email, adminPassword);
    if (ok) navigate('/admin', { replace: true });
  };

  const handleBackToCredentials = () => {
    setStep('credentials');
    setOtp('');
    clearError();
    setCustomError(null);
  };

  // Sync step state when pendingOtp exists
  if (pendingOtp && step !== 'otp') {
    setStep('otp');
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
            MTU King &amp; Queen 2026
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

          {/* ── VOTER FLOW ── */}
          {mode === 'voter' && step === 'credentials' && (
            <form onSubmit={handleVoterRequest} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: textMuted }}>
                  Email address
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: textMuted }} />
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); clearError(); setCustomError(null); }}
                    placeholder="you@gmail.com"
                    className={`${inputClass} pl-10`}
                    style={inputStyle(!!activeError)}
                    required
                  />
                </div>
              </div>

              {activeError && (
                <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(255,77,141,0.1)', color: '#FF4D8D' }}>
                  {activeError}
                </p>
              )}

              <button
                type="submit"
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:scale-105 mt-1"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C84A)', color: '#0D0D1A' }}
              >
                Send OTP →
              </button>

              <p className="text-xs text-center" style={{ color: textMuted }}>
                Any valid @gmail.com email can request an OTP. This preview displays the code until email delivery is configured.
              </p>
            </form>
          )}

          {/* ── OTP STEP ── */}
          {mode === 'voter' && step === 'otp' && (
            <form onSubmit={handleOtpVerify} className="flex flex-col gap-4">
              <button
                type="button"
                onClick={handleBackToCredentials}
                className="flex items-center gap-1.5 text-xs self-start hover:opacity-80 transition-opacity font-medium cursor-pointer"
                style={{ color: '#D4AF37' }}
              >
                <ArrowLeft size={14} /> Back
              </button>

              {/* Show OTP for demo purposes */}
              <div
                className="rounded-xl p-4 text-center border"
                style={{ background: 'rgba(212,175,55,0.06)', borderColor: 'rgba(212,175,55,0.25)' }}
              >
                <p className="text-xs mb-1" style={{ color: textMuted }}>
                  OTP sent to <strong>{pendingOtp?.email || email}</strong>
                </p>
                <p className="text-xs mb-2" style={{ color: textMuted }}>
                  Preview mode — your code is shown below
                </p>
                <p className="font-mono font-bold text-3xl tracking-widest" style={{ color: '#D4AF37' }}>
                  {pendingOtp?.code || '893812'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: textMuted }}>
                  Enter 6-digit OTP
                </label>
                <div className="relative">
                  <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: textMuted }} />
                  <input
                    type="text"
                    value={otp}
                    onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); clearError(); }}
                    placeholder="000000"
                    maxLength={6}
                    className={`${inputClass} pl-10 font-mono tracking-widest text-center text-lg`}
                    style={inputStyle(!!loginError)}
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
                disabled={otp.length !== 6}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C84A)', color: '#0D0D1A' }}
              >
                <ShieldCheck size={15} className="inline mr-2" />
                Verify &amp; Sign In
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
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:scale-105 mt-1"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C84A)', color: '#0D0D1A' }}
              >
                Sign In as Admin
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}