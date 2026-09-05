import { useState, useEffect } from 'react';
import { Trophy, Lock } from 'lucide-react';
import { useElection } from '../context/ElectionContext';
import { CATEGORY_META, type Category } from '../types';

const CATEGORIES: Category[] = ['king', 'queen', 'style', 'smart','popular_man','popular_woman'];

export default function Results() {
  const {
    election, candidates, voteCounts, rawCounts, judgeCounts, judgeWeight,
    darkMode, winners,
  } = useElection();
  const [revealed, setRevealed] = useState<Partial<Record<Category, boolean>>>({});
  const [activeCategory, setActiveCategory] = useState<Category>('king');
  const [revealPhase, setRevealPhase] = useState<'idle' | 'drumroll' | 'reveal'>('idle');

  const bg = darkMode ? '#0D0D1A' : '#e7dbc5';
  const cardBg = darkMode ? '#161624' : '#FFFFFF';
  const textPrimary = darkMode ? '#F5F0E8' : '#1A1A2A';
  const textMuted = darkMode ? '#9CA3AF' : '#6B7280';
  const border = darkMode ? 'rgba(212,175,55,0.12)' : 'rgba(212,175,55,0.25)';

  const isPublished = election.status === 'published';

  const startReveal = () => {
    if (revealed[activeCategory]) return;
    setRevealPhase('drumroll');
    setTimeout(() => setRevealPhase('reveal'), 2500);
    setTimeout(() => {
      setRevealed(prev => ({ ...prev, [activeCategory]: true }));
      setRevealPhase('idle');
    }, 2500);
  };

   const isMajorWelcome = election?.type === 'major';
   const visibleCategories: Category[] = isMajorWelcome
    ? ['king', 'queen', 'style', 'smart']
    : CATEGORIES;

  useEffect(() => {
    if (!visibleCategories.includes(activeCategory)) {
      setActiveCategory('king');
    }
  }, [election?.type, activeCategory]);

  useEffect(() => {
    setRevealed({});
    setRevealPhase('idle');
  }, [election?.type]);

  if (!isPublished) {
    return (
      <div style={{ background: bg, minHeight: '100vh' }} className="pt-16 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div
            className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center border-2"
            style={{ background: 'rgba(212,175,55,0.1)', borderColor: 'rgba(212,175,55,0.2)' }}
          >
            <Lock size={32} style={{ color: textMuted }} />
          </div>
          <h1 className="font-display text-3xl font-bold mb-3" style={{ color: textPrimary }}>
            Results Not Yet Published
          </h1>
          <p className="text-base" style={{ color: textMuted }}>
            {election.status === 'open'
              ? 'Voting is still open. Results will be available after voting closes and the admin publishes them.'
              : election.status === 'closed'
              ? 'Voting has closed. The organizer is computing winners — check back soon.'
              : 'Results will be published by the event organizer.'}
          </p>
          <div
            className="mt-6 inline-block px-4 py-2 rounded-full font-mono text-xs"
            style={{ background: 'rgba(201, 212, 55, 0.1)', color: '#3d3c04', border: '1px solid rgba(41, 40, 35, 0.25)' }}
          >
            Status: {election.status.toUpperCase()}
          </div>
        </div>
      </div>
    );
  }

  const winner = winners[activeCategory];
  const meta = CATEGORY_META[activeCategory];
  const catCandidates = candidates
    .filter(c => c.category === activeCategory && c.isActive)
    // Real tallies only. This used to fall back to INITIAL_VOTES, a set of
    // hardcoded demo numbers, so a candidate with no votes displayed 142.
    .map(c => ({ ...c, votes: voteCounts[c.id] ?? 0 }))
    .sort((a, b) => b.votes - a.votes);
  const totalCatVotes = catCandidates.reduce((s, c) => s + c.votes, 0);
  const isRevealed = !!revealed[activeCategory];

  return (
    <div style={{ background: bg, minHeight: '100vh', color: textPrimary }} className="pt-16">
      {/* Header */}
      <div
        className="py-10 text-center"
        style={{
          background: darkMode
            ? 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(26,26,62,0.7) 0%, transparent 70%)'
            : 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(212,175,55,0.07) 0%, transparent 70%)',
        }}
      >
        <Trophy size={36} className="mx-auto mb-3" style={{ color: '#D4AF37' }} />
        <h1 className="font-display text-4xl sm:text-5xl font-bold mb-2">
          <span className="text-shimmer">Winners</span>
        </h1>
        <p className="font-display italic text-lg" style={{ color: textMuted }}>
          MTU King &amp; Queen 2026
        </p>
        {election.publishedAt && (
          <p className="text-xs mt-2 font-mono" style={{ color: textMuted }}>
            Published {new Date(election.publishedAt).toLocaleString()}
          </p>
        )}
      </div>

      {/* Category Tabs */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 mb-8">
        <div
          className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-1 p-1 rounded-2xl w-full overflow-hidden"
          style={{ background: darkMode ? '#161624' : '#FFFFFF', border: `1px solid ${border}` }}
        >
          {visibleCategories.map(cat => {
            const m = CATEGORY_META[cat];
            const active = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="w-full flex items-center justify-center gap-1 sm:gap-2 py-3 rounded-xl text-xs sm:text-sm font-medium transition-all min-w-0"
                style={{
                  background: active ? m.bgColor : 'transparent',
                  color: active ? m.color : textMuted,
                  border: active ? `1px solid ${m.borderColor}` : '1px solid transparent',
                }}
              >
                <span className="text-lg">{m.icon}</span>
                {m.label}
                {revealed[cat] && <span style={{ color: '#D4AF37' }}>✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Reveal Area */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-20">
        {!isRevealed && revealPhase === 'idle' && (
          <div className="text-center py-16">
            <div
              className="w-32 h-32 rounded-full mx-auto mb-6 flex items-center justify-center border-4 animate-pulse-gold"
              style={{
                background: meta.bgColor,
                borderColor: meta.color,
              }}
            >
              <span className="text-5xl">{meta.icon}</span>
            </div>
            <h2 className="font-display text-2xl font-bold mb-3" style={{ color: textPrimary }}>
              Ready to reveal the {meta.label}?
            </h2>
            <p className="text-sm mb-8" style={{ color: textMuted }}>
              Tap below for the dramatic announcement
            </p>
            <button
              onClick={startReveal}
              className="px-8 py-4 rounded-full font-bold text-base transition-all hover:scale-110 hover:-translate-y-1"
              style={{
                background: `linear-gradient(135deg, ${meta.color}, ${meta.color}aa)`,
                color: '#0D0D1A',
              }}
            >
              🥁 Reveal {meta.label}!
            </button>
          </div>
        )}

        {revealPhase === 'drumroll' && (
          <div className="text-center py-16">
            <div className="text-5xl animate-bounce mb-6">🥁</div>
            <p className="font-display text-2xl font-bold animate-pulse" style={{ color: '#D4AF37' }}>
              And the {meta.label} is...
            </p>
            <div className="flex justify-center gap-1 mt-6">
              {[0, 1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full animate-bounce"
                  style={{ background: meta.color, animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          </div>
        )}

        {isRevealed && !winner && (
          <div
            className="rounded-3xl border p-12 text-center mb-8"
            style={{ borderColor: border, background: cardBg }}
          >
            <p className="text-4xl mb-4">{meta.icon}</p>
            <p className="font-display font-bold text-xl mb-2" style={{ color: textPrimary }}>
              No votes yet for {meta.label}
            </p>
            <p className="text-sm" style={{ color: textMuted }}>
              A winner appears here once ballots have been cast in this category.
            </p>
          </div>
        )}

        {isRevealed && winner && (
          <>
            {/* Winner card */}
            <div
              className="rounded-3xl overflow-hidden border mb-8"
              style={{
                borderColor: meta.color,
                boxShadow: `0 0 60px ${meta.bgColor}, 0 0 120px ${meta.bgColor}`,
              }}
            >
              <div className="relative">
                {/* Photo */}
                <div className="relative h-72 sm:h-96 overflow-hidden bg-night-900">
                  <img
                    src={winner.photo}
                    alt={winner.name}
                    className="w-full h-full object-cover"
                    style={{ filter: 'brightness(0.85)' }}
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(to top, ${darkMode ? '#0D0D1A' : '#F8F5EF'} 0%, rgba(0,0,0,0.2) 40%, transparent 70%)`,
                    }}
                  />
                  {/* Confetti effect via CSS */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {[...Array(12)].map((_, i) => (
                      <div
                        key={i}
                        className="absolute w-2 h-2 rounded-full animate-float"
                        style={{
                          background: i % 3 === 0 ? '#D4AF37' : i % 3 === 1 ? meta.color : '#FFFFFF',
                          left: `${8 + i * 8}%`,
                          top: `${10 + (i % 4) * 15}%`,
                          opacity: 0.7,
                          animationDelay: `${i * 0.3}s`,
                          animationDuration: `${2 + (i % 3)}s`,
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Info overlay */}
                <div className="relative px-6 py-5 text-center">
                  <div className="text-5xl mb-2">{meta.icon}</div>
                  <p className="font-mono text-sm tracking-widest uppercase mb-1" style={{ color: meta.color }}>
                    Your {meta.label} 2026
                  </p>
                  <h2 className="font-display font-bold text-4xl sm:text-5xl mb-2" style={{ color: textPrimary }}>
                    {winner.name}
                  </h2>
                  <p className="text-base mb-1" style={{ color: textMuted }}>
                    "{winner.nickname}" · {winner.department} · {winner.year}
                  </p>
                  <div
                    className="inline-block mt-3 px-4 py-1.5 rounded-full font-mono text-sm font-bold"
                    style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}
                  >
                    {(voteCounts[winner.id] ?? 0).toLocaleString()} votes
                  </div>
                </div>
              </div>
            </div>

            {/* Full standings */}
            <div className="flex items-baseline justify-between gap-4 flex-wrap mb-4">
              <h3 className="font-display font-bold text-xl" style={{ color: textPrimary }}>
                Full Standings — {meta.label}
              </h3>
              {/* The legend appears only once judge ballots exist in this
                  category, so an election run without judges looks exactly as
                  it always did. */}
              {catCandidates.some(c => (judgeCounts[c.id] ?? 0) > 0) && (
                <div className="flex gap-4 flex-wrap text-xs" style={{ color: textMuted }}>
                  <span className="flex items-center gap-1.5">
                    <i className="inline-block w-4 h-1.5 rounded-sm" style={{ background: meta.color }} />
                    Student ballots
                  </span>
                  <span className="flex items-center gap-1.5">
                    <i className="inline-block w-4 h-1.5 rounded-sm" style={{ background: '#3B82F6' }} />
                    Judge weight
                  </span>
                </div>
              )}
            </div>
            <div className="space-y-3">
              {catCandidates.map((c, i) => {
                // c.votes is the WEIGHTED score, which is what ranks candidates.
                const weighted = c.votes;
                const students = rawCounts[c.id] ?? 0;    // ballots cast at 1×
                const jBallots = judgeCounts[c.id] ?? 0;  // ballots above 1×
                const jWeight = judgeWeight[c.id] ?? 0;   // weight those added

                const pct = totalCatVotes > 0 ? (weighted / totalCatVotes) * 100 : 0;
                // Split the same bar in proportion to what each side contributed.
                // students + jWeight === weighted, so the two segments sum to pct.
                const studentPct = weighted > 0 ? pct * (students / weighted) : 0;
                const judgePct = weighted > 0 ? pct * (jWeight / weighted) : 0;

                const isWinner = i === 0;
                return (
                  <div
                    key={c.id}
                    className="rounded-2xl p-4 border flex items-center gap-4"
                    style={{
                      background: isWinner ? meta.bgColor : cardBg,
                      borderColor: isWinner ? meta.borderColor : border,
                    }}
                  >
                    <span className="text-xl w-6 text-center shrink-0">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                    </span>
                    <img src={c.photo} alt={c.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm" style={{ color: textPrimary }}>{c.name}</p>

                      {/* Two-tone track: the category colour for student
                          ballots, royal for judge weight.

                          This is what makes an upset survive being announced.
                          A candidate who won on judges shows a visible blue
                          tail while the runner-up's bar is solid category
                          colour, so the arithmetic reads from the back of the
                          hall with no number read at all. */}
                      <div
                        className="mt-1.5 h-2 rounded-full overflow-hidden flex"
                        style={{ background: darkMode ? '#252538' : '#F0EDE8' }}
                      >
                        <div
                          className="h-full transition-all duration-700"
                          style={{ width: `${studentPct}%`, background: isWinner ? meta.color : `${meta.color}66` }}
                        />
                        {judgePct > 0 && (
                          <div
                            className="h-full transition-all duration-700"
                            style={{ width: `${judgePct}%`, background: isWinner ? '#3B82F6' : 'rgba(59,130,246,0.55)' }}
                          />
                        )}
                      </div>

                      {/* Never behind a hover or a toggle: a projector has no
                          cursor, and a disclosure a student has to find is one
                          they will say was hidden. */}
                      <p className="font-mono text-[10px] mt-1.5 flex gap-1.5 flex-wrap items-center" style={{ color: textMuted }}>
                        <span>{students.toLocaleString()} student{students === 1 ? '' : 's'}</span>
                        {jBallots > 0 && (
                          <>
                            <span style={{ opacity: 0.4 }}>·</span>
                            <span style={{ color: darkMode ? '#60A5FA' : '#2563C4' }}>
                              ⚖ {jBallots} judge{jBallots === 1 ? '' : 's'} &nbsp;+{jWeight}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono font-bold tabular-nums" style={{ color: isWinner ? meta.color : textPrimary }}>
                        {weighted.toLocaleString()}
                      </p>
                      <p className="font-mono text-xs tabular-nums" style={{ color: textMuted }}>{pct.toFixed(1)}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
