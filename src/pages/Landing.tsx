import { Link } from 'react-router-dom';
import { Crown,Users, Trophy, ChevronRight, Radio } from 'lucide-react';
import { useElection } from '../context/ElectionContext';
import { useAuth } from '../context/AuthContext';
import CountdownTimer from '../components/CountdownTimer';
import { CANDIDATES } from '../data';
import { CATEGORY_META, type Category, type ElectionStatus } from '../types';

const CATEGORIES: Category[] = ['king', 'queen','style','smart'];

const CATEGORY_PROFILE_IMAGES: Record<Category, string> = {
  king: '/king.png',
  queen: '/queen.jpg',
  style: '/style.jpg',
  smart: '/smart.jpg',
};

const STATUS_META: Record<ElectionStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
  scheduled: { label: 'Scheduled', color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.3)', dot: '#9CA3AF' },
  open:       { label: 'Voting Open', color: '#00C9A7', bg: 'rgba(0,201,167,0.1)', border: 'rgba(0,201,167,0.3)', dot: '#00C9A7' },
  closed:     { label: 'Voting Closed', color: '#FF7AAE', bg: 'rgba(255,122,174,0.1)', border: 'rgba(255,122,174,0.3)', dot: '#FF7AAE' },
  published:  { label: 'Results Published', color: '#D4AF37', bg: 'rgba(212,175,55,0.1)', border: 'rgba(212,175,55,0.3)', dot: '#D4AF37' },
};

const DEADLINE = new Date('2026-07-27T23:59:59');

