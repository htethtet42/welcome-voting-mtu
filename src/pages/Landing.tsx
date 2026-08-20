import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Users, Trophy, ArrowRight, Clock } from 'lucide-react';
import { useElection } from '../context/ElectionContext';
import { useAuth } from '../context/AuthContext';
import { CATEGORY_META, type Category, type ElectionStatus } from '../types';

const CATEGORIES: Category[] = ['king', 'queen', 'style', 'smart', 'popular_man', 'popular_woman'];

const CATEGORY_PROFILE_IMAGES: Record<string, string> = {
  king: '/king.png',
  queen: '/queen.jpg',
  style: '/style.jpg',
  smart: '/smart.jpg',
  popular_man: '/popular(m).jpg',
  popular_woman: '/popular(w).jpg',
};

const STATUS_META: Record<ElectionStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
  scheduled: { label: 'Scheduled', color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.3)', dot: '#9CA3AF' },
  open:       { label: 'Voting Live', color: '#00C9A7', bg: 'rgba(0,201,167,0.15)', border: 'rgba(0,201,167,0.4)', dot: '#00C9A7' },
  closed:     { label: 'Voting Closed', color: '#FF7AAE', bg: 'rgba(255,122,174,0.1)', border: 'rgba(255,122,174,0.3)', dot: '#FF7AAE' },
  published:  { label: 'Results Published', color: '#D4AF37', bg: 'rgba(212,175,55,0.1)', border: 'rgba(212,175,55,0.3)', dot: '#D4AF37' },
};

const DEFAULT_META = {
  label: 'General Category',
  description: 'Vote for outstanding nominees.',
  icon: '👑',
  color: '#D4AF37',
  borderColor: 'rgba(212,175,55,0.3)',
  bg: 'rgba(212,175,55,0.1)'
};

const FALLBACK_DEADLINE = new Date('2026-09-02T23:59:59');

