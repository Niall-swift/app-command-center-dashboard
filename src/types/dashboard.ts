
export interface Message {
  id: string;
  user: string;
  content: string;
  timestamp: Date;
  avatar?: string;
  isAdmin?: boolean;
}

export interface Request {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  user: string;
  createdAt: Date;
  priority: 'low' | 'medium' | 'high';
}

export interface ClientData {
  month: string;
  clients: number;
  active: number;
}

export interface Bot {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  commands: string[];
}
