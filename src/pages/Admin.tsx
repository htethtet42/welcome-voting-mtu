import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Shield, Trophy, Users, BarChart3, FileText,
  Download, RefreshCw, Plus, Pencil, CheckCircle2,
  XCircle, AlertTriangle, X, Check, Activity, Database, List
} from 'lucide-react';
import { useElection } from '../context/ElectionContext';
import { useAuth } from '../context/AuthContext';
import { CATEGORY_META, type Category, type Candidate } from '../types';

const TABS = ['Overview', 'Candidates', 'Ballots', 'Analytics', 'Audit', 'Controls'] as const;
type Tab = typeof TABS[number];

// Upgraded colors covering all six categories
const CAT_COLORS: Record<Category, string> = {
  king: '#60A5FA',
  queen: '#FF7AAE',
  style: '#A78BFA',
  smart: '#2EDBB8',
  popular_man: '#2EDBB8',
  popular_woman: '#A78BFA',
};

interface CandidateForm {
  name: string;
  nickname: string;
  department: string;
  year: string;
  category: Category;
  bio: string;
  talent: string;
  photo: string;
  isActive: boolean;
}

const DEPARTMENTS = [
  'Civil Engineering',
  'Mechanical Engineering',
  'Electrical Power Engineering',
  'Electronic Engineering',
  'Computer Engineering & IT',
  'Mechatronic Engineering',
  'Agricultural Engineering',
  'Architecture',
  'Mining',
  'Biotechnology',
  'Nuclear Engineering',
] as const;

const BLANK_FORM: CandidateForm = {
  name: '',
  nickname: '',
  department: DEPARTMENTS[0],
  year: 'First year',
  category: 'king',
  bio: '',
  talent: '',
  photo: '',
  isActive: true,
};

const Field = ({ label, textMuted, children }: { label: string; textMuted?: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: textMuted }}>
      {label}
    </label>
    {children}
  </div>
);
const API_URL = 'https://qldhyi-ip-103-57-207-5.tunnelmole.net/api';

