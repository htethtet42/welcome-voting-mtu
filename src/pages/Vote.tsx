import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Check, X, Crown, Clock, AlertCircle, CheckCircle2, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useElection } from '../context/ElectionContext';
import { useAuth } from '../context/AuthContext';
import { CATEGORY_META, type Category } from '../types';
import CountdownTimer from '../components/CountdownTimer';

const CATEGORIES: Category[] = ['king', 'queen','style','smart'];
const DEADLINE = new Date('2026-07-25T23:59:59');

export default function Vote() {
  const { candidates, election, voteRecords, castVote, darkMode } = useElection();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeCategory, setActiveCategory] = useState<Category>('king');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [qrId, setQrId] = useState<string | null>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null);

  const bg = darkMode ? '#0D0D1A' : '#F8F5EF';
  const cardBg = darkMode ? '#161624' : '#FFFFFF';
  const textPrimary = darkMode ? '#F5F0E8' : '#1A1A2A';
  const textMuted = darkMode ? '#9CA3AF' : '#6B7280';
  const border = darkMode ? 'rgba(212,175,55,0.12)' : 'rgba(212,175,55,0.25)';

  useEffect(() => {
    const cat = searchParams.get('category') as Category | null;
    const cid = searchParams.get('candidate');
    if (cat && CATEGORIES.includes(cat)) setActiveCategory(cat);
    if (cid) {
      const c = candidates.find(x => x.id === cid);
      if (c) {
        setActiveCategory(c.category);
        setTimeout(() => highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400);
      }
    }
  }, [searchParams, candidates]);

  const highlightId = searchParams.get('candidate');
  const meta = CATEGORY_META[activeCategory];
  const activeCandidates = candidates.filter(c => c.category === activeCategory && c.isActive);
  const votedCategories = Object.fromEntries(
    CATEGORIES.map(category => [category, voteRecords.some(record => record.voterId === user?.id && record.category === category)])
  ) as Partial<Record<Category, boolean>>;
  const hasVoted = !!votedCategories[activeCategory];
  const votingOpen = election.status === 'open';

  const confirmCandidate = candidates.find(c => c.id === confirmId);
  const qrCandidate = candidates.find(c => c.id === qrId);

  const handleConfirm = async () => {
    if (!confirmId || !confirmCandidate) return;
    setSubmitting(true);
    // Simulate network latency (optimistic UI per SRS)
    await new Promise(r => setTimeout(r, 600));
    if (!user) return;
    const result = castVote(confirmId, confirmCandidate.category, user);
    setSubmitting(false);
    setConfirmId(null);
    if (result === 'success') {
      setSuccessMsg(`Your vote for ${confirmCandidate.name} has been recorded! ✓`);
      setTimeout(() => setSuccessMsg(null), 5000);
    } else if (result === 'already_voted') {
      setSuccessMsg('You have already voted in this category.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } else if (result === 'closed') {
      setSuccessMsg('Voting is currently closed.');
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const getQrUrl = (id: string) =>
    `${window.location.origin}${window.location.pathname}#/vote?candidate=${id}`;

  // Gate: must be logged in to vote
  if (!isAuthenticated) {
    return (
      <div style={{ background: bg, minHeight: '100vh' }} className="pt-16 flex items-center justify-center px-4">
        <div
          className="w-full max-w-sm rounded-3xl p-8 border text-center"
          style={{ background: cardBg, borderColor: 'rgba(212,175,55,0.3)' }}
        >
          <Crown size={36} className="mx-auto mb-4" style={{ color: '#D4AF37' }} />
          <h2 className="font-display font-bold text-xl mb-2" style={{ color: textPrimary }}>Sign In to Vote</h2>
          <p className="text-sm mb-6" style={{ color: textMuted }}>
            You must sign in with your student credentials to cast a ballot.
          </p>
          <button
            onClick={() => navigate('/login', { state: { from: '/vote' } })}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C84A)', color: '#0D0D1A' }}
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: bg, color: textPrimary, minHeight: '100vh' }} className="pt-16">
      {/* Header */}
      <div
        className="py-8 text-center"
        style={{
          background: darkMode
            ? 'linear-gradient(to bottom, rgba(26,26,62,0.5), transparent)'
            : 'linear-gradient(to bottom, rgba(212,175,55,0.05), transparent)',
        }}
      >
        <span className="font-mono text-xs tracking-widest uppercase" style={{ color: '#D4AF37' }}>
          Cast Your Ballot
        </span>
        <h1 className="font-display text-3xl sm:text-4xl font-bold mt-1 mb-3" style={{ color: textPrimary }}>
          Vote for Your Champion
        </h1>
        <div className="flex items-center justify-center gap-2 mb-3">
          <Clock size={13} style={{ color: textMuted }} />
          <span className="text-sm" style={{ color: textMuted }}>Closes in:</span>
          <CountdownTimer target={DEADLINE} compact darkMode={darkMode} />
        </div>
        <p className="text-xs" style={{ color: textMuted }}>
          Signed in as <span style={{ color: '#D4AF37' }}>{user?.name}</span> ({user?.studentId})
        </p>

        {!votingOpen && (
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mt-3"
            style={{ background: 'rgba(255,77,141,0.1)', color: '#FF4D8D', border: '1px solid rgba(255,77,141,0.25)' }}
          >
            <AlertCircle size={14} />
            {election.status === 'closed' ? 'Voting is closed' : election.status === 'published' ? 'Results published — see Results page' : 'Voting not yet open'}
          </div>
        )}
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Voted-categories summary (FR-4.5) */}
        <div className="flex gap-3 mb-6 flex-wrap">
          {CATEGORIES.map(cat => {
            const m = CATEGORY_META[cat];
            const voted = votedCategories[cat];
            return (
              <div
                key={cat}
                className="flex items-center gap-2 px-3 py-2 rounded-full text-sm border"
                style={{
                  background: voted ? 'rgba(0,201,167,0.08)' : m.bgColor,
                  borderColor: voted ? 'rgba(0,201,167,0.3)' : m.borderColor,
                  color: voted ? '#00C9A7' : m.color,
                }}
              >
                {voted ? <CheckCircle2 size={14} /> : <span>{m.icon}</span>}
                {m.label}: {voted ? 'Vote recorded ✓' : 'Not yet voted'}
              </div>
            );
          })}
        </div>

        {/* Category tabs */}
        <div
          className="flex gap-1 p-1 rounded-2xl mb-6"
          style={{ background: darkMode ? '#161624' : '#FFFFFF', border: `1px solid ${border}` }}
        >
          {CATEGORIES.map(cat => {
            const m = CATEGORY_META[cat];
            const isActive = activeCategory === cat;
            const voted = votedCategories[cat];
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: isActive ? m.bgColor : 'transparent',
                  color: isActive ? m.color : textMuted,
                  border: isActive ? `1px solid ${m.borderColor}` : '1px solid transparent',
                }}
              >
                <span className="text-lg">{m.icon}</span>
                <span>{m.label}</span>
                {voted && <Check size={12} style={{ color: '#00C9A7' }} />}
              </button>
            );
          })}
        </div>

        {/* Category heading */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-2xl" style={{ color: meta.color }}>
              {meta.icon} {meta.label}
            </h2>
            <p className="text-sm mt-0.5" style={{ color: textMuted }}>{meta.description}</p>
          </div>
          {hasVoted && (
            <span
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
              style={{ background: 'rgba(0,201,167,0.1)', color: '#00C9A7', border: '1px solid rgba(0,201,167,0.25)' }}
            >
              <CheckCircle2 size={14} /> Your vote is recorded
            </span>
          )}
        </div>

        {/* Voted banner (FR-4.5) */}
        {hasVoted && (
          <div
            className="rounded-2xl p-4 mb-5 flex items-center gap-3"
            style={{ background: 'rgba(0,201,167,0.08)', border: '1px solid rgba(0,201,167,0.2)' }}
          >
            <CheckCircle2 size={20} style={{ color: '#00C9A7', flexShrink: 0 }} />
            <div>
              <p className="font-semibold text-sm" style={{ color: '#00C9A7' }}>
                Your vote for {meta.label} has been recorded.
              </p>
              <p className="text-xs mt-0.5" style={{ color: textMuted }}>
                Votes are final and cannot be changed. Results will be published after voting closes.
              </p>
            </div>
          </div>
        )}

        {/* Candidate grid — 2 cols mobile, 3 cols desktop (SRS 6.4) */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pb-20">
          {activeCandidates.map(c => {
            const isHighlighted = c.id === highlightId;
            return (
              <div
                key={c.id}
                ref={isHighlighted ? highlightRef : null}
                className="rounded-2xl overflow-hidden transition-all duration-300"
                style={{
                  background: cardBg,
                  border: isHighlighted ? `2px solid ${meta.color}` : `1px solid ${border}`,
                  boxShadow: isHighlighted ? `0 0 20px ${meta.bgColor}` : undefined,
                }}
              >
                {/* Photo */}
                <div className="relative h-44 sm:h-56 bg-night-900 overflow-hidden">
                  <img src={c.photo} alt={c.name} className="w-full h-full object-cover" />
                  <div
                    className="absolute inset-0"
                    style={{ background: 'linear-gradient(to top, rgba(13,13,26,0.85) 0%, transparent 50%)' }}
                  />
                  <button
                    onClick={() => setQrId(c.id)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.55)', color: '#D4AF37' }}
                    title="Show QR code"
                  >
                    <QrCode size={13} />
                  </button>
                </div>

                {/* Info */}
                <div className="p-3">
                  <p className="font-display font-bold text-sm leading-tight" style={{ color: textPrimary }}>
                    {c.name}
                  </p>
                  <p className="font-mono text-xs mt-0.5 mb-2" style={{ color: meta.color }}>
                    "{c.nickname}" · {c.department}
                  </p>
                  <p className="text-xs leading-relaxed mb-3 line-clamp-2" style={{ color: textMuted }}>{c.bio}</p>

                  <button
                    disabled={!votingOpen || hasVoted}
                    onClick={() => !hasVoted && votingOpen && setConfirmId(c.id)}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    style={
                      hasVoted
                        ? { background: 'rgba(0,201,167,0.1)', color: '#00C9A7' }
                        : !votingOpen
                        ? { background: 'rgba(156,163,175,0.1)', color: textMuted }
                        : { background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`, color: '#0D0D1A' }
                    }
                  >
                    {hasVoted ? '✓ Voted' : !votingOpen ? 'Closed' : 'Vote'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Success toast */}
      {successMsg && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-medium flex items-center gap-2 shadow-xl"
          style={{ background: 'rgba(0,201,167,0.15)', color: '#00C9A7', border: '1px solid rgba(0,201,167,0.4)', backdropFilter: 'blur(12px)' }}
        >
          <Check size={16} /> {successMsg}
        </div>
      )}

      {/* QR Modal */}
      {qrCandidate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={() => setQrId(null)}
        >
          <div
            className="relative rounded-3xl p-6 max-w-xs w-full text-center"
            style={{ background: cardBg, border: `1px solid ${CATEGORY_META[qrCandidate.category].borderColor}` }}
            onClick={e => e.stopPropagation()}
          >
            <button className="absolute top-4 right-4" onClick={() => setQrId(null)} style={{ color: textMuted }}>
              <X size={18} />
            </button>
            <img src={qrCandidate.photo} alt={qrCandidate.name} className="w-14 h-14 rounded-full object-cover mx-auto mb-3 border-2" style={{ borderColor: CATEGORY_META[qrCandidate.category].color }} />
            <p className="font-display font-bold" style={{ color: textPrimary }}>{qrCandidate.name}</p>
            <p className="text-xs mb-4" style={{ color: CATEGORY_META[qrCandidate.category].color }}>
              {CATEGORY_META[qrCandidate.category].icon} {CATEGORY_META[qrCandidate.category].label}
            </p>
            <div className="inline-block p-3 rounded-2xl bg-white mb-3">
              <QRCodeSVG value={getQrUrl(qrCandidate.id)} size={160} fgColor="#0D0D1A" bgColor="#FFFFFF" />
            </div>
            <p className="text-xs" style={{ color: textMuted }}>Scan to vote for {qrCandidate.nickname}</p>
          </div>
        </div>
      )}

      {/* Confirm Vote Modal (FR-4.3) */}
      {confirmCandidate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="rounded-3xl p-6 max-w-sm w-full text-center"
            style={{ background: cardBg, border: `1px solid ${CATEGORY_META[confirmCandidate.category].borderColor}` }}
          >
            <Crown size={32} className="mx-auto mb-4" style={{ color: CATEGORY_META[confirmCandidate.category].color }} />
            <h3 className="font-display font-bold text-xl mb-2" style={{ color: textPrimary }}>Confirm Your Vote</h3>
            <p className="text-sm mb-1" style={{ color: textMuted }}>You are voting for</p>
            <p className="font-display font-bold text-xl" style={{ color: CATEGORY_META[confirmCandidate.category].color }}>
              {confirmCandidate.name}
            </p>
            <p className="text-sm mb-2" style={{ color: textMuted }}>
              {confirmCandidate.department} · {confirmCandidate.year}
            </p>
            <div
              className="text-xs px-3 py-2 rounded-xl mb-6"
              style={{ background: 'rgba(212,175,55,0.06)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.2)' }}
            >
              ⚠️ This vote is final and cannot be changed (FR-4.3)
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmId(null)}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl text-sm font-medium border transition-colors"
                style={{ borderColor: border, color: textMuted }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl text-sm font-bold transition-all hover:scale-105 disabled:opacity-70"
                style={{
                  background: `linear-gradient(135deg, ${CATEGORY_META[confirmCandidate.category].color}, ${CATEGORY_META[confirmCandidate.category].color}cc)`,
                  color: '#0D0D1A',
                }}
              >
                {submitting ? 'Recording…' : 'Confirm Vote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
