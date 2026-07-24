export type Category = 'king' | 'queen' | 'style' | 'smart';
export type ElectionStatus = 'scheduled' | 'open' | 'closed' | 'published';
export type UserRole = 'voter' | 'admin';

export interface Candidate {
  id: string;
  name: string;
  nickname: string;
  department: string;
  year: string;
  category: Category;
  photo: string;
  bio: string;
  talent: string;
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
  studentId: string;
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
  id: string;
  name: string;
  status: ElectionStatus;
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
    color: '#60A5FA',
    bgColor: 'rgba(59,130,246,0.12)',
    borderColor: 'rgba(59,130,246,0.3)',
    gender: 'male',
    icon: '👑',
    description: 'Most outstanding male student of the year',
  },
  queen: {
    label: 'Queen',
    color: '#FF7AAE',
    bgColor: 'rgba(255,77,141,0.12)',
    borderColor: 'rgba(255,77,141,0.3)',
    gender: 'female',
    icon: '♛',
    description: 'Most outstanding female student of the year',
  },
  style: {
    label: 'Best Style',
    color: '#A78BFA',
    bgColor: 'rgba(147,51,234,0.12)',
    borderColor: 'rgba(147,51,234,0.3)',
    gender: 'female',
    icon: '✨',
    description: 'Best dressed — girls nominees only',
  },
  smart: {
    label: 'Smartest',
    color: '#2EDBB8',
    bgColor: 'rgba(0,201,167,0.12)',
    borderColor: 'rgba(0,201,167,0.3)',
    gender: 'male',
    icon: '🎓',
    description: 'Most academically outstanding — boys nominees only',
  },
};
