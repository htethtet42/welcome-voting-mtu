import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Check, X, Crown, Clock, AlertCircle, CheckCircle2, QrCode, ShieldCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useElection } from '../context/ElectionContext';
import { useAuth } from '../context/AuthContext';
import { CATEGORY_META, type Category } from '../types';
import CountdownTimer from '../components/CountdownTimer';

const CATEGORIES: Category[] = ['king', 'queen','style','smart'];
const DEADLINE = new Date('2026-08-17T23:59:59');

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

  // Modern Prestige Color Palette
  const bg = darkMode ? '#0A0F1D' : '#FAFAFA';
  const cardBg = darkMode ? 'rgba(22, 22, 36, 0.6)' : 'rgba(255, 255, 255, 0.7)';
  const textPrimary = darkMode ? '#F8F9FA' : '#111827';
  const textMuted = darkMode ? '#9CA3AF' : '#6B7280';
  const border = darkMode ? 'rgba(212,175,55,0.15)' : 'rgba(212,175,55,0.3)';

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
    await new Promise(r => setTimeout(r, 600)); // Simulating network latency
    if (!user) return;
    const result = castVote(confirmId, confirmCandidate.category, user);
    setSubmitting(false);
    setConfirmId(null);
    if (result === 'success') {
      setSuccessMsg(`Official Ballot Cast: ${confirmCandidate.name} ✓`);
      setTimeout(() => setSuccessMsg(null), 5000);
    } else if (result === 'already_voted') {
      setSuccessMsg('You have already verified a vote in this category.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } else if (result === 'closed') {
      setSuccessMsg('The voting session is currently closed.');
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const getQrUrl = (id: string) =>
    `${window.location.origin}${window.location.pathname}#/vote?candidate=${id}`;

  // Gate: Elevated Login Required State
  if (!isAuthenticated) {
    return (
      <div style={{ background: bg, minHeight: '100vh' }} className="pt-16 flex items-center justify-center px-4 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute inset-0 pointer-events-none opacity-30" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(212,175,55,0.15) 0%, transparent 60%)' }} />
        <div className="relative w-full max-w-md rounded-3xl p-10 text-center backdrop-blur-xl shadow-2xl border transition-all duration-500 hover:shadow-[0_0_40px_rgba(212,175,55,0.1)]" style={{ background: cardBg, border: `1px solid ${border}` }}>
          <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6" style={{ background: 'rgba(212,175,55,0.1)' }}>
             <ShieldCheck size={40} style={{ color: '#D4AF37' }} />
          </div>
          <h2 className="font-display font-bold text-2xl mb-3" style={{ color: textPrimary }}>Secure Voting Portal</h2>
          <p className="text-sm leading-relaxed mb-8" style={{ color: textMuted }}>
            Authentication is required. Please sign in with your official MTU student credentials to access your ballot.
          </p>
          <button
            onClick={() => navigate('/login', { state: { from: '/vote' } })}
            className="w-full py-4 rounded-full font-bold text-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-lg flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C84A)', color: '#0A0F1D' }}
          >
            Authenticate Identity →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: bg, color: textPrimary, minHeight: '100vh' }} className="pt-16 relative selection:bg-[#D4AF37] selection:text-[#0A0F1D]">
       {/* Background Mesh */}
       <div className="absolute top-0 left-0 right-0 h-[50vh] pointer-events-none opacity-40" style={{ background: darkMode ? 'radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.1) 0%, transparent 70%)' : 'radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.15) 0%, transparent 70%)' }} />

      {/* Header Section */}
      <div className="py-12 text-center relative z-10 px-4">
        <span className="font-mono text-xs tracking-[0.2em] uppercase mb-2 block" style={{ color: '#D4AF37' }}>
          Official Ballot
        </span>
        <h1 className="font-display text-4xl sm:text-5xl font-black mb-4 tracking-tight" style={{ color: textPrimary }}>
          Select Your Candidate
        </h1>
        
        <div className="inline-flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 px-6 py-3 rounded-full backdrop-blur-md border shadow-sm" style={{ background: cardBg, borderColor: border }}>
          <div className="flex items-center gap-2">
            <Clock size={16} className="animate-pulse" style={{ color: '#D4AF37' }} />
            <span className="text-sm font-medium" style={{ color: textMuted }}>Polls Close:</span>
            <CountdownTimer target={DEADLINE} compact darkMode={darkMode} />
          </div>
          <div className="hidden sm:block w-px h-4" style={{ background: border }}></div>
          <div className="text-xs font-mono">
            <span style={{ color: textMuted }}>Voter ID: </span>
            <span className="font-bold" style={{ color: '#D4AF37' }}>{user?.studentId}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 p-2 px-6 rounded-full bg-white/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm max-w-fit mx-auto my-6">
        {/* Countdown Timer */}
      <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
        <Clock size={14} className="text-amber-500" />
        <span>Polls Status:</span>
        <span className={`font-bold px-2.5 py-0.5 rounded-full text-[11px] ${
          election.status === 'open'
            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
            : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
        }`}>
          {election.status === 'open' ? 'Voting Open' : 'Voting Closed'}
        </span>
      </div>

  <div className="h-4 w-px bg-slate-300 dark:bg-slate-700" />
</div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        {/* Voted Categories Dashboard */}
        <div className="flex flex-wrap gap-3 mb-8 justify-center">
          {CATEGORIES.map(cat => {
            const m = CATEGORY_META[cat];
            const voted = votedCategories[cat];
            return (
              <div key={cat} className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm border backdrop-blur-sm transition-all" style={{ background: voted ? 'rgba(0,201,167,0.1)' : cardBg, borderColor: voted ? 'rgba(0,201,167,0.4)' : border, color: voted ? '#00C9A7' : textMuted }}>
                {voted ? <CheckCircle2 size={16} className="animate-pulse" /> : <span className="opacity-50">{m.icon}</span>}
                <span className="font-medium">{m.label}</span>
                {voted && <span className="text-[10px] uppercase tracking-wider ml-1 opacity-70">Sealed</span>}
              </div>
            );
          })}
        </div>

        {/* Sleek Segmented Category Tabs */}
        <div className="flex flex-wrap sm:flex-nowrap gap-2 p-1.5 rounded-2xl mb-10 backdrop-blur-xl shadow-sm" style={{ background: cardBg, border: `1px solid ${border}` }}>
          {CATEGORIES.map(cat => {
            const m = CATEGORY_META[cat];
            const isActive = activeCategory === cat;
            const voted = votedCategories[cat];
            return (
              <button key={cat} onClick={() => setActiveCategory(cat)} className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 relative overflow-hidden" style={{ background: isActive ? `${m.color}15` : 'transparent', color: isActive ? m.color : textMuted }}>
                {isActive && <div className="absolute inset-0 opacity-20" style={{ background: `linear-gradient(to top, ${m.color}, transparent)` }}></div>}
                <span className="text-lg relative z-10">{m.icon}</span>
                <span className="relative z-10">{m.label}</span>
                {voted && <Check size={14} className="relative z-10" style={{ color: '#00C9A7' }} />}
              </button>
            );
          })}
        </div>

        {/* Dynamic Category Header */}
        <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-3xl flex items-center gap-3" style={{ color: textPrimary }}>
              <span className="p-2 rounded-lg" style={{ background: `${meta.color}15`, color: meta.color }}>{meta.icon}</span>
              {meta.label}
            </h2>
            <p className="text-sm mt-2 ml-1" style={{ color: textMuted }}>{meta.description}</p>
          </div>
        </div>

        {/* Premium Voted Banner */}
        {hasVoted && (
          <div className="rounded-2xl p-5 mb-8 flex items-start sm:items-center gap-4 backdrop-blur-md shadow-lg transition-all animate-[slideIn_0.3s_ease-out]" style={{ background: 'linear-gradient(to right, rgba(0,201,167,0.1), rgba(0,201,167,0.05))', border: '1px solid rgba(0,201,167,0.3)' }}>
            <div className="p-2 rounded-full" style={{ background: 'rgba(0,201,167,0.2)' }}>
              <CheckCircle2 size={24} style={{ color: '#00C9A7' }} />
            </div>
            <div>
              <p className="font-display font-bold text-lg mb-1" style={{ color: '#00C9A7' }}>
                Ballot Secured for {meta.label}
              </p>
              <p className="text-sm" style={{ color: textMuted }}>
                This vote is encrypted and finalized. Awaiting official results publication.
              </p>
            </div>
          </div>
        )}

        {/* Cinematic Candidate Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-24">
          {activeCandidates.map(c => {
            const isHighlighted = c.id === highlightId;
            return (
              <div key={c.id} ref={isHighlighted ? highlightRef : null} className={`group relative rounded-3xl overflow-hidden transition-all duration-500 backdrop-blur-md flex flex-col ${isHighlighted ? 'scale-[1.02]' : 'hover:-translate-y-1'}`} style={{ background: cardBg, border: isHighlighted ? `2px solid ${meta.color}` : `1px solid ${border}`, boxShadow: isHighlighted ? `0 0 30px ${meta.color}30` : undefined }}>
                
                {/* Image Container with Grayscale Reveal */}
                <div className="relative aspect-square overflow-hidden bg-gray-900">
                  <img src={c.photo} alt={c.name} className="w-full h-full object-cover transition-all duration-700 grayscale-[0.5] opacity-90 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-105" />
                  
                  {/* Dark gradient overlay for text legibility */}
                  <div className="absolute inset-0 opacity-80" style={{ background: 'linear-gradient(to top, #0A0F1D 0%, transparent 60%)' }} />
                  
                  <button onClick={() => setQrId(c.id)} className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-xl transition-transform hover:scale-110" style={{ background: 'rgba(0,0,0,0.4)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.2)' }} title="Candidate QR Code">
                    <QrCode size={16} />
                  </button>

                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="font-display font-bold text-2xl text-white leading-tight mb-1">{c.name}</p>
                    <p className="font-mono text-xs font-semibold uppercase tracking-wider" style={{ color: meta.color }}>"{c.nickname}"</p>
                  </div>
                </div>

                {/* Candidate Info & Action */}
                <div className="p-5 flex flex-col flex-grow">
                  <div className="flex items-center gap-2 mb-3">
                     <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider" style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37' }}>{c.department}</span>
                  </div>
                  <p className="text-sm leading-relaxed mb-6 line-clamp-3 flex-grow" style={{ color: textMuted }}>{c.bio}</p>

                  <button
                    disabled={!votingOpen || hasVoted}
                    onClick={() => !hasVoted && votingOpen && setConfirmId(c.id)}
                    className="w-full py-3.5 rounded-xl text-sm font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={
                      hasVoted
                        ? { background: 'rgba(0,201,167,0.1)', color: '#00C9A7', border: '1px solid rgba(0,201,167,0.3)' }
                        : !votingOpen
                        ? { background: 'rgba(156,163,175,0.1)', color: textMuted, border: `1px solid ${border}` }
                        : { background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`, color: '#0A0F1D', boxShadow: `0 4px 15px ${meta.color}40` }
                    }
                  >
                    {hasVoted ? <><CheckCircle2 size={16} /> Ballot Cast</> : !votingOpen ? 'Polls Closed' : 'Select Candidate'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Success Toast */}
      {successMsg && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-4 rounded-full text-sm font-bold flex items-center gap-3 shadow-[0_10px_40px_rgba(0,201,167,0.2)] animate-[bounceIn_0.5s_ease-out]" style={{ background: 'rgba(10, 15, 29, 0.9)', color: '#00C9A7', border: '1px solid rgba(0,201,167,0.5)', backdropFilter: 'blur(16px)' }}>
          <div className="p-1 rounded-full bg-[#00C9A7]/20"><Check size={16} /></div> {successMsg}
        </div>
      )}

      {/* Modernized QR Modal */}
      {qrCandidate && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300" style={{ background: 'rgba(10,15,29,0.85)', backdropFilter: 'blur(12px)' }} onClick={() => setQrId(null)}>
          <div className="relative rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl transform transition-transform duration-300 scale-100" style={{ background: cardBg, border: `1px solid ${CATEGORY_META[qrCandidate.category].borderColor}` }} onClick={e => e.stopPropagation()}>
            <button className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/5 transition-colors" onClick={() => setQrId(null)} style={{ color: textMuted }}>
              <X size={20} />
            </button>
            <div className="relative w-20 h-20 mx-auto mb-4">
               <div className="absolute inset-0 rounded-full blur-md opacity-40" style={{ background: CATEGORY_META[qrCandidate.category].color }}></div>
               <img src={qrCandidate.photo} alt={qrCandidate.name} className="relative w-full h-full rounded-full object-cover border-2 shadow-lg" style={{ borderColor: CATEGORY_META[qrCandidate.category].color }} />
            </div>
            <p className="font-display font-bold text-xl mb-1" style={{ color: textPrimary }}>{qrCandidate.name}</p>
            <p className="text-xs font-mono uppercase tracking-widest mb-6" style={{ color: CATEGORY_META[qrCandidate.category].color }}>
              {CATEGORY_META[qrCandidate.category].label} Nominee
            </p>
            <div className="inline-block p-4 rounded-3xl bg-white shadow-inner mb-4">
              <QRCodeSVG value={getQrUrl(qrCandidate.id)} size={180} fgColor="#0A0F1D" bgColor="#FFFFFF" />
            </div>
            <p className="text-sm font-medium" style={{ color: textMuted }}>Scan to verify candidate profile</p>
          </div>
        </div>
      )}

      {/* Official Confirmation Modal */}
      {confirmCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(10,15,29,0.85)', backdropFilter: 'blur(12px)' }}>
          <div className="rounded-3xl p-8 max-w-md w-full text-center shadow-[0_0_50px_rgba(0,0,0,0.5)] border relative overflow-hidden" style={{ background: cardBg, borderColor: CATEGORY_META[confirmCandidate.category].borderColor }}>
            {/* Background glow in modal */}
            <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ background: CATEGORY_META[confirmCandidate.category].color }}></div>
            
            <Crown size={40} className="mx-auto mb-5 drop-shadow-md" style={{ color: CATEGORY_META[confirmCandidate.category].color }} />
            <h3 className="font-display font-black text-2xl mb-2" style={{ color: textPrimary }}>Confirm Your Ballot</h3>
            <p className="text-sm mb-4" style={{ color: textMuted }}>You are about to cast your official vote for:</p>
            
            <div className="py-4 px-6 rounded-2xl mb-6 backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${border}` }}>
               <p className="font-display font-bold text-2xl mb-1" style={{ color: CATEGORY_META[confirmCandidate.category].color }}>
                 {confirmCandidate.name}
               </p>
               <p className="text-sm font-medium" style={{ color: textMuted }}>
                 {confirmCandidate.department} · {confirmCandidate.year}
               </p>
            </div>

            <div className="flex items-center gap-3 text-left text-xs p-4 rounded-xl mb-8" style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.2)' }}>
              <AlertCircle size={24} className="flex-shrink-0" />
              <p><strong>Warning:</strong> This action is irreversible. Once confirmed, your ballot will be permanently recorded and encrypted.</p>
            </div>
            
            <div className="flex gap-4">
              <button onClick={() => setConfirmId(null)} disabled={submitting} className="flex-1 py-4 rounded-xl text-sm font-bold border transition-all hover:bg-white/5" style={{ borderColor: border, color: textMuted }}>
                Cancel
              </button>
              <button onClick={handleConfirm} disabled={submitting} className="flex-1 py-4 rounded-xl text-sm font-bold transition-all hover:scale-105 disabled:opacity-70 disabled:hover:scale-100 flex items-center justify-center gap-2 shadow-lg" style={{ background: `linear-gradient(135deg, ${CATEGORY_META[confirmCandidate.category].color}, ${CATEGORY_META[confirmCandidate.category].color}dd)`, color: '#0A0F1D' }}>
                {submitting ? <><Clock size={16} className="animate-spin" /> Sealing...</> : 'Confirm & Seal Ballot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}