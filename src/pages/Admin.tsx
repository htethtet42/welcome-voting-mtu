import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Shield, Trophy, Users, BarChart3, FileText,
  Download, RefreshCw, Plus, Pencil, CheckCircle2,
  XCircle, AlertTriangle, X, Check,
} from 'lucide-react';
import { useElection } from '../context/ElectionContext';
import { useAuth } from '../context/AuthContext';
import { CATEGORY_META, type Category, type Candidate } from '../types';

const TABS = ['Overview', 'Candidates', 'Ballots', 'Analytics', 'Audit', 'Controls'] as const;
type Tab = typeof TABS[number];

const CAT_COLORS: Record<Category, string> = { king: '#60A5FA', queen: '#FF7AAE' ,style:'#18ad6f11',smart:'#82970a11'};

interface CandidateForm {
  name: string; nickname: string; department: string; year: string;
  category: Category; bio: string; talent: string; photo: string; isActive: boolean;
}

const BLANK_FORM: CandidateForm = {
  name: '', nickname: '', department: '', year: 'Level 300',
  category: 'king', bio: '', talent: '', photo: '', isActive: true,
};

export default function Admin() {
  const {
    election, candidates, voteCounts, voteRecords, auditLog,
    darkMode, totalVotes, winners,
    openElection, closeElection, publishResults,
    addCandidate, updateCandidate, toggleCandidateActive,
    resetVotes,
  } = useElection();
  const { user, isAuthenticated, isAdmin, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [confirmAction, setConfirmAction] = useState<null | { label: string; action: () => void }>(null);
  const [candidateModal, setCandidateModal] = useState<null | { mode: 'add' | 'edit'; id?: string }>(null);
  const [form, setForm] = useState<CandidateForm>(BLANK_FORM);

  const bg = darkMode ? '#0D0D1A' : '#F8F5EF';
  const cardBg = darkMode ? '#161624' : '#FFFFFF';
  const textPrimary = darkMode ? '#F5F0E8' : '#1A1A2A';
  const textMuted = darkMode ? '#9CA3AF' : '#6B7280';
  const border = darkMode ? 'rgba(212,175,55,0.12)' : 'rgba(212,175,55,0.25)';
  const inputBg = darkMode ? '#0D0D1A' : '#F0EDE8';

  const actorName = user?.name ?? 'Admin';

  // Guard
  if (!isAuthenticated || !isAdmin) {
    return (
      <div style={{ background: bg, minHeight: '100vh' }} className="pt-16 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <Shield size={40} className="mx-auto mb-4" style={{ color: textMuted }} />
          <h2 className="font-display font-bold text-xl mb-2" style={{ color: textPrimary }}>Admin Access Required</h2>
          <p className="text-sm mb-6" style={{ color: textMuted }}>Sign in as admin to access this dashboard.</p>
          <a href="#/login" className="inline-block px-5 py-3 rounded-xl font-semibold text-sm" style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C84A)', color: '#0D0D1A' }}>
            Sign In as Admin
          </a>
        </div>
      </div>
    );
  }

  // === Data ===
  const allData = useMemo(() => candidates.map(c => ({
    ...c, votes: voteCounts[c.id] ?? 0, meta: CATEGORY_META[c.category],
  })).sort((a, b) => a.category.localeCompare(b.category) || b.votes - a.votes), [candidates, voteCounts]);

  const barData = candidates.filter(c => c.isActive).map(c => ({
    name: c.name.split(' ')[0],
    votes: voteCounts[c.id] ?? 0,
    category: c.category,
  }));

  const participatingVoterCount = new Set(voteRecords.map(record => record.voterId)).size;
  const turnout = participatingVoterCount > 0 ? Math.round((voteRecords.length / (participatingVoterCount * 4)) * 100) : 0;
  const ballotRows = useMemo(() => {
    const byVoter = new Map<string, { name: string; email: string; votes: Partial<Record<Category, string>>; lastVote: Date }>();
    voteRecords.forEach(record => {
      const row = byVoter.get(record.voterId) ?? { name: record.voterName, email: record.voterEmail, votes: {}, lastVote: record.createdAt };
      row.votes[record.category] = candidates.find(candidate => candidate.id === record.candidateId)?.name ?? 'Removed candidate';
      if (new Date(record.createdAt) > new Date(row.lastVote)) row.lastVote = record.createdAt;
      byVoter.set(record.voterId, row);
    });
    return [...byVoter.values()].sort((a, b) => new Date(b.lastVote).getTime() - new Date(a.lastVote).getTime());
  }, [voteRecords, candidates]);

  // === Exports ===
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(allData.map(c => ({
      Category: c.meta.label, Name: c.name, Nickname: c.nickname,
      Department: c.department, Year: c.year, Votes: c.votes, Active: c.isActive ? 'Yes' : 'No',
    })));
    ws['!cols'] = [10, 22, 12, 22, 10, 8, 8].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    const auditWs = XLSX.utils.json_to_sheet(auditLog.map(e => ({
      Timestamp: new Date(e.timestamp).toLocaleString(), Actor: e.actor, Action: e.action, Details: e.details,
    })));
    XLSX.utils.book_append_sheet(wb, auditWs, 'Audit Log');
    XLSX.writeFile(wb, 'MTU_King_Queen_2026.xlsx');
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.setTextColor(212, 175, 55);
    doc.text('MTU King & Queen 2026 — Results', 14, 20);
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()} · Total votes: ${totalVotes.toLocaleString()}`, 14, 30);
    doc.setFontSize(13); doc.setTextColor(50);
    doc.text('Winners', 14, 42);
    autoTable(doc, {
      startY: 46,
      head: [['Category', 'Winner', 'Department', 'Votes']],
      body: (['king', 'queen', 'style', 'smart'] as Category[]).map(cat => {
        const w = winners[cat];
        return [CATEGORY_META[cat].label, w?.name ?? '—', w?.department ?? '—', (voteCounts[w?.id ?? ''] ?? 0).toLocaleString()];
      }),
      headStyles: { fillColor: [26, 26, 62] },
    });
    const y = (doc as any).lastAutoTable.finalY + 10;
    doc.text('Full Standings', 14, y);
    autoTable(doc, {
      startY: y + 4,
      head: [['Category', 'Name', 'Department', 'Year', 'Votes']],
      body: allData.map(c => [CATEGORY_META[c.category].label, c.name, c.department, c.year, c.votes.toLocaleString()]),
      headStyles: { fillColor: [26, 26, 62] },
    });
    doc.save('MTU_King_Queen_2026.pdf');
  };

  const exportAuditCSV = () => {
    const rows = ['Timestamp,Actor,Action,Details', ...auditLog.map(e =>
      [new Date(e.timestamp).toLocaleString(), e.actor, e.action, `"${e.details}"`].join(',')
    )].join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'audit_log.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // === Election lifecycle ===
  // === Candidate modal ===
  const openAddModal = () => { setForm(BLANK_FORM); setCandidateModal({ mode: 'add' }); };
  const openEditModal = (c: Candidate) => {
    setForm({ name: c.name, nickname: c.nickname, department: c.department, year: c.year, category: c.category, bio: c.bio, talent: c.talent, photo: c.photo, isActive: c.isActive });
    setCandidateModal({ mode: 'edit', id: c.id });
  };
  const saveCandidate = () => {
    if (!form.name.trim()) return;
    if (candidateModal?.mode === 'add') {
      addCandidate(form, actorName);
    } else if (candidateModal?.id) {
      updateCandidate(candidateModal.id, form, actorName);
    }
    setCandidateModal(null);
  };

  const inputStyle = {
    background: inputBg, color: textPrimary,
    border: `1px solid ${border}`,
  };

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: textMuted }}>{label}</label>
      {children}
    </div>
  );

  const inputCls = 'w-full px-3 py-2.5 rounded-xl text-sm outline-none';

  return (
    <div style={{ background: bg, color: textPrimary, minHeight: '100vh' }} className="pt-16">
      {/* Top bar */}
      <div className="border-b px-4 sm:px-6 py-4" style={{ background: darkMode ? '#161624' : '#FFFFFF', borderColor: border }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Shield size={22} style={{ color: '#D4AF37' }} />
            <div>
              <h1 className="font-display font-bold text-lg" style={{ color: textPrimary }}>Admin Dashboard</h1>
              <p className="text-xs" style={{ color: textMuted }}>Signed in as {actorName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportExcel} className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: 'rgba(0,201,167,0.3)', color: '#00C9A7' }}>
              <Download size={11} className="inline mr-1" />Excel
            </button>
            <button onClick={exportPDF} className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: 'rgba(212,175,55,0.3)', color: '#D4AF37' }}>
              <Download size={11} className="inline mr-1" />PDF
            </button>
            <button onClick={logout} className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: border, color: textMuted }}>
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b px-4 sm:px-6" style={{ background: darkMode ? '#161624' : '#FFFFFF', borderColor: border }}>
        <div className="max-w-7xl mx-auto flex gap-0 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors"
              style={{ borderBottomColor: activeTab === tab ? '#D4AF37' : 'transparent', color: activeTab === tab ? '#D4AF37' : textMuted }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-7 pb-20">

        {/* ── OVERVIEW ── */}
        {activeTab === 'Overview' && (
          <div className="space-y-7">
            {/* Stat cards */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Votes', value: totalVotes.toLocaleString(), icon: <Trophy size={18} />, color: '#D4AF37' },
                { label: 'Email Voters', value: String(participatingVoterCount), icon: <Users size={18} />, color: '#60A5FA' },
                { label: 'Turnout', value: `${turnout}%`, icon: <BarChart3 size={18} />, color: '#A78BFA' },
                { label: 'Status', value: election.status.charAt(0).toUpperCase() + election.status.slice(1), icon: election.status === 'open' ? <CheckCircle2 size={18} /> : <XCircle size={18} />, color: election.status === 'open' ? '#00C9A7' : election.status === 'published' ? '#D4AF37' : '#FF7AAE' },
              ].map(s => (
                <div key={s.label} className="rounded-2xl p-5 border" style={{ background: cardBg, borderColor: border }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm" style={{ color: textMuted }}>{s.label}</span>
                    <span style={{ color: s.color }}>{s.icon}</span>
                  </div>
                  <p className="font-display font-bold text-2xl" style={{ color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Turnout meter */}
            <div className="rounded-2xl p-5 border" style={{ background: cardBg, borderColor: border }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold" style={{ color: textPrimary }}>Voter Turnout</h3>
                <span className="font-mono text-sm font-bold" style={{ color: '#D4AF37' }}>{turnout}%</span>
              </div>
              <div className="h-3 rounded-full overflow-hidden" style={{ background: darkMode ? '#252538' : '#F0EDE8' }}>
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(turnout, 100)}%`, background: 'linear-gradient(90deg, #D4AF37, #E8C84A)' }} />
              </div>
              <p className="text-xs mt-1.5" style={{ color: textMuted }}>{voteRecords.length.toLocaleString()} ballots from {participatingVoterCount} email voters</p>
            </div>

            {/* Current leaders */}
            <div>
              <h3 className="font-display font-bold text-lg mb-4" style={{ color: textPrimary }}>Current Leaders</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {(['king', 'queen', 'style', 'smart'] as Category[]).map(cat => {
                  const winner = winners[cat];
                  const meta = CATEGORY_META[cat];
                  if (!winner) return null;
                  return (
                    <div key={cat} className="rounded-2xl overflow-hidden border" style={{ background: cardBg, borderColor: meta.borderColor }}>
                      <div className="relative h-28 overflow-hidden bg-night-900">
                        <img src={winner.photo} alt={winner.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(13,13,26,0.9), transparent)' }} />
                      </div>
                      <div className="p-4">
                        <p className="font-mono text-xs mb-0.5" style={{ color: meta.color }}>{meta.icon} {meta.label} — Leading</p>
                        <p className="font-display font-bold text-lg" style={{ color: textPrimary }}>{winner.name}</p>
                        <p className="font-mono font-bold" style={{ color: '#D4AF37' }}>{(voteCounts[winner.id] ?? 0).toLocaleString()} votes</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* â”€â”€ BALLOT DATABASE â”€â”€ */}
        {activeTab === 'Ballots' && (
          <div className="space-y-5">
            <div>
              <h2 className="font-display font-bold text-xl" style={{ color: textPrimary }}>Ballot Database</h2>
              <p className="text-sm mt-1" style={{ color: textMuted }}>Email-verified voters and the categories they have completed. {voteRecords.length} recorded ballots.</p>
            </div>
            <div className="rounded-2xl border overflow-hidden" style={{ background: cardBg, borderColor: border }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr style={{ borderBottom: `1px solid ${border}` }}>
                    {['Voter', 'Email', 'King', 'Queen', 'Best Style', 'Smartest', 'Last ballot'].map(header => <th key={header} className="px-4 py-3 text-left font-mono text-xs uppercase tracking-wide" style={{ color: textMuted }}>{header}</th>)}
                  </tr></thead>
                  <tbody>
                    {ballotRows.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: textMuted }}>No ballots have been recorded yet.</td></tr> : ballotRows.map(row => (
                      <tr key={row.email} style={{ borderBottom: `1px solid ${border}` }}>
                        <td className="px-4 py-3 font-medium" style={{ color: textPrimary }}>{row.name}</td>
                        <td className="px-4 py-3" style={{ color: textMuted }}>{row.email}</td>
                        {(['king', 'queen', 'style', 'smart'] as Category[]).map(category => <td key={category} className="px-4 py-3" style={{ color: row.votes[category] ? CATEGORY_META[category].color : textMuted }}>{row.votes[category] ?? '—'}</td>)}
                        <td className="px-4 py-3 whitespace-nowrap" style={{ color: textMuted }}>{new Date(row.lastVote).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── CANDIDATES ── */}
        {activeTab === 'Candidates' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-xl" style={{ color: textPrimary }}>Candidates</h2>
              <button
                onClick={openAddModal}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
                style={{ background: 'rgba(212,175,55,0.12)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}
              >
                <Plus size={15} /> Add Candidate
              </button>
            </div>

            <div className="rounded-2xl border overflow-hidden" style={{ background: cardBg, borderColor: border }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${border}` }}>
                      {['', 'Name', 'Category', 'Department', 'Year', 'Votes', 'Status', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-mono text-xs uppercase tracking-wide" style={{ color: textMuted }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allData.map((c, i) => (
                      <tr key={c.id} style={{ borderBottom: `1px solid ${border}`, background: i % 2 === 0 ? 'transparent' : (darkMode ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.01)') }}>
                        <td className="px-4 py-3">
                          <img src={c.photo} alt={c.name} className="w-8 h-8 rounded-full object-cover" />
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold" style={{ color: textPrimary }}>{c.name}</p>
                          <p className="text-xs" style={{ color: textMuted }}>"{c.nickname}"</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: c.meta.bgColor, color: c.meta.color }}>
                            {c.meta.icon} {c.meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: textMuted }}>{c.department}</td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: textMuted }}>{c.year}</td>
                        <td className="px-4 py-3 font-mono font-bold" style={{ color: '#D4AF37' }}>{c.votes.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: c.isActive ? 'rgba(0,201,167,0.1)' : 'rgba(255,122,174,0.1)', color: c.isActive ? '#00C9A7' : '#FF7AAE' }}>
                            {c.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            <button onClick={() => openEditModal(c)} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors" style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37' }}>
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => setConfirmAction({ label: `${c.isActive ? 'Deactivate' : 'Activate'} "${c.name}"?`, action: () => toggleCandidateActive(c.id, actorName) })}
                              disabled={election.status === 'open' && c.isActive}
                              title={election.status === 'open' && c.isActive ? 'Cannot deactivate while voting is open (SRS FR-2.4)' : ''}
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40"
                              style={{ background: c.isActive ? 'rgba(255,122,174,0.1)' : 'rgba(0,201,167,0.1)', color: c.isActive ? '#FF7AAE' : '#00C9A7' }}
                            >
                              {c.isActive ? <XCircle size={12} /> : <CheckCircle2 size={12} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── ANALYTICS ── */}
        {activeTab === 'Analytics' && (
          <div className="space-y-7">
            <div className="rounded-2xl border p-5" style={{ background: cardBg, borderColor: border }}>
              <h3 className="font-display font-bold text-lg mb-4" style={{ color: textPrimary }}>Live Tally — Votes by Candidate</h3>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={border} />
                    <XAxis dataKey="name" tick={{ fill: textMuted, fontSize: 11 }} />
                    <YAxis tick={{ fill: textMuted, fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: darkMode ? '#1E1E30' : '#FFF', border: `1px solid ${border}`, borderRadius: 12, color: textPrimary }} />
                    <Bar dataKey="votes" radius={[6, 6, 0, 0]}>
                      {barData.map((e, i) => <Cell key={i} fill={CAT_COLORS[e.category as Category]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              {(['king', 'queen', 'style', 'smart'] as Category[]).map(cat => {
                const meta = CATEGORY_META[cat];
                const catCandidates = candidates.filter(c => c.category === cat && c.isActive).map(c => ({ ...c, votes: voteCounts[c.id] ?? 0 })).sort((a, b) => b.votes - a.votes);
                const total = catCandidates.reduce((s, c) => s + c.votes, 0);
                return (
                  <div key={cat} className="rounded-2xl border p-5" style={{ background: cardBg, borderColor: meta.borderColor }}>
                    <h3 className="font-display font-bold text-lg mb-4" style={{ color: meta.color }}>
                      {meta.icon} {meta.label} Race
                    </h3>
                    <div className="space-y-3">
                      {catCandidates.map((c, i) => {
                        const pct = total > 0 ? (c.votes / total * 100) : 0;
                        return (
                          <div key={c.id}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{['🥇', '🥈', '🥉'][i] ?? `#${i + 1}`}</span>
                                <span className="text-sm font-medium" style={{ color: textPrimary }}>{c.name}</span>
                              </div>
                              <span className="font-mono text-sm font-bold" style={{ color: i === 0 ? meta.color : textMuted }}>
                                {c.votes.toLocaleString()} ({pct.toFixed(1)}%)
                              </span>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden" style={{ background: darkMode ? '#252538' : '#F0EDE8' }}>
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: i === 0 ? meta.color : `${meta.color}55` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── AUDIT LOG ── */}
        {activeTab === 'Audit' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-xl" style={{ color: textPrimary }}>Audit Log</h2>
              <button onClick={exportAuditCSV} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border" style={{ borderColor: 'rgba(212,175,55,0.3)', color: '#D4AF37' }}>
                <Download size={12} /> Export CSV
              </button>
            </div>
            <div className="rounded-2xl border overflow-hidden" style={{ background: cardBg, borderColor: border }}>
              {auditLog.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm" style={{ color: textMuted }}>No audit entries yet.</p>
              ) : (
                <div className="divide-y" style={{ borderColor: border }}>
                  {auditLog.map(e => (
                    <div key={e.id} className="px-5 py-3 flex items-start gap-4">
                      <div className="shrink-0 pt-0.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: e.action.includes('OPENED') || e.action.includes('VERIFIED') || e.action.includes('PUBLISHED') ? '#00C9A7' : e.action.includes('CLOSED') || e.action.includes('UNVERIFIED') || e.action.includes('RESET') ? '#FF7AAE' : '#D4AF37' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold" style={{ color: '#D4AF37' }}>{e.action}</span>
                          <span className="text-xs" style={{ color: textMuted }}>by {e.actor}</span>
                        </div>
                        <p className="text-sm mt-0.5" style={{ color: textPrimary }}>{e.details}</p>
                      </div>
                      <span className="font-mono text-xs shrink-0" style={{ color: textMuted }}>
                        {new Date(e.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── CONTROLS ── */}
        {activeTab === 'Controls' && (
          <div className="max-w-lg space-y-6">
            {/* Election lifecycle */}
            <div className="rounded-2xl border p-6" style={{ background: cardBg, borderColor: border }}>
              <h3 className="font-display font-bold text-lg mb-1" style={{ color: textPrimary }}>Election Control</h3>
              <p className="text-sm mb-5" style={{ color: textMuted }}>
                Current status: <span className="font-mono font-bold" style={{ color: '#D4AF37' }}>{election.status.toUpperCase()}</span>
              </p>
              <div className="flex items-center gap-2 mb-5">
                {(['scheduled', 'open', 'closed', 'published'] as const).map((s, i) => (
                  <div key={s} className="flex items-center gap-1">
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono border-2"
                        style={{
                          background: election.status === s ? 'rgba(212,175,55,0.2)' : ['scheduled','open','closed','published'].indexOf(election.status) > i ? 'rgba(0,201,167,0.1)' : 'transparent',
                          borderColor: election.status === s ? '#D4AF37' : ['scheduled','open','closed','published'].indexOf(election.status) > i ? '#00C9A7' : border,
                          color: election.status === s ? '#D4AF37' : '#9CA3AF',
                        }}
                      >
                        {['scheduled','open','closed','published'].indexOf(election.status) > i ? <Check size={10} style={{ color: '#00C9A7' }} /> : i + 1}
                      </div>
                      <span className="text-xs capitalize" style={{ color: election.status === s ? '#D4AF37' : textMuted }}>{s}</span>
                    </div>
                    {i < 3 && <div className="w-6 h-px mb-4" style={{ background: border }} />}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  disabled={election.status === 'open'}
                  onClick={() => setConfirmAction({ label: 'Open voting? Students will be able to cast ballots immediately.', action: () => openElection(actorName) })}
                  className="py-3 rounded-xl font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'rgba(0,201,167,0.12)', color: '#00A98E', border: '1px solid rgba(0,201,167,0.35)' }}
                >
                  Open Voting
                </button>
                <button
                  disabled={election.status !== 'open'}
                  onClick={() => setConfirmAction({ label: 'Close voting? No student will be able to cast a ballot until you open it again.', action: () => closeElection(actorName) })}
                  className="py-3 rounded-xl font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'rgba(255,77,141,0.10)', color: '#FF4D8D', border: '1px solid rgba(255,77,141,0.32)' }}
                >
                  Close Voting
                </button>
              </div>
              {(election.status === 'closed' || election.status === 'published') && (
                <button onClick={() => setConfirmAction({ label: 'Publish the current results?', action: () => publishResults(actorName) })} className="w-full py-2 mt-3 text-sm font-medium" style={{ color: '#D4AF37' }}>
                  Publish Results
                </button>
              )}
            </div>

            {/* Reset */}
            <div className="rounded-2xl border p-6" style={{ background: cardBg, borderColor: 'rgba(255,122,174,0.2)' }}>
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle size={18} style={{ color: '#FF7AAE', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <h3 className="font-display font-bold text-lg" style={{ color: textPrimary }}>Reset Votes</h3>
                  <p className="text-sm mt-0.5" style={{ color: textMuted }}>Resets all vote counts. Cannot be undone.</p>
                </div>
              </div>
              <button
                onClick={() => setConfirmAction({ label: 'Reset all vote counts?', action: () => resetVotes(actorName) })}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(255,122,174,0.1)', color: '#FF7AAE', border: '1px solid rgba(255,122,174,0.3)' }}
              >
                <RefreshCw size={13} className="inline mr-1.5" />Reset All Votes
              </button>
            </div>

            {/* Export */}
            <div className="rounded-2xl border p-6" style={{ background: cardBg, borderColor: border }}>
              <h3 className="font-display font-bold text-lg mb-4" style={{ color: textPrimary }}>Export Data</h3>
              <div className="flex gap-3 flex-wrap">
                <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: 'rgba(0,201,167,0.1)', color: '#00C9A7', border: '1px solid rgba(0,201,167,0.3)' }}>
                  <Download size={14} /> Excel (Results + Audit)
                </button>
                <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}>
                  <Download size={14} /> PDF Report
                </button>
                <button onClick={exportAuditCSV} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: 'rgba(156,163,175,0.1)', color: textMuted, border: `1px solid ${border}` }}>
                  <FileText size={14} /> Audit CSV
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── CONFIRM DIALOG ── */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="rounded-3xl p-6 max-w-sm w-full text-center border" style={{ background: cardBg, borderColor: 'rgba(212,175,55,0.3)' }}>
            <AlertTriangle size={32} className="mx-auto mb-4" style={{ color: '#D4AF37' }} />
            <h3 className="font-display font-bold text-xl mb-2" style={{ color: textPrimary }}>Confirm Action</h3>
            <p className="text-sm mb-6" style={{ color: textMuted }}>{confirmAction.label}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmAction(null)} className="flex-1 py-3 rounded-xl text-sm border" style={{ borderColor: border, color: textMuted }}>Cancel</button>
              <button onClick={() => { confirmAction.action(); setConfirmAction(null); }} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C84A)', color: '#0D0D1A' }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CANDIDATE MODAL ── */}
      {candidateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="relative rounded-3xl p-6 w-full max-w-lg border my-8" style={{ background: cardBg, borderColor: border }}>
            <button className="absolute top-4 right-4" onClick={() => setCandidateModal(null)} style={{ color: textMuted }}><X size={18} /></button>
            <h3 className="font-display font-bold text-xl mb-5" style={{ color: textPrimary }}>
              {candidateModal.mode === 'add' ? 'Add Candidate' : 'Edit Candidate'}
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Full Name">
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Full name" />
              </Field>
              <Field label="Nickname">
                <input value={form.nickname} onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))} className={inputCls} style={inputStyle} placeholder="e.g. KB" />
              </Field>
              <Field label="Category">
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))} className={inputCls} style={inputStyle}>
                  <option value="king">King</option>
                  <option value="queen">Queen</option>
                  <option value="style">Best Style</option>
                  <option value="smart">Smartest</option>
                </select>
              </Field>
              <Field label="Academic Year">
                <select value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} className={inputCls} style={inputStyle}>
                  {['Level 100', 'Level 200', 'Level 300', 'Level 400'].map(y => <option key={y}>{y}</option>)}
                </select>
              </Field>
              <Field label="Department / Major">
                <input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} className={`${inputCls} col-span-2`} style={inputStyle} placeholder="e.g. Computer Science" />
              </Field>
              <Field label="Talent / Strength">
                <input value={form.talent} onChange={e => setForm(f => ({ ...f, talent: e.target.value }))} className={inputCls} style={inputStyle} placeholder="e.g. Leadership" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Photo URL (Unsplash or direct link)">
                  <input value={form.photo} onChange={e => setForm(f => ({ ...f, photo: e.target.value }))} className={inputCls} style={inputStyle} placeholder="https://images.unsplash.com/..." />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Bio (short description)">
                  <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} className={`${inputCls} resize-none`} style={{ ...inputStyle, height: 80 }} placeholder="Brief bio..." />
                </Field>
              </div>
            </div>
            {form.photo && (
              <img src={form.photo} alt="Preview" className="w-20 h-20 rounded-full object-cover mt-4 border-2" style={{ borderColor: CATEGORY_META[form.category].color }} />
            )}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setCandidateModal(null)} className="flex-1 py-3 rounded-xl text-sm border" style={{ borderColor: border, color: textMuted }}>Cancel</button>
              <button onClick={saveCandidate} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C84A)', color: '#0D0D1A' }}>
                {candidateModal.mode === 'add' ? 'Add Candidate' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