export default function Landing() {
  const { darkMode, election, candidates, voteRecords } = useElection();

  console.log("Current Election Type on Mobile:", election.type);
  
  // 1. Memoize or guard election state safely
const isMajorWelcome = election?.type === 'major';

// 2. Derive visible categories cleanly
const visibleCategories = CATEGORIES.filter((cat) => {
  if (isMajorWelcome) {
    return cat !== 'popular_man' && cat !== 'popular_woman';
  }
  return true;
});

// 3. Exact matching filter for Nominees & Stats
const visibleCategorySet = new Set<string>(visibleCategories);

const activeNomineesCount = candidates.filter(c => {
  if (!c.isActive) return false;
  return visibleCategorySet.has(c.category);
}).length;

  const { isAuthenticated } = useAuth();

  // Dynamic countdown timer state
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const targetTime = election.closesAt ? new Date(election.closesAt) : FALLBACK_DEADLINE;

    const updateTimer = () => {
      const now = new Date();
      const diff = targetTime.getTime() - now.getTime();

      if (diff <= 0 || election.status !== 'open') {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      setTimeLeft({ days, hours, minutes, seconds });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [election.closesAt, election.status]);

  const formatNum = (num: number) => String(num).padStart(2, '0');

  // Theme Aesthetics
  const bg = darkMode 
                      ? 'linear-gradient(135deg, rgb(15, 12, 41) 0%, rgb(26, 23, 61) 60%, rgb(36, 36, 62) 100%)' 
                      : 'linear-gradient(125deg, rgb(255, 239, 213) 0%, rgb(167, 153, 110) 60%, #ffe388';
  const cardBg = darkMode ? 'rgba(18, 23, 34, 0.75)' : 'rgba(255, 255, 255, 0.85)';
  const textPrimary = darkMode ? '#F8F9FA' : '#0D1117';
  const textMuted = darkMode ? '#9CA3AF' : '#57534E';
  const border = darkMode ? 'rgba(212,175,55,0.15)' : 'rgba(212,175,55,0.25)';
  const sm = STATUS_META[election.status] || STATUS_META.scheduled;

  return (
    <div style={{ background: bg, color: textPrimary, minHeight: '100vh' }} className="pt-16 selection:bg-[#D4AF37] selection:text-[#0A0F1D]">

      {/* Hero Section */}
      <section className="relative overflow-hidden flex flex-col items-center justify-center text-center px-4 py-24 sm:py-32 min-h-[90vh]">
        {/* Background Campus Image */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <img 
            src="/mtu.webp" 
            alt="MTU Campus"
            className="w-full h-full object-cover filter blur-[0.05px] scale-105 opacity-35"
          />
          <div className="absolute inset-0 bg-[#0B0E14]/50 mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0E14] via-transparent to-[#0B0E14]/20" />
        </div>
        
        {/* Subtle Grid */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.15] dark:opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(#D4AF37 1px, transparent 1px), linear-gradient(90deg, #D4AF37 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        {/* Floating Crown/Logo */}
        <div className="relative animate-[bounce_4s_infinite] mb-8 drop-shadow-2xl z-10">
          <div className="absolute inset-0 bg-[#D4AF37] blur-3xl opacity-20 rounded-full"></div>
          <img src="/MTU2.png" alt="MTU Logo" className="relative w-24 h-24 object-contain" style={{ mixBlendMode: darkMode ? 'screen' : 'multiply' }} />
        </div>

        {/* Status Pill */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-mono mb-8 border backdrop-blur-md shadow-sm z-10 transition-all hover:scale-105"
          style={{ background: sm.bg, borderColor: sm.border, color: sm.color }}>
          <span className={`w-2 h-2 rounded-full shadow-[0_0_8px_currentColor] ${election.status === 'open' ? 'animate-ping' : ''}`} style={{ background: sm.dot }} />
          {sm.label} · Session 2026
        </div>

        {/* Typography */}
        <h1 className="font-display font-black leading-[1.1] mb-6 z-10 tracking-tight" style={{ fontSize: 'clamp(3rem, 8vw, 6rem)' }}>
          <span className="text-shimmer">
            MTU Fresher Welcome
          </span>
          <br />
          <span className="text-slate-950 dark:text-[#F8F9FA]">Voting Awards 2026</span>
        </h1>

        <p className="max-w-2xl text-lg sm:text-xl mb-8 z-10 leading-relaxed font-semibold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          The search for excellence. Cast your ballot for the most outstanding students at MTU. <span className="font-medium">Every vote shapes the legacy.</span>
        </p>

        {/* Deadline Container */}
        <div className="flex flex-wrap items-center justify-center gap-3 px-6 py-2.5 rounded-full bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-md backdrop-blur-md max-w-fit mx-auto mb-10 z-10">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <Clock className="w-4 h-4 text-amber-500" />
            <span>Polls Close:</span>
            {election.status === 'open' ? (
              <span className="font-mono text-amber-500 font-bold">
                {formatNum(timeLeft.days)}d {formatNum(timeLeft.hours)}h {formatNum(timeLeft.minutes)}m {formatNum(timeLeft.seconds)}s
              </span>
            ) : (
              <span className="font-bold text-rose-500">Voting Closed</span>
            )}
          </div>

          <div className="h-3.5 w-px bg-slate-300 dark:bg-slate-700" />

          {/* Badge */}
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
            election.status === 'open'
              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
          }`}>
            {election.status === 'open' ? 'Voting Open' : 'Voting Closed'}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-16 z-10">
          <Link
            to="/vote"
            className="px-6 py-3.5 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-all shadow-md hover:shadow-amber-500/25 active:scale-95 flex items-center gap-2"
          >
            Enter Voting Booth →
          </Link>

          <Link
            to="/livestream"
            className="px-6 py-3.5 rounded-full bg-white/80 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 font-bold text-sm transition-all shadow-sm active:scale-95 flex items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            Watch Live
          </Link>
        </div>

        {/* Glassmorphic Stats */}
        <div className="flex flex-wrap justify-center gap-4 sm:gap-8 z-10 w-full max-w-4xl px-4">
          {[
            { label: 'Verified Votes', value: voteRecords.length.toLocaleString(), icon: <Trophy size={18} /> },
            { label: 'Active Nominees', value: String(activeNomineesCount), icon: <Users size={18} /> },
            { label: 'Prestigious Titles', value: String(visibleCategories.length), icon: <Crown size={18} /> },
          ].map((s) => (
            <div key={s.label} className="flex-1 min-w-[140px] flex flex-col items-center p-6 rounded-2xl backdrop-blur-lg border transition-transform hover:-translate-y-1" style={{ background: cardBg, borderColor: border }}>
              <span className="p-3 rounded-full mb-3" style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37' }}>{s.icon}</span>
              <span className="font-display font-bold text-3xl mb-1" style={{ color: textPrimary }}>{s.value}</span>
              <span className="text-xs font-mono uppercase tracking-wider" style={{ color: textMuted }}>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Categories Grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-24">
        <div className="text-center mb-16 flex flex-col items-center">
          <div className="h-px w-24 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent mb-6"></div>
          <span className="font-mono text-sm tracking-[0.2em] uppercase mb-3" style={{ color: '#D4AF37' }}>The Honors</span>
          <h2 className="font-display text-4xl sm:text-5xl font-bold" style={{ color: textPrimary }}>Select a Category</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {visibleCategories.map(cat => {
            const meta = CATEGORY_META[cat] || DEFAULT_META;
            const count = candidates.filter(c => {
              if (!c.isActive) return false;

              // Exact match
              if (c.category === cat) return true;
              
              // Cast c.category as string to check legacy data safely
              if ((c.category as string) === 'popular') {
                if (cat === 'popular_man') return c.id.includes('man') || (c as any).gender === 'male';
                if (cat === 'popular_woman') return c.id.includes('woman') || (c as any).gender === 'female';
              }

              return false;
            }).length;
            const profileImage = CATEGORY_PROFILE_IMAGES[cat];
            return (
              <Link
                key={cat}
                to={election.status === 'open' ? (isAuthenticated ? `/vote?category=${cat}` : '/login') : '/results'}
                className="group relative overflow-hidden rounded-3xl border p-8 transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 flex items-center gap-6"
                style={{ background: cardBg, borderColor: meta.borderColor }}
              >
                <div className="absolute -inset-4 opacity-0 group-hover:opacity-10 transition-opacity duration-500 blur-2xl" style={{ background: meta.color }}></div>
                
                {profileImage && (
                  <div className="relative shrink-0">
                    <div className="absolute inset-0 rounded-full blur-md opacity-50 transition-transform duration-500 group-hover:scale-110" style={{ background: meta.color }}></div>
                    <img src={profileImage} alt={meta.label} className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-4 transition-transform duration-500 group-hover:scale-105" style={{ borderColor: bg }} />
                  </div>
                )}
                
                <div className="flex-1 relative z-10">
                  <h3 className="font-display font-bold text-3xl mb-2 transition-colors" style={{ color: textPrimary }}>
                    {meta.label}
                  </h3>
                  <p className="text-sm leading-relaxed mb-4 line-clamp-2" style={{ color: textMuted }}>{meta.description}</p>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium" style={{ background: `${meta.color}15`, color: meta.color }}>
                      {count} Nominees
                    </span>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 group-hover:bg-[#D4AF37] group-hover:text-[#0A0F1D]" style={{ background: border, color: textPrimary }}>
                      <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Official Contenders Section */}
      <section className="py-24 border-t relative overflow-hidden" style={{ background: darkMode ? '#0E131F' : '#FFFFFF', borderColor: border }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-end mb-12">
            <div>
              <span className="font-mono text-sm tracking-[0.2em] uppercase mb-3 block" style={{ color: '#D4AF37' }}>The Faces of 2026</span>
              <h2 className="font-display text-3xl sm:text-4xl font-bold" style={{ color: textPrimary }}>Official Contenders</h2>
            </div>
            <Link to="/results" className="hidden sm:flex items-center gap-2 text-sm font-semibold hover:underline" style={{ color: '#D4AF37' }}>
              View All <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {candidates
              .filter(c => visibleCategories.includes(c.category as any))
              .slice(0, 10)
              .map(c => {
                const meta = CATEGORY_META[c.category] || DEFAULT_META;
                return (
                  <Link key={c.id} to={election.status === 'open' ? `/vote?category=${c.category}` : '/results'} className="group relative rounded-2xl overflow-hidden aspect-[3/4] bg-gray-900 shadow-lg">
                    <img src={c.photo} alt={c.name} className="w-full h-full object-cover transition-all duration-700 grayscale-[0.8] opacity-80 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-110" />
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0B0E14] via-[#0B0E14]/40 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-500" />
                    
                    <div className="absolute bottom-0 left-0 right-0 p-4 transform transition-transform duration-300 translate-y-2 group-hover:translate-y-0">
                      <span className="inline-block px-2 py-1 rounded backdrop-blur-md bg-white/10 border border-white/20 font-mono text-[10px] uppercase tracking-wider mb-2" style={{ color: meta.color }}>
                        {meta.label}
                      </span>
                      <p className="font-display font-bold text-lg text-white leading-tight">{c.name}</p>
                    </div>
                  </Link>
                );
              })}
          </div>
        </div>
      </section>

      {/* How to vote */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl sm:text-4xl font-bold" style={{ color: textPrimary }}>The Voting Process</h2>
        </div>
        
        <div className="relative grid sm:grid-cols-3 gap-12 max-w-4xl mx-auto">
          <div className="hidden sm:block absolute top-8 left-[15%] right-[15%] h-[2px] z-0" style={{ background: `linear-gradient(90deg, transparent, ${border}, transparent)` }}></div>

          {[
            { n: '01', t: 'Authenticate', d: 'Log securely using your official student credentials to verify eligibility.' },
            { n: '02', t: 'Select Nominee', d: 'Browse the categories and tap your chosen candidate to mark your ballot.' },
            { n: '03', t: 'Confirm Ballot', d: 'Review and finalize. Your vote is encrypted, recorded, and strictly anonymous.' },
          ].map((s) => (
            <div key={s.n} className="relative z-10 flex flex-col items-center text-center group">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6 transition-transform duration-500 group-hover:scale-110" style={{ background: cardBg, border: `1px solid ${border}`, color: '#D4AF37' }}>
                <span className="font-mono text-xl font-bold">{s.n}</span>
              </div>
              <h4 className="font-display text-xl font-bold mb-3" style={{ color: textPrimary }}>{s.t}</h4>
              <p className="text-sm leading-relaxed" style={{ color: textMuted }}>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-sm border-t" style={{ borderColor: border, color: textMuted, background: bg }}>
        <p className="font-mono">© 2026 MTU Electoral System. Designed for Excellence.</p>
      </footer>
    </div>
  );
}