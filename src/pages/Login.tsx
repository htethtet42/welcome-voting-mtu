import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Crown, Mail, ShieldCheck, Eye, EyeOff, ArrowLeft, IdCard,
  GraduationCap, Scale, User, Vote, XCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useElection } from '../context/ElectionContext';
import { GOOGLE_CLIENT_ID } from '../lib/api';

type Mode = 'voter' | 'admin';

/**
 * Sign-in steps.
 *
 *   credentials ──► choose ──┬─► roll       (student: verify and vote)
 *                            └─► judgeName ──► pending  (judge: wait for an
 *                                                        organiser to decide)
 *
 * The role is chosen AFTER Google rather than by a third pill, for two reasons.
 * The pill row is 232px wide inside the card on a 320px phone, so three pills
 * wrap. And the judge path has a consequence — you wait for a human — which
 * deserves a sentence that a pill has no room for.
 */
type Step = 'credentials' | 'choose' | 'roll' | 'judgeName';

/** Elapsed time, spelled out for someone who has been staring at it. */
function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins} min ${secs.toString().padStart(2, '0')}s`;
}

export default function Login() {
  const {
    signInWithGoogle, verifyRollNumber, requestJudgeAccess, cancelJudgeRequest,
    resetSignIn, loginAdmin, pendingVoter, judgeOnly, judgeRequest,
    loginError, clearError,
  } = useAuth();
  const { darkMode } = useElection();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? '/vote';

  const [mode, setMode] = useState<Mode>('voter');
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [judgeName, setJudgeName] = useState('');
  const [judgeDept, setJudgeDept] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const bg = darkMode ? '#0D0D1A' : '#F8F5EF';
  const cardBg = darkMode ? '#161624' : '#FFFFFF';
  const textPrimary = darkMode ? '#F5F0E8' : '#1A1A2A';
  const textMuted = darkMode ? '#9CA3AF' : '#6B7280';
  const border = darkMode ? 'rgba(212,175,55,0.15)' : 'rgba(212,175,55,0.25)';
  const inputBg = darkMode ? '#0D0D1A' : '#F0EDE8';
  const raisedBg = darkMode ? '#1E1E30' : '#F0EDE8';

  // Royal answers WHO (a judge); gold answers HOW MUCH (the multiplier).
  // 400 on the night ground, 600 on cream where 400 fails contrast.
  const royal = darkMode ? '#60A5FA' : '#2563C4';

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
    if (judgeRequest) return;
    if (!GOOGLE_CLIENT_ID) return;

    const google = (window as any).google;
    if (!google?.accounts?.id || !googleButtonRef.current) return;

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response: { credential: string }) => {
        setSubmitting(true);
        const ok = await signInWithGoogle(response.credential);
        setSubmitting(false);
        if (ok) setStep('choose');
      },
    });

    google.accounts.id.renderButton(googleButtonRef.current, {
      theme: darkMode ? 'filled_black' : 'outline',
      size: 'large',
      width: 320,
      text: 'signin_with',
      shape: 'pill',
    });
  }, [mode, step, darkMode, signInWithGoogle, judgeRequest]);

  /**
   * Google verified the email while we were on another step (a resumed sign-in,
   * or a re-render). Move to the role choice.
   *
   * Previously this was a bare setStep() in the render body, which React
   * schedules as an extra render pass and warns about in strict mode.
   */
  useEffect(() => {
    if (pendingVoter && step === 'credentials') setStep('choose');
  }, [pendingVoter, step]);

  /** Drives the elapsed timer on the pending screen. */
  useEffect(() => {
    if (judgeRequest?.status !== 'pending') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [judgeRequest?.status]);

  /**
   * Approved. Hold the jade card long enough to read the multiplier, then open
   * the ballot. The session already exists at this point — this delay is for
   * the person, not the plumbing.
   */
  useEffect(() => {
    if (judgeRequest?.status !== 'approved') return;
    const id = setTimeout(() => navigate(from, { replace: true }), 1600);
    return () => clearTimeout(id);
  }, [judgeRequest?.status, navigate, from]);

  const handleRollVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const ok = await verifyRollNumber(rollNumber);
    setSubmitting(false);
    if (ok) navigate(from, { replace: true });
  };

  const handleJudgeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await requestJudgeAccess(judgeName, judgeDept);
    setSubmitting(false);
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const ok = await loginAdmin(email, adminPassword);
    setSubmitting(false);
    if (ok) navigate('/admin', { replace: true });
  };

  /**
   * Back from the role choice means "not as this account".
   *
   * It must clear pendingVoter, not just set the step: the resume effect below
   * sends you to `choose` whenever pendingVoter is set, so moving the step
   * alone bounces straight forward again and Back appears dead.
   */
  const handleBackToCredentials = () => {
    resetSignIn();
    setStep('credentials');
    setRollNumber('');
    setJudgeName('');
    setJudgeDept('');
    setCustomError(null);
  };

  const handleAbandonRequest = () => {
    cancelJudgeRequest();
    setStep('credentials');
    setJudgeName('');
    setJudgeDept('');
  };

  const inputClass = `w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors`;
  const activeError = customError || loginError;

  const inputStyle = (hasError: boolean) => ({
    background: inputBg,
    color: textPrimary,
    border: `1px solid ${hasError ? '#FF4D8D' : border}`,
  });

  const errorBox = (msg: string) => (
    <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(255,77,141,0.1)', color: '#FF4D8D' }}>
      {msg}
    </p>
  );

  const signedInCard = (
    <div
      className="rounded-xl p-4 text-center border"
      style={{ background: 'rgba(0,201,167,0.06)', borderColor: 'rgba(0,201,167,0.25)' }}
    >
      <p className="text-xs mb-1" style={{ color: textMuted }}>Signed in as</p>
      <p className="text-sm font-semibold break-all" style={{ color: '#00C9A7' }}>
        {pendingVoter?.email}
      </p>
      {pendingVoter?.name && (
        <p className="text-xs mt-1" style={{ color: textMuted }}>{pendingVoter.name}</p>
      )}
    </div>
  );

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
          {/* ── PENDING / DECIDED: takes over the whole card ── */}
          {judgeRequest ? (
            <div className="flex flex-col gap-4">
              {judgeRequest.status === 'pending' && (
                <>
                  <div
                    className="rounded-2xl p-5 flex flex-col items-center gap-2 text-center border"
                    style={{ background: 'rgba(59,130,246,0.07)', borderColor: 'rgba(59,130,246,0.32)' }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full animate-pulse-royal"
                      style={{ background: '#60A5FA' }}
                    />
                    <p className="font-mono text-[10px] tracking-[0.17em] uppercase" style={{ color: royal }}>
                      Waiting for approval
                    </p>
                    <p className="text-sm font-semibold" style={{ color: textPrimary }}>
                      {judgeRequest.name || 'Your request'}
                    </p>
                    {judgeRequest.email && (
                      <p className="text-xs break-all" style={{ color: textMuted }}>{judgeRequest.email}</p>
                    )}
                    {judgeRequest.code && (
                      <p className="font-mono font-bold text-2xl tracking-wider mt-1" style={{ color: royal }}>
                        {judgeRequest.code}
                      </p>
                    )}
                    {/* Under a minute the timer stays quiet. Past a minute it
                        appears, so a forgotten judge escalates themselves
                        instead of waiting politely and never voting. */}
                    {now - new Date(judgeRequest.requestedAt).getTime() > 60_000 && (
                      <p className="font-mono text-[11px]" style={{ color: textMuted }}>
                        waiting {formatElapsed(now - new Date(judgeRequest.requestedAt).getTime())}
                      </p>
                    )}
                  </div>

                  <p className="text-xs text-center leading-relaxed" style={{ color: textMuted }}>
                    {judgeRequest.code ? (
                      <>Show code <strong style={{ color: royal }}>{judgeRequest.code}</strong> to an organiser.<br /></>
                    ) : null}
                    This screen opens your ballot the moment you are approved.
                  </p>

                  <button
                    type="button"
                    onClick={handleAbandonRequest}
                    className="w-full py-2.5 rounded-xl text-xs font-medium transition-opacity hover:opacity-80"
                    style={{ color: textMuted, border: `1px solid ${darkMode ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)'}` }}
                  >
                    Cancel request
                  </button>
                </>
              )}

              {judgeRequest.status === 'approved' && (
                <div
                  className="rounded-2xl p-5 flex flex-col items-center gap-2 text-center border"
                  style={{ background: 'rgba(0,201,167,0.07)', borderColor: 'rgba(0,201,167,0.36)' }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: '#00C9A7', boxShadow: '0 0 0 5px rgba(0,201,167,0.16)' }}
                  />
                  <p className="font-mono text-[10px] tracking-[0.17em] uppercase" style={{ color: '#00C9A7' }}>
                    Approved
                  </p>
                  <p className="text-sm font-semibold" style={{ color: textPrimary }}>{judgeRequest.name}</p>
                  {/* Gold, not royal: this is the multiplier, not the role. */}
                  <span
                    className="inline-flex items-center gap-1.5 font-mono font-bold text-xs px-2.5 py-1 rounded-full mt-1"
                    style={{
                      background: 'rgba(212,175,55,0.13)',
                      border: '1px solid rgba(212,175,55,0.4)',
                      color: '#E8C84A',
                    }}
                  >
                    <Scale size={12} /> {judgeRequest.weight}&times;
                  </span>
                  <p className="font-mono text-[11px] mt-1" style={{ color: textMuted }}>
                    opening your ballot&hellip;
                  </p>
                </div>
              )}

              {judgeRequest.status === 'declined' && (
                <>
                  <div
                    className="rounded-2xl p-5 flex flex-col items-center gap-2 text-center border"
                    style={{ background: 'rgba(255,77,141,0.07)', borderColor: 'rgba(255,77,141,0.32)' }}
                  >
                    <XCircle size={20} style={{ color: '#FF4D8D' }} />
                    <p className="font-mono text-[10px] tracking-[0.17em] uppercase" style={{ color: '#FF4D8D' }}>
                      Not approved
                    </p>
                    <p className="text-xs leading-relaxed mt-1" style={{ color: textMuted }}>
                      The organisers could not confirm this account as a judge.
                    </p>
                  </div>

                  {/* No dead end: a student who tried the judge door gets walked
                      back to the one they wanted. */}
                  <button
                    type="button"
                    onClick={handleAbandonRequest}
                    className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:scale-105"
                    style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C84A)', color: '#0D0D1A' }}
                  >
                    Vote as a student instead
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Mode toggle — two pills only. A third would wrap at 320px. */}
              <div
                className="flex p-1 rounded-xl mb-6"
                style={{ background: darkMode ? '#0D0D1A' : '#F0EDE8' }}
              >
                {(['voter', 'admin'] as Mode[]).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMode(m); setStep('credentials'); clearError(); setCustomError(null); }}
                    className="flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5"
                    style={{
                      background: mode === m ? (darkMode ? '#161624' : '#FFFFFF') : 'transparent',
                      color: mode === m ? '#D4AF37' : textMuted,
                      boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
                    }}
                  >
                    {m === 'voter' ? <><Vote size={14} /> Vote</> : <><ShieldCheck size={14} /> Admin</>}
                  </button>
                ))}
              </div>

              {/* ── STEP 1: GOOGLE SIGN-IN ── */}
              {mode === 'voter' && step === 'credentials' && (
                <div className="flex flex-col gap-5">
                  <div className="text-center">
                    <p className="text-sm font-medium mb-1" style={{ color: textPrimary }}>
                      Sign in with your Google account
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: textMuted }}>
                      You will confirm who you are on the next step.
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
                      Verifying your account&hellip;
                    </p>
                  )}

                  {activeError && errorBox(activeError)}
                </div>
              )}

              {/* ── STEP 2: WHO ARE YOU? ── */}
              {mode === 'voter' && step === 'choose' && (
                <div className="flex flex-col gap-4">
                  <button
                    type="button"
                    onClick={handleBackToCredentials}
                    className="flex items-center gap-1.5 text-xs self-start hover:opacity-80 transition-opacity font-medium cursor-pointer"
                    style={{ color: '#D4AF37' }}
                  >
                    <ArrowLeft size={14} /> Back
                  </button>

                  {signedInCard}

                  <p className="text-xs font-medium" style={{ color: textMuted }}>How are you voting?</p>

                  {/* Hidden when the account is off-roll: the roll-number step
                      would reject it whatever they typed, so offering it would
                      only send a teacher down a path that cannot work. */}
                  {!judgeOnly && (
                    <button
                      type="button"
                      onClick={() => { setStep('roll'); clearError(); }}
                      className="rounded-xl p-3.5 flex items-start gap-3 text-left transition-transform hover:scale-[1.02]"
                      style={{ background: raisedBg, border: `1px solid ${border}` }}
                    >
                      <GraduationCap size={18} style={{ color: '#D4AF37' }} className="mt-0.5 shrink-0" />
                      <span>
                        <span className="block text-sm font-semibold" style={{ color: textPrimary }}>Student</span>
                        <span className="block text-xs mt-0.5 leading-relaxed" style={{ color: textMuted }}>
                          Confirm your roll number and vote right away.
                        </span>
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => { setStep('judgeName'); clearError(); }}
                    className="rounded-xl p-3.5 flex items-start gap-3 text-left transition-transform hover:scale-[1.02]"
                    style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.3)' }}
                  >
                    <Scale size={18} style={{ color: royal }} className="mt-0.5 shrink-0" />
                    <span>
                      <span className="block text-sm font-semibold" style={{ color: royal }}>Teacher or judge</span>
                      <span className="block text-xs mt-0.5 leading-relaxed" style={{ color: textMuted }}>
                        An organiser approves you before you can vote.
                      </span>
                    </span>
                  </button>

                  {activeError && errorBox(activeError)}
                </div>
              )}

              {/* ── STEP 3a: STUDENT ROLL NUMBER ── */}
              {mode === 'voter' && step === 'roll' && (
                <form onSubmit={handleRollVerify} className="flex flex-col gap-4">
                  <button
                    type="button"
                    onClick={() => { setStep('choose'); clearError(); }}
                    className="flex items-center gap-1.5 text-xs self-start hover:opacity-80 transition-opacity font-medium cursor-pointer"
                    style={{ color: '#D4AF37' }}
                  >
                    <ArrowLeft size={14} /> Back
                  </button>

                  {signedInCard}

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

                  {loginError && errorBox(loginError)}

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

              {/* ── STEP 3b: JUDGE NAME ── */}
              {mode === 'voter' && step === 'judgeName' && (
                <form onSubmit={handleJudgeRequest} className="flex flex-col gap-4">
                  <button
                    type="button"
                    onClick={() => { setStep('choose'); clearError(); }}
                    className="flex items-center gap-1.5 text-xs self-start hover:opacity-80 transition-opacity font-medium cursor-pointer"
                    style={{ color: royal }}
                  >
                    <ArrowLeft size={14} /> Back
                  </button>

                  {signedInCard}

                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: textMuted }}>
                      Your name, as the organisers know it
                    </label>
                    <div className="relative">
                      <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: textMuted }} />
                      <input
                        type="text"
                        value={judgeName}
                        onChange={e => { setJudgeName(e.target.value); clearError(); }}
                        placeholder="e.g. Daw Khin Myo Myint"
                        className={`${inputClass} pl-10`}
                        style={inputStyle(!!loginError)}
                        autoFocus
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: textMuted }}>
                      Department or role <span style={{ opacity: 0.6 }}>(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={judgeDept}
                      onChange={e => setJudgeDept(e.target.value)}
                      placeholder="e.g. CEIT, Head of Department"
                      className={inputClass}
                      style={inputStyle(false)}
                    />
                  </div>

                  {loginError && errorBox(loginError)}

                  <button
                    type="submit"
                    disabled={submitting || !judgeName.trim()}
                    className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(135deg, #3B82F6, #60A5FA)', color: '#0A1020' }}
                  >
                    <Scale size={15} className="inline mr-2" />
                    {submitting ? 'Sending…' : 'Request judge access'}
                  </button>

                  <p className="text-xs text-center leading-relaxed" style={{ color: textMuted }}>
                    The organisers use this to recognise you.<br />It does not grant access on its own.
                  </p>
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
                        placeholder="admin@mtu.edu.mm"
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

                  {loginError && errorBox(loginError)}

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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
