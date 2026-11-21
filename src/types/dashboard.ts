export interface ChatMediaPayload {
  type: 'image' | 'audio' | 'video' | 'document';
  url: string;
  name?: string;
  mimeType?: string;
  size?: number;
  duration?: number;
}

export interface ReplyToSnapshot {
  id: string;
  zapiMessageId?: string | null;
  user: string;
  content: string;
  mediaType?: 'image' | 'audio' | 'video' | 'document';
}

export interface Message {
  id: string;
  user: string;
  content: string;
  timestamp: Date;
  avatar?: string;
  isAdmin?: boolean;
  mediaType?: 'image' | 'audio' | 'video' | 'document';
  mediaUrl?: string;
  mediaName?: string;
  mediaMimeType?: string;
  mediaSize?: number;
  mediaDuration?: number;
  source?: 'whatsapp' | 'whatsapp_device' | 'app' | 'system' | 'josue_ai';
  isPrivate?: boolean;
  fromMe?: boolean;
  text?: string;
  zapiMessageId?: string | null;
  deliveryStatus?: 'SENDING' | 'SENT' | 'RECEIVED' | 'READ' | 'PLAYED' | 'FAILED';
  deliveryError?: string | null;
  reaction?: string | null;
  edited?: boolean;
  editedAt?: Date | null;
  deletedForEveryone?: boolean;
  replyTo?: ReplyToSnapshot | null;
}

export interface UserDetails {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  cep: string;
  address: string;
  bairro?: string;
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
  address?: string;
  bairro?: string;
  city?: string;
  state?: string;
  instagram?: string;
  source?: 'whatsapp' | 'app';
  tags?: string[];
  aiEnabled?: boolean;
  protocol?: string;
  rouletteEnabled?: boolean;
}
