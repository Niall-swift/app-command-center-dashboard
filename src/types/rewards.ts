export interface Reward {
  id: string;
  name: string;
  description: string;
  icon: string;
  imageUrl?: string;
  pointsCost: number;
  type: 'discount' | 'upgrade' | 'credit' | 'premium' | 'product';
  value: number;
  active: boolean;
  stock?: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface RedeemedReward {
  id: string;
  userId: string;
  rewardId: string;
  rewardName: string;
  pointsSpent: number;
  status: 'pending' | 'approved' | 'applied' | 'expired';
  code: string;
  redeemedAt: any;
  expiresAt: any;
  appliedAt?: any;
  userEmail?: string; // Campo auxiliar para o admin
  userName?: string; // Campo auxiliar para o admin
}

export interface User {
  uid: string;
  name?: string;
  email?: string;
  points?: number;
}
