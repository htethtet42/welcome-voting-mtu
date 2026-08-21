export type Category = 'king' | 'queen' | 'style' | 'smart' | 'popular_man' | 'popular_woman';
export type ElectionStatus = 'scheduled' | 'open' | 'closed' | 'published';
export type UserRole = 'voter' | 'admin';

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