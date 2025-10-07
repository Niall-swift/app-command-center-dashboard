export interface Message {
  id: string;
  user: string;
  content: string;
  timestamp: Date;
  avatar?: string;
  isAdmin?: boolean;
  mediaType?: 'image' | 'audio';
  mediaUrl?: string;
  mediaName?: string;
}

export interface UserDetails {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  cep: string;
  address: string;
  city: string;
  state: string;
}

export interface Request {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  user: string;
  createdAt: Date;
  priority: 'low' | 'medium' | 'high';
  userDetails: UserDetails;
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

export interface Client {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  isOnline: boolean;
  email?: string;
  phone?: string;
  cpf?: string;
  cep?: string;
}
