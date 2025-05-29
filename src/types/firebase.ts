
// Estrutura do banco de dados Firebase para o projeto
export interface FirebaseCollections {
  // Coleção de usuários/clientes
  users: {
    uid: string;
    name: string;
    email: string;
    phone: string;
    cpf: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      coordinates?: {
        lat: number;
        lng: number;
      };
    };
    avatar?: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
    plan?: {
      id: string;
      name: string;
      speed: string;
      price: number;
    };
  };

  // Coleção de mensagens do chat
  messages: {
    id: string;
    userId: string;
    userName: string;
    content: string;
    timestamp: Date;
    avatar?: string;
    isAdmin: boolean;
    isRead: boolean;
    chatRoomId: string;
  };

  // Coleção de salas de chat
  chatRooms: {
    id: string;
    userId: string;
    lastMessage: string;
    lastMessageTime: Date;
    unreadCount: number;
    isActive: boolean;
    createdAt: Date;
  };

  // Coleção de solicitações de planos
  requests: {
    id: string;
    userId: string;
    title: string;
    description: string;
    status: 'pending' | 'approved' | 'rejected';
    priority: 'low' | 'medium' | 'high';
    planType: string;
    planSpeed: string;
    planPrice: number;
    userDetails: {
      name: string;
      email: string;
      phone: string;
      cpf: string;
      address: string;
    };
    createdAt: Date;
    updatedAt: Date;
    processedBy?: string;
    processedAt?: Date;
    notes?: string;
  };

  // Coleção de chamados técnicos
  technicalCalls: {
    id: string;
    userId?: string;
    clientName: string;
    clientPhone: string;
    address: string;
    problemDescription: string;
    status: 'pending' | 'in-progress' | 'resolved' | 'cancelled';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    createdAt: Date;
    updatedAt: Date;
    assignedTechnician?: string;
    technicianId?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
    resolution?: string;
    completedAt?: Date;
    estimatedTime?: number; // em minutos
  };

  // Coleção de bots
  bots: {
    id: string;
    name: string;
    description: string;
    status: 'active' | 'inactive';
    commands: string[];
    responses: Record<string, string>;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    triggers: string[];
    isDefault: boolean;
  };

  // Coleção de clientes para sorteio
  raffleClients: {
    id: string;
    name: string;
    username: string; // @username
    avatar: string;
    phone: string;
    email?: string;
    isActive: boolean;
    joinedAt: Date;
    lastActivity: Date;
    totalParticipations: number;
    wins: number;
  };

  // Coleção de sorteios realizados
  raffles: {
    id: string;
    prizeName: string;
    prizeDescription: string;
    winnerId: string;
    winnerName: string;
    winnerUsername: string;
    winnerAvatar: string;
    participantsCount: number;
    createdAt: Date;
    conductedBy: string;
    cardImageUrl?: string; // URL da imagem do card gerado
  };

  // Coleção de configurações do sistema
  settings: {
    id: string;
    whatsappGroupId: string; // ID do grupo de técnicos
    ixcsoftApiKey: string;
    ixcsoftBaseUrl: string;
    notificationSound: boolean;
    autoAssignTechnicians: boolean;
    defaultPriority: 'low' | 'medium' | 'high';
    updatedAt: Date;
    updatedBy: string;
  };

  // Coleção de técnicos
  technicians: {
    id: string;
    name: string;
    phone: string;
    email: string;
    specialties: string[];
    isAvailable: boolean;
    currentCalls: number;
    maxCalls: number;
    rating: number;
    totalCallsCompleted: number;
    createdAt: Date;
    lastActivity: Date;
  };

  // Coleção de planos disponíveis
  plans: {
    id: string;
    name: string;
    speed: string; // ex: "100 Mbps"
    uploadSpeed: string; // ex: "50 Mbps"
    price: number;
    description: string;
    features: string[];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  };

  // Coleção de analytics/métricas
  analytics: {
    id: string;
    date: Date;
    totalUsers: number;
    activeUsers: number;
    newUsers: number;
    totalRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
    pendingRequests: number;
    totalTechnicalCalls: number;
    resolvedCalls: number;
    pendingCalls: number;
    avgResolutionTime: number; // em minutos
    customerSatisfaction: number; // 1-5
  };
}

// Regras de segurança sugeridas para Firestore
export const firestoreSecurityRules = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Usuários podem ler e editar apenas seus próprios dados
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Mensagens: usuários podem ler e criar, admins podem fazer tudo
    match /messages/{messageId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && 
        (resource.data.userId == request.auth.uid || 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true);
    }
    
    // Salas de chat: usuários podem ler suas próprias salas
    match /chatRooms/{roomId} {
      allow read, write: if request.auth != null && 
        (resource.data.userId == request.auth.uid || 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true);
    }
    
    // Solicitações: usuários podem criar e ler suas próprias, admins podem fazer tudo
    match /requests/{requestId} {
      allow read, create: if request.auth != null;
      allow update, delete: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
    
    // Chamados técnicos: similar às solicitações
    match /technicalCalls/{callId} {
      allow read, create: if request.auth != null;
      allow update, delete: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
    
    // Bots: apenas admins
    match /bots/{botId} {
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
    
    // Clientes do sorteio: apenas admins
    match /raffleClients/{clientId} {
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
    
    // Sorteios: apenas admins podem criar/editar, todos podem ler
    match /raffles/{raffleId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
    
    // Configurações: apenas admins
    match /settings/{settingId} {
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
    
    // Técnicos: apenas admins
    match /technicians/{techId} {
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
    
    // Planos: todos podem ler, apenas admins podem editar
    match /plans/{planId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
    
    // Analytics: apenas admins
    match /analytics/{analyticsId} {
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
  }
}
`;

// Índices sugeridos para Firestore
export const firestoreIndexes = [
  // Para mensagens por sala de chat e timestamp
  {
    collection: 'messages',
    fields: [
      { field: 'chatRoomId', order: 'ascending' },
      { field: 'timestamp', order: 'descending' }
    ]
  },
  // Para chamados técnicos por status e prioridade
  {
    collection: 'technicalCalls',
    fields: [
      { field: 'status', order: 'ascending' },
      { field: 'priority', order: 'ascending' },
      { field: 'createdAt', order: 'descending' }
    ]
  },
  // Para solicitações por status e data
  {
    collection: 'requests',
    fields: [
      { field: 'status', order: 'ascending' },
      { field: 'createdAt', order: 'descending' }
    ]
  },
  // Para analytics por data
  {
    collection: 'analytics',
    fields: [
      { field: 'date', order: 'descending' }
    ]
  }
];
