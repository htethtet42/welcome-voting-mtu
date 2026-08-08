import { Link } from 'react-router-dom';
import { Crown, Users, Trophy, ChevronRight, Radio, ArrowRight } from 'lucide-react';
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
  open:       { label: 'Voting Live', color: '#00C9A7', bg: 'rgba(0,201,167,0.15)', border: 'rgba(0,201,167,0.4)', dot: '#00C9A7' },
  closed:     { label: 'Voting Closed', color: '#FF7AAE', bg: 'rgba(255,122,174,0.1)', border: 'rgba(255,122,174,0.3)', dot: '#FF7AAE' },
  published:  { label: 'Results Published', color: '#D4AF37', bg: 'rgba(212,175,55,0.1)', border: 'rgba(212,175,55,0.3)', dot: '#D4AF37' },
};

const DEADLINE = new Date('2026-07-27T23:59:59');

export default function Landing() {
  const { darkMode, totalVotes, election, candidates } = useElection();
  const { isAuthenticated } = useAuth();

  // Refined Color Palette for "Modern Prestige"
  const bg = darkMode ? '#0A0F1D' : '#FAFAFA';
  const cardBg = darkMode ? 'rgba(22, 22, 36, 0.6)' : 'rgba(255, 255, 255, 0.7)';
  const textPrimary = darkMode ? '#F8F9FA' : '#111827';
  const textMuted = darkMode ? '#9CA3AF' : '#6B7280';
  const border = darkMode ? 'rgba(212,175,55,0.15)' : 'rgba(212,175,55,0.3)';
  const sm = STATUS_META[election.status];

  return (
    <div style={{ background: bg, color: textPrimary, minHeight: '100vh' }} className="pt-16 selection:bg-[#D4AF37] selection:text-[#0A0F1D]">

      {/* Hero Section - Enhanced with Glassmorphism and Depth */}
      <section className="relative overflow-hidden flex flex-col items-center justify-center text-center px-4 py-24 sm:py-32 min-h-[90vh]">
        {/* Animated Background Mesh Gradient */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-40 transition-opacity duration-1000"
          style={{
            background: darkMode 
              ? 'radial-gradient(circle at 50% 0%, rgba(212,175,55,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(0,201,167,0.05) 0%, transparent 50%)' 
              : 'radial-gradient(circle at 50% 0%, rgba(212,175,55,0.2) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(0,201,167,0.08) 0%, transparent 50%)'
          }}
        />
        
        {/* Subtle Grid */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(#D4AF37 1px, transparent 1px), linear-gradient(90deg, #D4AF37 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        {/* Floating Crown/Logo */}
        <div className="relative animate-[bounce_4s_infinite] mb-8 drop-shadow-2xl z-10">
          <div className="absolute inset-0 bg-[#D4AF37] blur-3xl opacity-20 rounded-full"></div>
          <img src="/MTU2.png" alt="MTU Logo" className="relative w-24 h-24 object-contain" style={{ mixBlendMode: darkMode ? 'screen' : 'multiply' }} />
        </div>

        {/* Consolidated Status Pill */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-mono mb-8 border backdrop-blur-md shadow-sm z-10 transition-all hover:scale-105"
          style={{ background: sm.bg, borderColor: sm.border, color: sm.color }}>
          <span className={`w-2 h-2 rounded-full shadow-[0_0_8px_currentColor] ${election.status === 'open' ? 'animate-ping' : ''}`} style={{ background: sm.dot }} />
          {sm.label} · Session 2026
        </div>

        {/* High-Impact Typography */}
        <h1 className="font-display font-black leading-[1.1] mb-6 z-10 tracking-tight" style={{ fontSize: 'clamp(3rem, 8vw, 6rem)' }}>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#D4AF37] via-[#F4D068] to-[#D4AF37] animate-gradient-x">
            MTU Fresher Welcome
          </span>
          <br />
          <span style={{ color: textPrimary }}>Voting Awards 2026</span>
        </h1>

        <p className="max-w-2xl text-lg sm:text-xl mb-12 z-10 leading-relaxed font-light" style={{ color: textMuted }}>
          The search for excellence. Cast your ballot for the most outstanding students at MTU. <span className="font-medium text-[#D4AF37]">Every vote shapes the legacy.</span>
        </p>

        {election.status !== 'published' && (
          <div className="mb-12 z-10 p-6 rounded-3xl backdrop-blur-xl border shadow-2xl" style={{ background: cardBg, borderColor: border }}>
            <p className="text-xs font-mono tracking-widest uppercase mb-4" style={{ color: textMuted }}>
              {election.status === 'open' ? 'Polls Close In' : election.status === 'scheduled' ? 'Polls Open In' : 'Voting Concluded'}
            </p>
            <CountdownTimer target={DEADLINE} darkMode={darkMode} />
          </div>
        )}

        {/* Primary CTAs */}
        <div className="flex flex-wrap justify-center gap-4 z-10">
          {election.status === 'open' && (
            <Link to={isAuthenticated ? '/vote' : '/login'} className="group flex items-center gap-2 px-8 py-4 rounded-full font-bold text-sm transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(212,175,55,0.4)]" style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C84A)', color: '#0A0F1D' }}>
              {isAuthenticated ? 'Enter Voting Booth' : 'Authenticate to Vote'} 
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </Link>
          )}
          {election.status === 'published' && (
            <Link to="/results" className="group flex items-center gap-2 px-8 py-4 rounded-full font-bold text-sm transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(212,175,55,0.4)]" style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C84A)', color: '#0A0F1D' }}>
              <Trophy size={16} /> View Official Results
            </Link>
          )}
          <Link to="/livestream" className="group flex items-center gap-2 px-8 py-4 rounded-full font-semibold text-sm border backdrop-blur-md transition-all duration-300 hover:scale-105" style={{ borderColor: border, color: textPrimary, background: cardBg }}>
            <Radio size={16} className="text-[#FF7AAE] animate-pulse" /> Watch Live
          </Link>
        </div>

        {/* Glassmorphic Stats Row */}
        <div className="flex flex-wrap justify-center gap-4 sm:gap-8 mt-20 z-10 w-full max-w-4xl px-4">
          {[
            { label: 'Verified Votes', value: totalVotes.toLocaleString(), icon: <Trophy size={18} /> },
            { label: 'Active Nominees', value: String(candidates.filter(c => c.isActive).length), icon: <Users size={18} /> },
            { label: 'Prestigious Titles', value: '4', icon: <Crown size={18} /> },
          ].map((s) => (
            <div key={s.label} className="flex-1 min-w-[140px] flex flex-col items-center p-6 rounded-2xl backdrop-blur-lg border transition-transform hover:-translate-y-1" style={{ background: cardBg, borderColor: border }}>
              <span className="p-3 rounded-full mb-3" style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37' }}>{s.icon}</span>
              <span className="font-display font-bold text-3xl mb-1" style={{ color: textPrimary }}>{s.value}</span>
              <span className="text-xs font-mono uppercase tracking-wider" style={{ color: textMuted }}>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Categories - Enhanced Hover States */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-24">
        <div className="text-center mb-16 flex flex-col items-center">
          <div className="h-px w-24 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent mb-6"></div>
          <span className="font-mono text-sm tracking-[0.2em] uppercase mb-3" style={{ color: '#D4AF37' }}>The Honors</span>
          <h2 className="font-display text-4xl sm:text-5xl font-bold" style={{ color: textPrimary }}>Select a Category</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {CATEGORIES.map(cat => {
            const meta = CATEGORY_META[cat];
            const count = candidates.filter(c => c.category === cat && c.isActive).length;
            const profileImage = CATEGORY_PROFILE_IMAGES[cat];
            return (
              <Link
                key={cat}
                to={election.status === 'open' ? (isAuthenticated ? `/vote?category=${cat}` : '/login') : '/results'}
                className="group relative overflow-hidden rounded-3xl border p-8 transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 flex items-center gap-6"
                style={{ background: cardBg, borderColor: meta.borderColor }}
              >
                {/* Subtle background glow based on category color */}
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

      {/* Candidates - Cinematic Grayscale to Color Reveal */}
      <section className="py-24 border-t relative overflow-hidden" style={{ background: darkMode ? '#11111E' : '#FFFFFF', borderColor: border }}>
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
            {CANDIDATES.slice(0, 10).map(c => {
              const meta = CATEGORY_META[c.category];
              return (
                <Link key={c.id} to={election.status === 'open' ? `/vote?category=${c.category}` : '/results'} className="group relative rounded-2xl overflow-hidden aspect-[3/4] bg-gray-900 shadow-lg">
                  {/* Grayscale by default, color on hover */}
                  <img src={c.photo} alt={c.name} className="w-full h-full object-cover transition-all duration-700 grayscale-[0.8] opacity-80 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-110" />
                  
                  {/* Sleek lower-third gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0A0F1D] via-[#0A0F1D]/40 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-500" />
                  
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

      {/* How to vote - Connected Steps */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl sm:text-4xl font-bold" style={{ color: textPrimary }}>The Voting Process</h2>
        </div>
        
        <div className="relative grid sm:grid-cols-3 gap-12 max-w-4xl mx-auto">
          {/* Connector Line (Desktop Only) */}
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