export type Category = 'king' | 'queen' | 'style' | 'smart' | 'popular_man' | 'popular_woman';
export type ElectionStatus = 'scheduled' | 'open' | 'closed' | 'published';
export type UserRole = 'voter' | 'judge' | 'admin';

/** Multipliers an organiser may assign. Mirrors the CHECK constraint in
 *  schema_judges.sql and `allowedJudgeWeights` in backend/judges.go. */
export const JUDGE_WEIGHTS = [3, 5, 10] as const;
export type JudgeWeight = (typeof JUDGE_WEIGHTS)[number];

/** Where a judge access request stands. `pending` is a waiting screen, not a
 *  permission — only an organiser's approval issues a voting session. */
export type JudgeRequestStatus = 'pending' | 'approved' | 'declined';

/** A judge waiting in the organiser's queue. */
export interface PendingJudge {
  token: string;
  /** Short human code (J-07) the judge shows an organiser across a desk. */
  code: string;
  name: string;
  email: string;
  department: string;
  requestedAt: string;
}

/** An approved judge on the roster. `contributed` is summed from the ballots
 *  themselves, so it reflects the weights actually stamped at cast time rather
 *  than the judge's current weight. */
export interface ApprovedJudge {
  email: string;
  name: string;
  weight: number;
  ballots: number;
  contributed: number;
}

export interface Candidate {
  id: string;
  name: string;
  nickname?: string;
  department?: string;
  year?: string;
  category: Category;
  photo?: string;
  photoUrl?: string; // Kept for backwards compatibility
  bio: string;
  talent?: string;
  isActive: boolean;
}

export interface EligibleVoter {
  id: string;
  studentId: string;
  email: string;
  name: string;
  department: string;
  isVerified: boolean;
}

export interface AuthUser {
  id: string;
  studentId?: string;
  email: string;
  name: string;
  role: UserRole;
  /** Ballot multiplier. 1 for students; 3, 5 or 10 for approved judges.
   *  Display only — the server stamps the authoritative weight on the ballot. */
  voteWeight?: number;
}

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  details: string;
  timestamp: Date;
}

/** A persisted ballot lets the admin audit participation by category. */
export interface VoteRecord {
  id: string;
  voterId: string;
  voterName: string;
  voterEmail: string;
  candidateId: string;
  category: Category;
  createdAt: Date;
  /** True when the voter asked not to be identified with this ballot. */
  isAnonymous?: boolean;
}

export interface ElectionState {
  id?: string;
  name?: string;
  status: ElectionStatus;
  type?: 'fresher' | 'major'; // Added to support fresher/major election switching
  opensAt: Date | null;
  closesAt: Date | null;
  publishedAt: Date | null;
}

export interface CategoryMeta {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  gender: 'male' | 'female';
  icon: string;
  description: string;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  king: {
  label: 'King',
  color: '#E5B93F',
  bgColor: 'rgba(229,185,63,0.12)',
  borderColor: 'rgba(229,185,63,0.3)',
  gender: 'male',
  icon: '👑',
  description: 'Most outstanding male student of the year',
},

queen: {
  label: 'Queen',
  color: '#FF7AAE',
  bgColor: 'rgba(255,122,174,0.12)',
  borderColor: 'rgba(255,122,174,0.3)',
  gender: 'female',
  icon: '♛',
  description: 'Most outstanding female student of the year',
},

style: {
  label: 'Best Style',
  color: '#A78BFA',
  bgColor: 'rgba(167,139,250,0.12)',
  borderColor: 'rgba(167,139,250,0.3)',
  gender: 'female',
  icon: '✨',
  description: 'Best dressed — girls nominees only',
},

smart: {
  label: 'Smartest',
  color: '#2EDBB8',
  bgColor: 'rgba(46,219,184,0.12)',
  borderColor: 'rgba(46,219,184,0.3)',
  gender: 'male',
  icon: '🎓',
  description: 'Most academically outstanding — boys nominees only',
},

popular_man: {
  label: 'Mr.Popular',
  color: '#e91111',
  bgColor: 'rgba(245, 59, 59, 0.12)',
  borderColor: 'rgba(175, 8, 8, 0.3)',
  gender: 'male',
  icon: '🤵🏻',
  description: 'Most popular — boys nominees only',
},

popular_woman: {
  label: 'Miss Popular',
  color: '#c93fc9',
  bgColor: 'rgba(164, 48, 182, 0.12)',
  borderColor: 'rgba(202, 13, 231, 0.3)',
  gender: 'female',
  icon: '🌟',
  description: 'Most popular — girls nominees only',
},
};