export default function Admin() {
  const {
    election, candidates, voteCounts, voteRecords, auditLog,
    darkMode, totalVotes, winners,
    openElection, closeElection, publishResults,
    addCandidate, updateCandidate, toggleCandidateActive,
    setElectionType,
    resetVotes,
  } = useElection();
  const { user, isAuthenticated, isAdmin, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [confirmAction, setConfirmAction] = useState<null | { label: string; action: () => void }>(null);
  const [candidateModal, setCandidateModal] = useState<null | { mode: 'add' | 'edit'; id?: string }>(null);
  const [form, setForm] = useState<CandidateForm>(BLANK_FORM);

  // Modern Prestige Color Palette
  const bg = darkMode ? '#0A0F1D' : '#e7dbc5';
  const cardBg = darkMode ? 'rgba(22, 22, 36, 0.6)' : 'rgba(255, 255, 255, 0.7)';
  const textPrimary = darkMode ? '#F8F9FA' : '#111827';
  const textMuted = darkMode ? '#9CA3AF' : '#6B7280';
  const border = darkMode ? 'rgba(212,175,55,0.15)' : 'rgba(212,175,55,0.3)';
  const inputBg = darkMode ? 'rgba(10, 15, 29, 0.5)' : 'rgba(255, 255, 255, 0.9)';

  const actorName = user?.name ?? 'Admin';

  // Gate: Elevated Admin Authentication
  if (!isAuthenticated || !isAdmin) {
    return (
      <div style={{ background: bg, minHeight: '100vh' }} className="pt-16 flex items-center justify-center px-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-30" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(212,175,55,0.1) 0%, transparent 60%)' }} />
        <div className="relative w-full max-w-md rounded-3xl p-10 text-center backdrop-blur-xl shadow-2xl border" style={{ background: cardBg, borderColor: border }}>
          <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6" style={{ background: 'rgba(212,175,55,0.1)' }}>
            <Shield size={40} style={{ color: '#D4AF37' }} />
          </div>
          <h2 className="font-display font-bold text-2xl mb-3" style={{ color: textPrimary }}>Command Center</h2>
          <p className="text-sm leading-relaxed mb-8" style={{ color: textMuted }}>Restricted access. Please authenticate with elevated administrative credentials to proceed.</p>
          <a href="#/login" className="block w-full py-4 rounded-full font-bold text-sm transition-all duration-300 hover:scale-[1.02] shadow-lg" style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C84A)', color: '#0A0F1D' }}>
            Authenticate as Admin
          </a>
        </div>
      </div>
    );
  }

  // === Data Logic ===
  const allData = useMemo(() => candidates.map(c => ({
    ...c, votes: voteCounts[c.id] ?? 0, meta: CATEGORY_META[c.category],
  })).sort((a, b) => a.category.localeCompare(b.category) || b.votes - a.votes), [candidates, voteCounts]);

  const barData = candidates.filter(c => c.isActive).map(c => ({
    name: c.name.split(' ')[0],
    votes: voteCounts[c.id] ?? 0,
    category: c.category,
  }));

  const participatingVoterCount = new Set(voteRecords.map(record => record.voterId)).size;
  const turnout = participatingVoterCount > 0 ? Math.round((voteRecords.length / (participatingVoterCount * 6)) * 100) : 0;
  
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

  // === Export Logic ===
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(allData.map(c => ({ Category: c.meta.label, Name: c.name, Nickname: c.nickname ?? '', Department: c.department ?? '', Year: c.year ?? '', Votes: c.votes, Active: c.isActive ? 'Yes' : 'No' })));
    ws['!cols'] = [10, 22, 12, 22, 10, 8, 8].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    const auditWs = XLSX.utils.json_to_sheet(auditLog.map(e => ({ Timestamp: new Date(e.timestamp).toLocaleString(), Actor: e.actor, Action: e.action, Details: e.details })));
    XLSX.utils.book_append_sheet(wb, auditWs, 'Audit Log');
    XLSX.writeFile(wb, 'MTU_King_Queen_2026.xlsx');
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.setTextColor(212, 175, 55);
    doc.text('MTU King & Queen 2026 — Official Results', 14, 20);
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()} · Verified votes: ${totalVotes.toLocaleString()}`, 14, 30);
    doc.setFontSize(13); doc.setTextColor(50);
    doc.text('Elected Champions', 14, 42);
    autoTable(doc, {
      startY: 46,
      head: [['Category', 'Winner', 'Department', 'Votes']],
      body: (['king', 'queen', 'style', 'smart', 'popular_man', 'popular_woman'] as Category[]).map(cat => {
        const w = winners[cat];
        return [CATEGORY_META[cat].label, w?.name ?? '—', w?.department ?? '—', (voteCounts[w?.id ?? ''] ?? 0).toLocaleString()];
      }),
      headStyles: { fillColor: [26, 26, 62] },
    });
    const y = (doc as any).lastAutoTable.finalY + 10;
    doc.text('Comprehensive Standings', 14, y);
    autoTable(doc, {
      startY: y + 4,
      head: [['Category', 'Name', 'Department', 'Year', 'Votes']],
      body: allData.map(c => [CATEGORY_META[c.category].label, c.name, c.department ?? '—', c.year ?? '—', c.votes.toLocaleString()]),
      headStyles: { fillColor: [26, 26, 62] },
    });
    doc.save('MTU_King_Queen_2026.pdf');
  };

  const exportAuditCSV = () => {
    const rows = ['Timestamp,Actor,Action,Details', ...auditLog.map(e => [new Date(e.timestamp).toLocaleString(), e.actor, e.action, `"${e.details}"`].join(','))].join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'audit_log.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // === Event Handler ===
  const handleTypeChange = async (newType: 'fresher' | 'major') => {
  // 1. Update state locally in ElectionContext
  setElectionType(newType, actorName);

  // 2. Broadcast the update to your backend server so all mobile devices pull it
  try {
    await fetch(`${API_URL}/election`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: newType }),
    });
  } catch (err) {
    console.error('Failed to sync election type with backend:', err);
  }
};

  // === Modal Handlers ===
  const openAddModal = () => { setForm(BLANK_FORM); setCandidateModal({ mode: 'add' }); };
  const openEditModal = (c: Candidate) => {
    setForm({
      name: c.name,
      nickname: c.nickname ?? '',
      department: c.department ?? DEPARTMENTS[0],
      year: c.year ?? 'First year',
      category: c.category,
      bio: c.bio,
      talent: c.talent ?? '',
      photo: c.photo ?? c.photoUrl ?? '',
      isActive: c.isActive,
    });
    setCandidateModal({ mode: 'edit', id: c.id });
  };

  const saveCandidate = async () => {
  if (!form.name.trim()) return;

  try {
    if (candidateModal?.mode === 'add') {
      await addCandidate(form, actorName);
    } else if (candidateModal?.id) {
      await updateCandidate(candidateModal.id, form, actorName);
    }

    setCandidateModal(null);
  } catch (error) {
    console.error('Failed to save candidate:', error);
    alert('Failed to save candidate. Please try again.');
  }
};

  const inputStyle = { background: inputBg, color: textPrimary, border: `1px solid ${border}` };
  const inputCls = 'w-full px-4 py-3 rounded-xl text-sm outline-none transition-all focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]';

  return (
    <div style={{ background: bg, color: textPrimary, minHeight: '100vh' }} className="pt-16 selection:bg-[#D4AF37] selection:text-[#0A0F1D]">
      
      {/* Header */}
      <div className="sticky top-16 z-30 border-b backdrop-blur-xl transition-all" style={{ background: darkMode ? 'rgba(13, 13, 26, 0.8)' : 'rgba(248, 245, 239, 0.8)', borderColor: border }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-lg" style={{ background: 'rgba(212,175,55,0.1)' }}>
              <Shield size={24} style={{ color: '#D4AF37' }} />
            </div>
            <div>
              <h1 className="font-display font-bold text-xl tracking-tight" style={{ color: textPrimary }}>System Command</h1>
              <p className="text-xs font-mono" style={{ color: textMuted }}>Session authorized: <span style={{ color: '#D4AF37' }}>{actorName}</span></p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 mr-2">
              <button onClick={exportExcel} className="text-xs font-semibold px-4 py-2 rounded-lg transition-colors hover:bg-white/5" style={{ color: '#00C9A7', border: '1px solid rgba(0,201,167,0.3)' }}>
                <Download size={14} className="inline mr-1.5" />.XLSX
              </button>
              <button onClick={exportPDF} className="text-xs font-semibold px-4 py-2 rounded-lg transition-colors hover:bg-white/5" style={{ color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}>
                <Download size={14} className="inline mr-1.5" />.PDF
              </button>
            </div>
            <div className="w-px h-6 hidden sm:block" style={{ background: border }}></div>
            <button onClick={logout} className="text-xs font-semibold px-4 py-2 rounded-lg transition-all hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30" style={{ border: `1px solid ${border}`, color: textMuted }}>
              Terminate Session
            </button>
          </div>
        </div>

        {/* Nav Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-2 overflow-x-auto pb-4 hide-scrollbar">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className="px-5 py-2.5 text-sm font-semibold rounded-full whitespace-nowrap transition-all duration-300 flex items-center gap-2" style={{ background: activeTab === tab ? 'rgba(212,175,55,0.1)' : 'transparent', color: activeTab === tab ? '#D4AF37' : textMuted, border: activeTab === tab ? '1px solid rgba(212,175,55,0.3)' : '1px solid transparent' }}>
              {tab === 'Overview' && <Activity size={14} />}
              {tab === 'Candidates' && <Users size={14} />}
              {tab === 'Ballots' && <Database size={14} />}
              {tab === 'Analytics' && <BarChart3 size={14} />}
              {tab === 'Audit' && <List size={14} />}
              {tab === 'Controls' && <Shield size={14} />}
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-24 relative z-10">

        {/* OVERVIEW */}
        {activeTab === 'Overview' && (
          <div className="space-y-8 animate-[fadeIn_0.3s_ease-out]">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {[
                { label: 'Total Ballots Cast', value: totalVotes.toLocaleString(), icon: <Trophy size={20} />, color: '#D4AF37' },
                { label: 'Verified Identities', value: String(participatingVoterCount), icon: <Users size={20} />, color: '#60A5FA' },
                { label: 'Participation Rate', value: `${turnout}%`, icon: <Activity size={20} />, color: '#A78BFA' },
                { label: 'Network Status', value: election.status.toUpperCase(), icon: election.status === 'open' ? <CheckCircle2 size={20} className="animate-pulse" /> : <XCircle size={20} />, color: election.status === 'open' ? '#00C9A7' : election.status === 'published' ? '#D4AF37' : '#FF7AAE' },
              ].map((s, i) => (
                <div key={i} className="relative rounded-3xl p-6 backdrop-blur-md overflow-hidden group hover:-translate-y-1 transition-all duration-300" style={{ background: cardBg, border: `1px solid ${border}` }}>
                  <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 blur-2xl group-hover:opacity-20 transition-opacity" style={{ background: s.color }}></div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="p-2 rounded-xl" style={{ background: `${s.color}15`, color: s.color }}>{s.icon}</span>
                  </div>
                  <p className="font-display font-black text-3xl sm:text-4xl mb-1" style={{ color: textPrimary }}>{s.value}</p>
                  <span className="text-xs font-mono uppercase tracking-widest opacity-70" style={{ color: s.color }}>{s.label}</span>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-amber-100/60 border border-amber-200/60 dark:bg-slate-800 dark:border-slate-700/50 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-stone-900 dark:text-white">
                  Election Event Type
                </h3>
                <p className="text-sm text-stone-600 dark:text-slate-400">
                  {election.type === 'major' ? 'Major Welcome Mode' : 'The Whole Welcome Mode'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTypeChange('fresher')}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    election.type !== 'major'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                      : 'bg-stone-200/80 text-stone-700 hover:bg-stone-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                  }`}
                >
                  The Whole Welcome
                </button>
  
              <button
                type="button"
                onClick={() => handleTypeChange('major')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  election.type === 'major'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'bg-stone-200/80 text-stone-700 hover:bg-stone-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                }`}
              >
                Major Welcome
              </button>
              </div>
            </div>

            {/* Projected Winners Grid */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-30"></div>
                <h3 className="font-mono text-sm uppercase tracking-[0.2em]" style={{ color: '#D4AF37' }}>Current Projections</h3>
                <div className="h-px flex-1 bg-gradient-to-r from-[#D4AF37] via-transparent to-transparent opacity-30"></div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {(['king', 'queen', 'style', 'smart', 'popular_man', 'popular_woman'] as Category[]).map(cat => {
                  const winner = winners[cat];
                  const meta = CATEGORY_META[cat];
                  if (!winner) return null;
                  return (
                    <div key={cat} className="group rounded-3xl overflow-hidden backdrop-blur-md transition-all hover:scale-[1.02]" style={{ background: cardBg, border: `1px solid ${meta.borderColor}` }}>
                      <div className="relative aspect-video overflow-hidden bg-gray-900">
                        <img src={winner.photo ?? winner.photoUrl} alt={winner.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-80" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0F1D] via-[#0A0F1D]/50 to-transparent" />
                        <div className="absolute top-3 left-3 px-2 py-1 rounded backdrop-blur-md bg-black/40 border border-white/10 flex items-center gap-1.5">
                          <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: meta.color }}>{meta.icon} {meta.label} Leader</span>
                        </div>
                      </div>
                      <div className="p-5 relative -mt-6">
                        <p className="font-display font-bold text-xl leading-tight mb-1" style={{ color: textPrimary }}>{winner.name}</p>
                        <p className="text-xs mb-3 opacity-70" style={{ color: textPrimary }}>{winner.department}</p>
                        <div className="flex items-center justify-between">
                          <span className="px-3 py-1.5 rounded-lg text-sm font-bold font-mono" style={{ background: `${meta.color}15`, color: meta.color }}>
                            {(voteCounts[winner.id] ?? 0).toLocaleString()} <span className="opacity-60 text-xs">VOTES</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* BALLOTS */}
        {activeTab === 'Ballots' && (
          <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="font-display font-bold text-3xl" style={{ color: textPrimary }}>Encrypted Ledger</h2>
                <p className="text-sm mt-2" style={{ color: textMuted }}>Cryptographically verified ballot entries. <span style={{ color: '#00C9A7' }}>{voteRecords.length} records secured.</span></p>
              </div>
            </div>

            <div className="rounded-3xl border overflow-hidden backdrop-blur-md shadow-2xl" style={{ background: cardBg, borderColor: border }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                      {['Identity', 'Email Address', 'King', 'Queen', 'Style', 'Smartest', 'Popular-M', 'Popular-W', 'Timestamp'].map((header, i) => (
                        <th key={header} className={`px-6 py-4 font-mono text-[10px] uppercase tracking-widest ${i === 0 ? 'rounded-tl-2xl' : ''}`} style={{ color: textMuted }}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: border }}>
                    {ballotRows.length === 0 ? <tr><td colSpan={9} className="px-6 py-12 text-center text-sm" style={{ color: textMuted }}>Awaiting network activity. No ballots recorded.</td></tr> : ballotRows.map(row => (
                      <tr key={row.email} className="transition-colors hover:bg-white/5">
                        <td className="px-6 py-4 font-bold" style={{ color: textPrimary }}>{row.name}</td>
                        <td className="px-6 py-4 font-mono text-xs opacity-70" style={{ color: textPrimary }}>{row.email}</td>
                        {(['king', 'queen', 'style', 'smart', 'popular_man', 'popular_woman'] as Category[]).map(category => (
                          <td key={category} className="px-6 py-4">
                            {row.votes[category] ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium" style={{ background: `${CATEGORY_META[category].color}15`, color: CATEGORY_META[category].color }}>
                                <Check size={12} /> {row.votes[category]}
                              </span>
                            ) : (
                              <span className="opacity-30" style={{ color: textMuted }}>—</span>
                            )}
                          </td>
                        ))}
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-[11px]" style={{ color: textMuted }}>{new Date(row.lastVote).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CANDIDATES */}
        {activeTab === 'Candidates' && (
          <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="font-display font-bold text-3xl" style={{ color: textPrimary }}>Nominee Roster</h2>
                <p className="text-sm mt-2" style={{ color: textMuted }}>Manage official contenders across all categories.</p>
              </div>
              <button onClick={openAddModal} className="group flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all hover:scale-105 shadow-lg" style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C84A)', color: '#0A0F1D' }}>
                <Plus size={16} className="transition-transform group-hover:rotate-90" /> Register Candidate
              </button>
            </div>

            <div className="rounded-3xl border overflow-hidden backdrop-blur-md shadow-2xl" style={{ background: cardBg, borderColor: border }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                      {['Profile', 'Nominee', 'Division', 'Academic', 'Tally', 'Status', 'Terminal'].map(h => (
                        <th key={h} className="px-6 py-4 font-mono text-[10px] uppercase tracking-widest" style={{ color: textMuted }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: border }}>
                    {allData.map(c => (
                      <tr key={c.id} className="transition-colors hover:bg-white/5 group">
                        <td className="px-6 py-4">
                          <div className="relative w-10 h-10">
                            <div className="absolute inset-0 rounded-full blur-sm opacity-40 transition-opacity group-hover:opacity-80" style={{ background: c.meta.color }}></div>
                            <img src={c.photo ?? c.photoUrl} alt={c.name} className="relative w-full h-full rounded-full object-cover border border-white/20" />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-bold text-base" style={{ color: textPrimary }}>{c.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-black/20" style={{ color: c.meta.color }}>{c.meta.icon} {c.meta.label}</span>
                            <span className="text-xs italic" style={{ color: textMuted }}>"{c.nickname}"</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs font-medium" style={{ color: textPrimary }}>{c.department}</td>
                        <td className="px-6 py-4 font-mono text-xs" style={{ color: textMuted }}>{c.year}</td>
                        <td className="px-6 py-4 font-mono font-black text-lg" style={{ color: '#D4AF37' }}>{c.votes.toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg" style={{ background: c.isActive ? 'rgba(0,201,167,0.1)' : 'rgba(255,122,174,0.1)', color: c.isActive ? '#00C9A7' : '#FF7AAE', border: `1px solid ${c.isActive ? 'rgba(0,201,167,0.3)' : 'rgba(255,122,174,0.3)'}` }}>
                            {c.isActive ? <span className="w-1.5 h-1.5 rounded-full bg-[#00C9A7] animate-pulse" /> : <X size={10} />}
                            {c.isActive ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEditModal(c)} className="p-2 rounded-lg transition-colors hover:bg-[#D4AF37]/20" style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37' }}>
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setConfirmAction({ label: `${c.isActive ? 'Suspend' : 'Reinstate'} "${c.name}" from the active roster?`, action: async() => await toggleCandidateActive(c.id, actorName) })}
                              disabled={election.status === 'open' && c.isActive}
                              className="p-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              style={{ background: c.isActive ? 'rgba(255,122,174,0.1)' : 'rgba(0,201,167,0.1)', color: c.isActive ? '#FF7AAE' : '#00C9A7' }}
                            >
                              {c.isActive ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
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

        {/* ANALYTICS */}
        {activeTab === 'Analytics' && (
          <div className="space-y-8 animate-[fadeIn_0.3s_ease-out]">
            <div className="rounded-3xl border p-6 sm:p-8 backdrop-blur-md shadow-2xl" style={{ background: cardBg, borderColor: border }}>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="font-display font-bold text-2xl" style={{ color: textPrimary }}>Global Data Visualization</h3>
                  <p className="text-sm mt-1" style={{ color: textMuted }}>Live bar distribution across all categories.</p>
                </div>
              </div>
              <div style={{ height: 400 }} className="w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} />
                    <XAxis dataKey="name" tick={{ fill: textMuted, fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
                    <YAxis tick={{ fill: textMuted, fontSize: 12 }} axisLine={false} tickLine={false} dx={-10} />
                    <Tooltip 
                      cursor={{ fill: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}
                      contentStyle={{ background: darkMode ? 'rgba(10,15,29,0.95)' : '#FFF', border: `1px solid ${border}`, borderRadius: '16px', color: textPrimary, boxShadow: '0 10px 30px rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)' }}
                      itemStyle={{ fontWeight: 'bold' }}
                    />
                    <Bar dataKey="votes" radius={[6, 6, 0, 0]} maxBarSize={60}>
                      {barData.map((e, i) => <Cell key={i} fill={CAT_COLORS[e.category as Category]} style={{ filter: 'drop-shadow(0px 0px 8px rgba(0,0,0,0.2))' }} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {(['king', 'queen', 'style', 'smart', 'popular_man', 'popular_woman'] as Category[]).map(cat => {
                const meta = CATEGORY_META[cat];
                const catCandidates = candidates.filter(c => c.category === cat && c.isActive).map(c => ({ ...c, votes: voteCounts[c.id] ?? 0 })).sort((a, b) => b.votes - a.votes);
                const total = catCandidates.reduce((s, c) => s + c.votes, 0);
                return (
                  <div key={cat} className="rounded-3xl border p-6 backdrop-blur-md" style={{ background: cardBg, borderColor: meta.borderColor }}>
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                      <span className="p-2 rounded-lg text-lg" style={{ background: `${meta.color}15`, color: meta.color }}>{meta.icon}</span>
                      <h3 className="font-display font-bold text-xl" style={{ color: textPrimary }}>{meta.label} Race</h3>
                    </div>
                    <div className="space-y-5">
                      {catCandidates.map((c, i) => {
                        const pct = total > 0 ? (c.votes / total * 100) : 0;
                        return (
                          <div key={c.id} className="group">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: i === 0 ? meta.color : 'rgba(255,255,255,0.05)', color: i === 0 ? '#0A0F1D' : textMuted }}>{i + 1}</span>
                                <span className="text-sm font-bold" style={{ color: textPrimary }}>{c.name}</span>
                              </div>
                              <span className="font-mono text-sm font-bold" style={{ color: i === 0 ? meta.color : textMuted }}>
                                {c.votes.toLocaleString()} <span className="opacity-50 font-normal">({pct.toFixed(1)}%)</span>
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: darkMode ? 'rgba(0,0,0,0.3)' : '#F0EDE8' }}>
                              <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${pct}%`, background: i === 0 ? meta.color : textMuted, boxShadow: i === 0 ? `0 0 10px ${meta.color}` : 'none' }} />
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

        {/* AUDIT */}
        {activeTab === 'Audit' && (
          <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="font-display font-bold text-3xl" style={{ color: textPrimary }}>System Audit</h2>
                <p className="text-sm mt-2" style={{ color: textMuted }}>Immutable log of all administrative actions.</p>
              </div>
              <button onClick={exportAuditCSV} className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl border transition-colors hover:bg-white/5" style={{ borderColor: border, color: textPrimary, background: cardBg }}>
                <FileText size={16} style={{ color: '#D4AF37' }} /> Download .CSV
              </button>
            </div>

            <div className="rounded-3xl border overflow-hidden backdrop-blur-md p-2" style={{ background: cardBg, borderColor: border }}>
              {auditLog.length === 0 ? (
                <div className="py-20 text-center"><p className="text-sm" style={{ color: textMuted }}>System logs are currently empty.</p></div>
              ) : (
                <div className="relative pl-6 sm:pl-10 pr-4 py-6 space-y-8">
                  <div className="absolute top-8 bottom-8 left-[39px] sm:left-[55px] w-px" style={{ background: border }}></div>
                  {auditLog.map(e => {
                    const isCritical = e.action.includes('CLOSED') || e.action.includes('RESET');
                    const isSuccess = e.action.includes('OPENED') || e.action.includes('PUBLISHED');
                    const logColor = isSuccess ? '#00C9A7' : isCritical ? '#FF7AAE' : '#D4AF37';

                    return (
                      <div key={e.id} className="relative flex items-start gap-6 group">
                        <div className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-lg transition-transform group-hover:scale-110" style={{ background: 'rgba(10,15,29,1)', border: `2px solid ${logColor}` }}>
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: logColor, boxShadow: `0 0 10px ${logColor}` }} />
                        </div>
                        <div className="flex-1 min-w-0 bg-black/10 rounded-2xl p-4 border border-white/5 transition-colors group-hover:bg-white/5">
                          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mb-2">
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{ background: `${logColor}15`, color: logColor }}>{e.action}</span>
                              <span className="text-xs font-medium" style={{ color: textMuted }}><Shield size={10} className="inline mr-1" />{e.actor}</span>
                            </div>
                            <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: textMuted }}>
                              {new Date(e.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed" style={{ color: textPrimary }}>{e.details}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* CONTROLS */}
        {activeTab === 'Controls' && (
          <div className="grid lg:grid-cols-2 gap-6 animate-[fadeIn_0.3s_ease-out]">
            <div className="rounded-3xl border p-8 backdrop-blur-md shadow-2xl" style={{ background: cardBg, borderColor: border }}>
              <h3 className="font-display font-bold text-2xl mb-2" style={{ color: textPrimary }}>Network Lifecycle</h3>
              <p className="text-sm mb-8" style={{ color: textMuted }}>
                Current state: <span className="font-mono font-bold px-2 py-0.5 rounded ml-1" style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37' }}>{election.status.toUpperCase()}</span>
              </p>

              <div className="relative flex justify-between items-center mb-10">
                <div className="absolute top-1/2 left-0 right-0 h-1 -translate-y-1/2 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}></div>
                {(['scheduled', 'open', 'closed', 'published'] as const).map((s, i) => {
                  const isActive = election.status === s;
                  const isPast = ['scheduled', 'open', 'closed', 'published'].indexOf(election.status) > i;
                  return (
                    <div key={s} className="relative z-10 flex flex-col items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-mono border-2 transition-all" style={{ background: isActive ? 'rgba(212,175,55,0.2)' : isPast ? 'rgba(0,201,167,0.1)' : 'rgba(10,15,29,1)', borderColor: isActive ? '#D4AF37' : isPast ? '#00C9A7' : border, color: isActive ? '#D4AF37' : textMuted, boxShadow: isActive ? '0 0 20px rgba(212,175,55,0.3)' : 'none' }}>
                        {isPast ? <Check size={16} style={{ color: '#00C9A7' }} /> : i + 1}
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: isActive ? '#D4AF37' : textMuted }}>{s}</span>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button disabled={election.status === 'open'} onClick={() => setConfirmAction({ label: 'Initiate global voting phase? The network will accept ballots immediately.', action: () => openElection(actorName) })} className="py-4 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] disabled:opacity-30 disabled:hover:scale-100 flex justify-center items-center gap-2" style={{ background: 'rgba(0,201,167,0.1)', color: '#00C9A7', border: '1px solid rgba(0,201,167,0.4)' }}>
                  <Activity size={16} /> Open Network
                </button>
                <button disabled={election.status !== 'open'} onClick={() => setConfirmAction({ label: 'Terminate voting phase? Ballot collection will instantly cease.', action: () => closeElection(actorName) })} className="py-4 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] disabled:opacity-30 disabled:hover:scale-100 flex justify-center items-center gap-2" style={{ background: 'rgba(255,77,141,0.1)', color: '#FF4D8D', border: '1px solid rgba(255,77,141,0.4)' }}>
                  <XCircle size={16} /> Close Network
                </button>
              </div>

              {(election.status === 'closed' || election.status === 'published') && (
                <button onClick={() => setConfirmAction({ label: 'Decrypt and publish final results to public channels?', action: () => publishResults(actorName) })} className="w-full mt-4 py-4 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] flex justify-center items-center gap-2 shadow-[0_0_20px_rgba(212,175,55,0.2)]" style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C84A)', color: '#0A0F1D' }}>
                  <Trophy size={16} /> Publish Final Results
                </button>
              )}
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl p-8 backdrop-blur-md overflow-hidden relative" style={{ background: 'rgba(255, 122, 174, 0.02)', border: '1px solid rgba(255,122,174,0.3)' }}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF7AAE] opacity-5 blur-3xl rounded-full pointer-events-none"></div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-red-500/10 text-[#FF7AAE]"><AlertTriangle size={24} /></div>
                  <h3 className="font-display font-bold text-2xl" style={{ color: textPrimary }}>Danger Zone</h3>
                </div>
                <p className="text-sm mb-6 leading-relaxed" style={{ color: textMuted }}>Purge all database records. This action permanently zeroes all candidate tallies and erases the ballot ledger.</p>
                <button onClick={() => setConfirmAction({ label: 'CRITICAL WARNING: This will permanently erase all votes. Proceed?', action: () => resetVotes(actorName) })} className="w-full py-4 rounded-xl font-bold text-sm transition-all hover:bg-red-500/20 flex justify-center items-center gap-2" style={{ background: 'rgba(255,122,174,0.1)', color: '#FF7AAE', border: '1px solid rgba(255,122,174,0.4)' }}>
                  <RefreshCw size={16} /> Purge Database
                </button>
              </div>

              <div className="rounded-3xl border p-8 backdrop-blur-md" style={{ background: cardBg, borderColor: border }}>
                <h3 className="font-display font-bold text-2xl mb-6" style={{ color: textPrimary }}>Data Extraction</h3>
                <div className="flex flex-col gap-3">
                  <button onClick={exportExcel} className="flex items-center justify-between px-6 py-4 rounded-xl text-sm font-bold transition-colors hover:bg-white/5" style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${border}` }}>
                    <span className="flex items-center gap-3" style={{ color: textPrimary }}><Database size={16} style={{ color: '#00C9A7' }} /> Master Ledger (.XLSX)</span>
                    <Download size={14} style={{ color: textMuted }} />
                  </button>
                  <button onClick={exportPDF} className="flex items-center justify-between px-6 py-4 rounded-xl text-sm font-bold transition-colors hover:bg-white/5" style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${border}` }}>
                    <span className="flex items-center gap-3" style={{ color: textPrimary }}><FileText size={16} style={{ color: '#D4AF37' }} /> Executive Summary (.PDF)</span>
                    <Download size={14} style={{ color: textMuted }} />
                  </button>
                  <button onClick={exportAuditCSV} className="flex items-center justify-between px-6 py-4 rounded-xl text-sm font-bold transition-colors hover:bg-white/5" style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${border}` }}>
                    <span className="flex items-center gap-3" style={{ color: textPrimary }}><List size={16} style={{ color: textMuted }} /> Raw Audit Trail (.CSV)</span>
                    <Download size={14} style={{ color: textMuted }} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CONFIRM MODAL */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300" style={{ background: 'rgba(10,15,29,0.85)', backdropFilter: 'blur(12px)' }}>
          <div className="rounded-3xl p-8 max-w-sm w-full text-center border relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]" style={{ background: cardBg, borderColor: 'rgba(212,175,55,0.4)' }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-[#D4AF37] opacity-10 blur-3xl rounded-full pointer-events-none"></div>
            <AlertTriangle size={40} className="mx-auto mb-5 drop-shadow-lg" style={{ color: '#D4AF37' }} />
            <h3 className="font-display font-bold text-2xl mb-3" style={{ color: textPrimary }}>Authorize Action</h3>
            <p className="text-sm mb-8 leading-relaxed" style={{ color: textMuted }}>{confirmAction.label}</p>
            <div className="flex gap-4">
              <button onClick={() => setConfirmAction(null)} className="flex-1 py-4 rounded-xl text-sm font-bold border transition-colors hover:bg-white/5" style={{ borderColor: border, color: textMuted }}>Abort</button>
              <button onClick={() => { confirmAction.action(); setConfirmAction(null); }} className="flex-1 py-4 rounded-xl text-sm font-bold transition-transform hover:scale-105 shadow-lg" style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C84A)', color: '#0A0F1D' }}>Proceed</button>
            </div>
          </div>
        </div>
      )}

      {/* CANDIDATE REGISTRATION MODAL */}
      {candidateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(10,15,29,0.85)', backdropFilter: 'blur(12px)' }}>
          <div className="relative rounded-3xl p-8 w-full max-w-2xl border my-8 shadow-2xl" style={{ background: cardBg, borderColor: border }}>
            <button className="absolute top-6 right-6 p-2 rounded-full transition-colors hover:bg-white/5" onClick={() => setCandidateModal(null)} style={{ color: textMuted }}><X size={20} /></button>

            <div className="flex items-center gap-4 mb-8 border-b pb-6" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <div className="p-3 rounded-xl" style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37' }}>
                {candidateModal.mode === 'add' ? <Plus size={24} /> : <Pencil size={24} />}
              </div>
              <div>
                <h3 className="font-display font-bold text-2xl" style={{ color: textPrimary }}>
                  {candidateModal.mode === 'add' ? 'Register Candidate' : 'Modify Dossier'}
                </h3>
                <p className="text-xs font-mono mt-1" style={{ color: textMuted }}>System DB Entry</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              <Field label="Full Name">
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Official identity" />
              </Field>
              <Field label="Alias / Nickname">
                <input value={form.nickname} onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Display moniker" />
              </Field>

              <Field label="Electoral Category">
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))} className={inputCls} style={inputStyle}>
                  <option value="king">King (Male Lead)</option>
                  <option value="queen">Queen (Female Lead)</option>
                  <option value="style">Best Style (Female)</option>
                  <option value="smart">Smartest (Male)</option>
                  <option value="popular_man">Popular Man (Male)</option>
                  <option value="popular_woman">Popular Woman (Female)</option>
                </select>
              </Field>

              <Field label="Academic Level">
                <input value="First year" readOnly className={inputCls} style={inputStyle} />
              </Field>

              <div className="sm:col-span-2">
                <Field label="Academic Department">
                  <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} className={inputCls} style={inputStyle}>
                    {DEPARTMENTS.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="sm:col-span-2">
                <Field label="Core Strength">
                  <input value={form.talent} onChange={e => setForm(f => ({ ...f, talent: e.target.value }))} className={inputCls} style={inputStyle} placeholder="e.g. Public Speaking" />
                </Field>
              </div>

              <div className="sm:col-span-2">
                <Field label="Portrait Reference URL">
                  <input value={form.photo} onChange={e => setForm(f => ({ ...f, photo: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Secure image link (https://...)" />
                </Field>
                {form.photo && (
                  <div className="mt-4 p-2 rounded-xl inline-block backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${border}` }}>
                    <img src={form.photo} alt="Verification Preview" className="w-16 h-16 rounded-lg object-cover border" style={{ borderColor: CATEGORY_META[form.category].color }} />
                  </div>
                )}
              </div>

              <div className="sm:col-span-2">
                <Field label="Candidate Biography">
                  <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} className={`${inputCls} resize-none`} style={{ ...inputStyle, height: 100 }} placeholder="Background details..." />
                </Field>
              </div>
            </div>

            <div className="flex gap-4 mt-8 pt-6 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <button onClick={() => setCandidateModal(null)} className="flex-1 py-4 rounded-xl text-sm font-bold border transition-colors hover:bg-white/5" style={{ borderColor: border, color: textMuted }}>Discard</button>
              <button onClick={saveCandidate} className="flex-1 py-4 rounded-xl text-sm font-bold transition-transform hover:scale-105 shadow-lg" style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C84A)', color: '#0A0F1D' }}>
                {candidateModal.mode === 'add' ? 'Commit to Registry' : 'Update Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}