export default function Landing() {
  const { darkMode, totalVotes, election, candidates } = useElection();
  const { isAuthenticated } = useAuth();

  const bg = darkMode ? '#0D0D1A' : '#F8F5EF';
  const cardBg = darkMode ? '#161624' : '#FFFFFF';
  const textPrimary = darkMode ? '#F5F0E8' : '#1A1A2A';
  const textMuted = darkMode ? '#9CA3AF' : '#6B7280';
  const border = darkMode ? 'rgba(212,175,55,0.12)' : 'rgba(212,175,55,0.25)';
  const sm = STATUS_META[election.status];

  return (
    <div style={{ background: bg, color: textPrimary, minHeight: '100vh' }} className="pt-16">

      {/* Hero */}
      <section
        className="relative overflow-hidden flex flex-col items-center justify-center text-center px-4 py-24 sm:py-32"
        style={{
          background: darkMode
            ? 'radial-gradient(ellipse 90% 60% at 50% 0%, rgba(26,26,62,0.9) 0%, #0D0D1A 70%)'
            : 'radial-gradient(ellipse 90% 60% at 50% 0%, rgba(212,175,55,0.07) 0%, #F8F5EF 70%)',
        }}
      >
        {/* Dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at center, rgba(212,175,55,${darkMode ? '0.05' : '0.08'}) 1px, transparent 1px)`,
            backgroundSize: '36px 36px',
          }}
        />

        {/* Crown */}
        <div className="animate-float mb-5">
          <img
            src="/MTU2.png"
            alt="MTU Logo"
            style={{width: 80,height: 80,objectFit: 'contain',mixBlendMode: darkMode ? 'screen' : 'multiply' }}
          />
</div>

        {/* Election status pill */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono mb-5 border"
          style={{ background: sm.bg, borderColor: sm.border, color: sm.color }}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${election.status === 'open' ? 'animate-pulse' : ''}`} style={{ background: sm.dot }} />
          {sm.label} · MTU Voting
        </div>

        <h1 className="font-display font-bold leading-tight mb-4" style={{ fontSize: 'clamp(2.4rem, 7vw, 5rem)' }}>
          <span className="text-shimmer">MTU Fresher Welcome</span>
          <br />
          <span style={{ color: textPrimary }}>Voting System 2026</span>
        </h1>

        <p className="max-w-lg text-lg mb-10" style={{ color: textMuted }}>
          Cast your ballot for the most outstanding students at MTU. One vote per category — every vote counts.
        </p>

        {election.status !== 'published' && (
          <div className="mb-10">
            <p className="text-xs font-mono mb-3" style={{ color: textMuted }}>
              {election.status === 'open' ? 'Voting closes in' : election.status === 'scheduled' ? 'Voting opens' : 'Voting closed'}
            </p>
            <CountdownTimer target={DEADLINE} darkMode={darkMode} />
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-wrap justify-center gap-3">
          {election.status === 'open' && (
            <Link
              to={isAuthenticated ? '/vote' : '/login'}
              className="px-7 py-3.5 rounded-full font-bold text-sm transition-all hover:scale-105 animate-pulse-gold"
              style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C84A)', color: '#0D0D1A' }}
            >
              {isAuthenticated ? 'Vote Now →' : 'Sign In to Vote →'}
            </Link>
          )}
          {election.status === 'published' && (
            <Link
              to="/results"
              className="px-7 py-3.5 rounded-full font-bold text-sm transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C84A)', color: '#0D0D1A' }}
            >
              🏆 See Winners →
            </Link>
          )}
          <Link
            to="/livestream"
            className="flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-sm border transition-all hover:scale-105"
            style={{ borderColor: 'rgba(212,175,55,0.35)', color: '#D4AF37', background: 'rgba(212,175,55,0.06)' }}
          >
            <Radio size={14} style={{ color: '#FF7AAE' }} /> Livestream
          </Link>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap justify-center gap-8 mt-14">
          {[
            { label: 'Votes Cast', value: totalVotes.toLocaleString(), icon: <Trophy size={15} /> },
            { label: 'Candidates', value: String(candidates.filter(c => c.isActive).length), icon: <Users size={15} /> },
            { label: 'Categories', value: '4', icon: <Crown size={15} /> },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2">
              <span style={{ color: '#D4AF37' }}>{s.icon}</span>
              <span className="font-mono font-bold text-xl" style={{ color: '#D4AF37' }}>{s.value}</span>
              <span className="text-sm" style={{ color: textMuted }}>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-10">
          <span className="font-mono text-xs tracking-widest uppercase" style={{ color: '#D4AF37' }}>
            Award Categories
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mt-2" style={{ color: textPrimary }}>
            Four Prestigious Titles
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {CATEGORIES.map(cat => {
            const meta = CATEGORY_META[cat];
            const count = candidates.filter(c => c.category === cat && c.isActive).length;
            const profileImage = CATEGORY_PROFILE_IMAGES[cat];
            return (
              <Link
                key={cat}
                to={election.status === 'open' ? (isAuthenticated ? `/vote?category=${cat}` : '/login') : '/results'}
                className="group relative overflow-hidden rounded-2xl border p-7 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1"
                style={{
                  background: darkMode
                    ? `linear-gradient(135deg, ${meta.bgColor}, ${cardBg})`
                    : `linear-gradient(135deg, ${meta.bgColor}, #FFFFFF)`,
                  borderColor: meta.borderColor,
                }}
              >
                {profileImage && (
                  <img
                    src={profileImage}
                    alt={`${meta.label} profile`}
                    className="w-20 h-20 rounded-full object-cover mb-4 border-2 shadow-lg"
                    style={{ borderColor: meta.color, objectPosition: 'center 30%' }}
                  />
                )}
                <h3 className="font-display font-bold text-2xl mb-2" style={{ color: meta.color }}>
                  {meta.label}
                </h3>
                <p className="text-sm mb-5" style={{ color: textMuted }}>{meta.description}</p>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs" style={{ color: textMuted }}>
                    {count} active candidates
                  </span>
                  <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" style={{ color: meta.color }} />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Candidates preview */}
      <section
        className="py-16 border-t"
        style={{ background: darkMode ? '#161624' : '#FFFFFF', borderColor: border }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <span className="font-mono text-xs tracking-widest uppercase" style={{ color: '#D4AF37' }}>
              Meet the Candidates
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold mt-2" style={{ color: textPrimary }}>
              Contenders of 2026
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {CANDIDATES.map(c => {
              const meta = CATEGORY_META[c.category];
              return (
                <Link
                  key={c.id}
                  to={election.status === 'open' ? '/vote' : '/results'}
                  className="group relative rounded-2xl overflow-hidden aspect-[3/4]"
                  style={{ border: `1px solid ${meta.borderColor}` }}
                >
                  <img src={c.photo} alt={c.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  <div
                    className="absolute inset-0"
                    style={{ background: 'linear-gradient(to top, rgba(13,13,26,0.92) 0%, transparent 55%)' }}
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-2.5">
                    <p className="font-display font-semibold text-xs text-white leading-tight">{c.name}</p>
                    <p className="font-mono text-xs" style={{ color: meta.color }}>{meta.icon} {meta.label}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* How to vote */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-10">
          <span className="font-mono text-xs tracking-widest uppercase" style={{ color: '#D4AF37' }}>
            How It Works
          </span>
          <h2 className="font-display text-3xl font-bold mt-2" style={{ color: textPrimary }}>
            3 Taps to Vote
          </h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-6 max-w-2xl mx-auto">
          {[
            { n: '01', t: 'Sign In', d: 'Log in with your student email and ID to verify eligibility.' },
            { n: '02', t: 'Pick Candidate', d: 'Browse King and Queen nominees — tap the one you\'re voting for.' },
            { n: '03', t: 'Confirm', d: 'One tap to confirm. Your ballot is recorded instantly and cannot be changed.' },
          ].map(s => (
            <div key={s.n} className="flex flex-col gap-2">
              <span className="font-mono text-4xl font-bold" style={{ color: 'rgba(212,175,55,0.2)' }}>{s.n}</span>
              <h4 className="font-semibold" style={{ color: textPrimary }}>{s.t}</h4>
              <p className="text-sm" style={{ color: textMuted }}>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 text-center text-sm border-t" style={{ borderColor: border, color: textMuted }}>
        <p>© 2026 MTU King &amp; Queen Voting System · Built for MTU Software Competition</p>
      </footer>
    </div>
  );
}
