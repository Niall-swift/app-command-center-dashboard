
// Estrutura completa do banco de dados Firebase para o projeto
export interface FirebaseCollections {
  // ========== COLEÇÃO PRINCIPAL: USERS ==========
  users: {
    uid: string;
    name: string;
    email: string;
    phone: string;
    cpf: string;
    address: {
      street: string;
      number: string;
      complement?: string;
      neighborhood: string;
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
    isAdmin: boolean;
    plan?: {
      id: string;
      name: string;
      speed: string;
      uploadSpeed: string;
      price: number;
      installedAt?: Date;
    };
    notifications: {
      email: boolean;
      sms: boolean;
      whatsapp: boolean;
      push: boolean;
    };
    
    // SUBCOLEÇÃO: user_sessions
    sessions?: {
      [sessionId: string]: {
        id: string;
        deviceInfo: string;
        ipAddress: string;
        userAgent: string;
        loginTime: Date;
        lastActivity: Date;
        isActive: boolean;
      };
    };
    
    // SUBCOLEÇÃO: user_payments
    payments?: {
      [paymentId: string]: {
        id: string;
        amount: number;
        method: 'credit_card' | 'debit_card' | 'pix' | 'boleto' | 'cash';
        status: 'pending' | 'paid' | 'overdue' | 'cancelled';
        dueDate: Date;
        paidAt?: Date;
        description: string;
        referenceMonth: string; // "2024-01"
        createdAt: Date;
      };
    };
    
    // SUBCOLEÇÃO: user_equipment
    equipment?: {
      [equipmentId: string]: {
        id: string;
        type: 'router' | 'modem' | 'onu' | 'switch' | 'access_point';
        brand: string;
        model: string;
        serialNumber: string;
        macAddress: string;
        installDate: Date;
        status: 'active' | 'inactive' | 'maintenance' | 'replaced';
        location: string; // onde está instalado na casa do cliente
      };
    };
  };

  // ========== COLEÇÃO PRINCIPAL: CHAT_ROOMS ==========
  chatRooms: {
    id: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    lastMessage: string;
    lastMessageTime: Date;
    unreadCount: number;
    isActive: boolean;
    createdAt: Date;
    assignedAgent?: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    tags: string[]; // para categorizar conversas
    
    // SUBCOLEÇÃO: messages
    messages?: {
      [messageId: string]: {
        id: string;
        content: string;
        timestamp: Date;
        senderId: string;
        senderName: string;
        senderAvatar?: string;
        isAdmin: boolean;
        isRead: boolean;
        messageType: 'text' | 'image' | 'file' | 'audio' | 'system';
        fileUrl?: string;
        fileName?: string;
        fileSize?: number;
        replyTo?: string; // ID da mensagem que está respondendo
        reactions?: {
          [userId: string]: string; // emoji
        };
      };
    };
    
    // SUBCOLEÇÃO: chat_events
    events?: {
      [eventId: string]: {
        id: string;
        type: 'user_joined' | 'user_left' | 'agent_assigned' | 'priority_changed' | 'chat_closed';
        description: string;
        timestamp: Date;
        performedBy: string;
        metadata?: Record<string, any>;
      };
    };
  };

  // ========== COLEÇÃO PRINCIPAL: REQUESTS ==========
  requests: {
    id: string;
    userId: string;
    requestType: 'new_plan' | 'plan_change' | 'plan_cancellation' | 'technical_support' | 'billing_issue';
    title: string;
    description: string;
    status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'completed';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    
    // Dados específicos para solicitação de plano
    planDetails?: {
      planId: string;
      planName: string;
      speed: string;
      price: number;
      installationAddress: string;
      preferredInstallDate?: Date;
    };
    
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
    attachments?: string[]; // URLs dos arquivos anexados
    
    // SUBCOLEÇÃO: request_history
    history?: {
      [historyId: string]: {
        id: string;
        action: 'created' | 'status_changed' | 'assigned' | 'note_added' | 'completed';
        oldValue?: string;
        newValue?: string;
        note?: string;
        performedBy: string;
        performedAt: Date;
      };
    };
    
    // SUBCOLEÇÃO: request_documents
    documents?: {
      [docId: string]: {
        id: string;
        name: string;
        type: 'cpf' | 'rg' | 'address_proof' | 'income_proof' | 'contract' | 'other';
        url: string;
        uploadedAt: Date;
        uploadedBy: string;
        verified: boolean;
        verifiedBy?: string;
        verifiedAt?: Date;
      };
    };
  };

  // ========== COLEÇÃO PRINCIPAL: TECHNICAL_CALLS ==========
  technicalCalls: {
    id: string;
    userId?: string;
    clientName: string;
    clientPhone: string;
    clientEmail?: string;
    address: {
      street: string;
      number: string;
      complement?: string;
      neighborhood: string;
      city: string;
      state: string;
      zipCode: string;
      coordinates?: {
        lat: number;
        lng: number;
      };
    };
    problemDescription: string;
    problemType: 'no_internet' | 'slow_internet' | 'intermittent_connection' | 'equipment_issue' | 'installation' | 'other';
    status: 'pending' | 'assigned' | 'in_progress' | 'resolved' | 'cancelled';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    createdAt: Date;
    updatedAt: Date;
    
    // Dados do técnico
    assignedTechnician?: {
      id: string;
      name: string;
      phone: string;
      specialty: string[];
    };
    
    estimatedTime?: number; // em minutos
    scheduledFor?: Date;
    resolution?: string;
    completedAt?: Date;
    customerRating?: number; // 1-5
    customerFeedback?: string;
    
    // SUBCOLEÇÃO: call_updates
    updates?: {
      [updateId: string]: {
        id: string;
        type: 'status_change' | 'assignment' | 'progress_update' | 'completion' | 'cancellation';
        description: string;
        timestamp: Date;
        performedBy: string;
        location?: {
          lat: number;
          lng: number;
        };
        photos?: string[]; // URLs das fotos
      };
    };
    
    // SUBCOLEÇÃO: call_equipment
    equipmentUsed?: {
      [equipmentId: string]: {
        id: string;
        type: string;
        serialNumber: string;
        action: 'installed' | 'replaced' | 'removed' | 'configured';
        timestamp: Date;
        technicianId: string;
      };
    };
  };

  // ========== COLEÇÃO PRINCIPAL: TECHNICIANS ==========
  technicians: {
    id: string;
    name: string;
    phone: string;
    email: string;
    cpf: string;
    specialties: string[]; // ['fiber_optic', 'wifi', 'equipment_repair', 'installation']
    isAvailable: boolean;
    currentLocation?: {
      lat: number;
      lng: number;
      updatedAt: Date;
    };
    workingHours: {
      start: string; // "08:00"
      end: string; // "18:00"
      days: string[]; // ['monday', 'tuesday', ...]
    };
    currentCalls: number;
    maxCalls: number;
    rating: number;
    totalCallsCompleted: number;
    createdAt: Date;
    lastActivity: Date;
    
    // SUBCOLEÇÃO: technician_schedule
    schedule?: {
      [scheduleId: string]: {
        id: string;
        date: Date;
        startTime: string;
        endTime: string;
        callId?: string;
        type: 'available' | 'busy' | 'break' | 'unavailable';
        notes?: string;
      };
    };
    
    // SUBCOLEÇÃO: technician_equipment
    equipment?: {
      [equipmentId: string]: {
        id: string;
        name: string;
        type: string;
        serialNumber?: string;
        assignedAt: Date;
        status: 'assigned' | 'in_use' | 'maintenance' | 'returned';
      };
    };
  };

  // ========== COLEÇÃO PRINCIPAL: PLANS ==========
  plans: {
    id: string;
    name: string;
    speed: string; // "100 Mbps"
    uploadSpeed: string; // "50 Mbps"
    price: number;
    installationFee: number;
    description: string;
    features: string[];
    technology: 'fiber' | 'cable' | 'wireless' | 'hybrid';
    isActive: boolean;
    isPromotional: boolean;
    promotionalPrice?: number;
    promotionalUntil?: Date;
    contractMinimumMonths: number;
    createdAt: Date;
    updatedAt: Date;
    
    // SUBCOLEÇÃO: plan_coverage
    coverage?: {
      [coverageId: string]: {
        id: string;
        city: string;
        state: string;
        neighborhoods: string[];
        isActive: boolean;
        installationTime: number; // dias úteis
        additionalFees?: number;
      };
    };
  };

  // ========== COLEÇÃO PRINCIPAL: BOTS ==========
  bots: {
    id: string;
    name: string;
    description: string;
    status: 'active' | 'inactive' | 'testing';
    type: 'welcome' | 'support' | 'sales' | 'billing' | 'technical';
    triggers: string[]; // palavras-chave que ativam o bot
    isDefault: boolean;
    priority: number; // ordem de execução
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    
    // SUBCOLEÇÃO: bot_responses
    responses?: {
      [responseId: string]: {
        id: string;
        trigger: string;
        message: string;
        attachments?: string[];
        actions?: {
          type: 'transfer_to_human' | 'create_ticket' | 'schedule_call' | 'send_email';
          data?: Record<string, any>;
        }[];
        conditions?: {
          userType?: 'new' | 'existing' | 'premium';
          timeOfDay?: 'business_hours' | 'after_hours';
          dayOfWeek?: string[];
        };
      };
    };
    
    // SUBCOLEÇÃO: bot_analytics
    analytics?: {
      [analyticsId: string]: {
        id: string;
        date: Date;
        totalInteractions: number;
        successfulResponses: number;
        transfersToHuman: number;
        mostUsedTriggers: string[];
        averageResponseTime: number;
      };
    };
  };

  // ========== COLEÇÃO PRINCIPAL: RAFFLE_CLIENTS ==========
  raffleClients: {
    id: string;
    name: string;
    username: string; // @username no telegram/whatsapp
    avatar: string;
    phone: string;
    email?: string;
    telegramId?: string;
    whatsappId?: string;
    isActive: boolean;
    joinedAt: Date;
    lastActivity: Date;
    totalParticipations: number;
    wins: number;
    
    // SUBCOLEÇÃO: client_participations
    participations?: {
      [participationId: string]: {
        id: string;
        raffleId: string;
        participatedAt: Date;
        won: boolean;
        prize?: string;
      };
    };
  };

  // ========== COLEÇÃO PRINCIPAL: RAFFLES ==========
  raffles: {
    id: string;
    prizeName: string;
    prizeDescription: string;
    prizeValue?: number;
    prizeImageUrl?: string;
    winnerId: string;
    winnerName: string;
    winnerUsername: string;
    winnerAvatar: string;
    participantsCount: number;
    eligibleParticipants: string[]; // IDs dos clientes elegíveis
    createdAt: Date;
    conductedAt: Date;
    conductedBy: string;
    cardImageUrl?: string; // URL da imagem do card gerado
    status: 'draft' | 'active' | 'completed' | 'cancelled';
    
    // SUBCOLEÇÃO: raffle_participants
    participants?: {
      [participantId: string]: {
        id: string;
        clientId: string;
        clientName: string;
        joinedAt: Date;
        eligible: boolean;
        reason?: string; // motivo se não elegível
      };
    };
  };

  // ========== COLEÇÃO PRINCIPAL: NOTIFICATIONS ==========
  notifications: {
    id: string;
    userId?: string; // se null, é notificação global
    title: string;
    message: string;
    type: 'info' | 'warning' | 'error' | 'success' | 'maintenance';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    isRead: boolean;
    createdAt: Date;
    expiresAt?: Date;
    actionUrl?: string;
    actionLabel?: string;
    channels: ('email' | 'sms' | 'push' | 'whatsapp')[];
    sentChannels: ('email' | 'sms' | 'push' | 'whatsapp')[];
  };

  // ========== COLEÇÃO PRINCIPAL: ANALYTICS ==========
  analytics: {
    id: string;
    date: Date;
    type: 'daily' | 'weekly' | 'monthly';
    
    // Métricas de usuários
    users: {
      total: number;
      active: number;
      new: number;
      churned: number;
    };
    
    // Métricas de solicitações
    requests: {
      total: number;
      approved: number;
      rejected: number;
      pending: number;
      byType: Record<string, number>;
    };
    
    // Métricas de suporte técnico
    technicalSupport: {
      totalCalls: number;
      resolvedCalls: number;
      pendingCalls: number;
      avgResolutionTime: number; // em minutos
      customerSatisfactionAvg: number; // 1-5
      callsByType: Record<string, number>;
    };
    
    // Métricas de chat
    chat: {
      totalMessages: number;
      totalConversations: number;
      avgResponseTime: number; // em minutos
      botInteractions: number;
      humanTransfers: number;
    };
    
    // Métricas de receita
    revenue: {
      totalRevenue: number;
      newSubscriptions: number;
      canceledSubscriptions: number;
      averageTicket: number;
      paymentMethods: Record<string, number>;
    };
  };

  // ========== COLEÇÃO PRINCIPAL: SETTINGS ==========
  settings: {
    id: string;
    category: 'general' | 'notifications' | 'integrations' | 'security' | 'appearance';
    
    // Configurações do WhatsApp
    whatsapp?: {
      groupId: string; // ID do grupo de técnicos
      apiKey?: string;
      webhookUrl?: string;
      enableNotifications: boolean;
    };
    
    // Configurações do IXCSoft
    ixcsoft?: {
      apiKey: string;
      baseUrl: string;
      enableAutoSync: boolean;
      syncInterval: number; // em minutos
    };
    
    // Configurações de notificações
    notifications?: {
      email: {
        enabled: boolean;
        smtpServer?: string;
        smtpPort?: number;
        username?: string;
        fromAddress?: string;
      };
      sms: {
        enabled: boolean;
        provider?: 'twilio' | 'zenvia' | 'totalvoice';
        apiKey?: string;
      };
      push: {
        enabled: boolean;
        firebaseServerKey?: string;
      };
    };
    
    // Configurações gerais
    general?: {
      companyName: string;
      companyLogo?: string;
      supportEmail: string;
      supportPhone: string;
      workingHours: {
        start: string;
        end: string;
        days: string[];
      };
      timezone: string;
      currency: string;
    };
    
    updatedAt: Date;
    updatedBy: string;
  };

  // ========== COLEÇÃO PRINCIPAL: AUDIT_LOGS ==========
  auditLogs: {
    id: string;
    userId: string;
    userName: string;
    action: string; // 'create', 'update', 'delete', 'login', 'logout', etc.
    resource: string; // 'user', 'request', 'technical_call', etc.
    resourceId?: string;
    oldValues?: Record<string, any>;
    newValues?: Record<string, any>;
    ipAddress: string;
    userAgent: string;
    timestamp: Date;
    success: boolean;
    errorMessage?: string;
  };
}

// Regras de segurança detalhadas para Firestore
export const firestoreSecurityRules = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Função para verificar se o usuário é admin
    function isAdmin() {
      return request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
    
    // Função para verificar se é o próprio usuário
    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }
    
    // ========== USERS ==========
    match /users/{userId} {
      allow read, write: if isOwner(userId) || isAdmin();
      
      // Subcoleções do usuário
      match /sessions/{sessionId} {
        allow read, write: if isOwner(userId) || isAdmin();
      }
      match /payments/{paymentId} {
        allow read, write: if isOwner(userId) || isAdmin();
      }
      match /equipment/{equipmentId} {
        allow read, write: if isOwner(userId) || isAdmin();
      }
    }
    
    // ========== CHAT_ROOMS ==========
    match /chatRooms/{roomId} {
      allow read, write: if request.auth != null && 
        (resource.data.userId == request.auth.uid || isAdmin());
      
      match /messages/{messageId} {
        allow read: if request.auth != null;
        allow create: if request.auth != null;
        allow update, delete: if request.auth != null && 
          (resource.data.senderId == request.auth.uid || isAdmin());
      }
      
      match /events/{eventId} {
        allow read: if request.auth != null;
        allow write: if isAdmin();
      }
    }
    
    // ========== REQUESTS ==========
    match /requests/{requestId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if isAdmin();
      
      match /history/{historyId} {
        allow read: if request.auth != null;
        allow write: if isAdmin();
      }
      
      match /documents/{docId} {
        allow read, write: if request.auth != null && 
          (resource.data.uploadedBy == request.auth.uid || isAdmin());
      }
    }
    
    // ========== TECHNICAL_CALLS ==========
    match /technicalCalls/{callId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if isAdmin();
      
      match /updates/{updateId} {
        allow read: if request.auth != null;
        allow write: if isAdmin();
      }
      
      match /equipmentUsed/{equipmentId} {
        allow read: if request.auth != null;
        allow write: if isAdmin();
      }
    }
    
    // ========== TECHNICIANS ==========
    match /technicians/{techId} {
      allow read, write: if isAdmin();
      
      match /schedule/{scheduleId} {
        allow read, write: if isAdmin();
      }
      
      match /equipment/{equipmentId} {
        allow read, write: if isAdmin();
      }
    }
    
    // ========== PLANS ==========
    match /plans/{planId} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
      
      match /coverage/{coverageId} {
        allow read: if request.auth != null;
        allow write: if isAdmin();
      }
    }
    
    // ========== BOTS ==========
    match /bots/{botId} {
      allow read, write: if isAdmin();
      
      match /responses/{responseId} {
        allow read, write: if isAdmin();
      }
      
      match /analytics/{analyticsId} {
        allow read, write: if isAdmin();
      }
    }
    
    // ========== RAFFLE_CLIENTS ==========
    match /raffleClients/{clientId} {
      allow read, write: if isAdmin();
      
      match /participations/{participationId} {
        allow read, write: if isAdmin();
      }
    }
    
    // ========== RAFFLES ==========
    match /raffles/{raffleId} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
      
      match /participants/{participantId} {
        allow read: if request.auth != null;
        allow write: if isAdmin();
      }
    }
    
    // ========== NOTIFICATIONS ==========
    match /notifications/{notificationId} {
      allow read: if request.auth != null && 
        (resource.data.userId == request.auth.uid || resource.data.userId == null || isAdmin());
      allow write: if isAdmin();
    }
    
    // ========== ANALYTICS ==========
    match /analytics/{analyticsId} {
      allow read, write: if isAdmin();
    }
    
    // ========== SETTINGS ==========
    match /settings/{settingId} {
      allow read, write: if isAdmin();
    }
    
    // ========== AUDIT_LOGS ==========
    match /auditLogs/{logId} {
      allow read: if isAdmin();
      allow create: if request.auth != null;
    }
  }
}
`;

// Índices compostos necessários para Firestore
export const firestoreIndexes = [
  // Mensagens por sala de chat ordenadas por timestamp
  {
    collectionGroup: 'messages',
    fields: [
      { field: 'chatRoomId', order: 'ascending' },
      { field: 'timestamp', order: 'descending' }
    ]
  },
  
  // Chamados técnicos por status e prioridade
  {
    collection: 'technicalCalls',
    fields: [
      { field: 'status', order: 'ascending' },
      { field: 'priority', order: 'ascending' },
      { field: 'createdAt', order: 'descending' }
    ]
  },
  
  // Solicitações por status e data
  {
    collection: 'requests',
    fields: [
      { field: 'status', order: 'ascending' },
      { field: 'createdAt', order: 'descending' }
    ]
  },
  
  // Solicitações por tipo e status
  {
    collection: 'requests',
    fields: [
      { field: 'requestType', order: 'ascending' },
      { field: 'status', order: 'ascending' },
      { field: 'createdAt', order: 'descending' }
    ]
  },
  
  // Analytics por data
  {
    collection: 'analytics',
    fields: [
      { field: 'type', order: 'ascending' },
      { field: 'date', order: 'descending' }
    ]
  },
  
  // Técnicos disponíveis por especialidade
  {
    collection: 'technicians',
    fields: [
      { field: 'isAvailable', order: 'ascending' },
      { field: 'specialties', order: 'ascending' },
      { field: 'currentCalls', order: 'ascending' }
    ]
  },
  
  // Notificações por usuário e data
  {
    collection: 'notifications',
    fields: [
      { field: 'userId', order: 'ascending' },
      { field: 'isRead', order: 'ascending' },
      { field: 'createdAt', order: 'descending' }
    ]
  },
  
  // Audit logs por usuário e data
  {
    collection: 'auditLogs',
    fields: [
      { field: 'userId', order: 'ascending' },
      { field: 'timestamp', order: 'descending' }
    ]
  },
  
  // Audit logs por recurso e ação
  {
    collection: 'auditLogs',
    fields: [
      { field: 'resource', order: 'ascending' },
      { field: 'action', order: 'ascending' },
      { field: 'timestamp', order: 'descending' }
    ]
  }
];

// Funções utilitárias para trabalhar com o Firebase
export const firebaseUtils = {
  // Converter timestamp do Firebase para Date
  timestampToDate: (timestamp: any): Date => {
    if (timestamp?.toDate) {
      return timestamp.toDate();
    }
    return new Date(timestamp);
  },
  
  // Converter Date para timestamp do Firebase
  dateToTimestamp: (date: Date) => {
    return date;
  },
  
  // Gerar ID único para documentos
  generateId: (): string => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },
  
  // Validar estrutura de endereço
  validateAddress: (address: any): boolean => {
    return !!(address?.street && address?.city && address?.state && address?.zipCode);
  },
  
  // Sanitizar dados do usuário antes de salvar
  sanitizeUserData: (userData: any) => {
    return {
      ...userData,
      cpf: userData.cpf?.replace(/\D/g, ''),
      phone: userData.phone?.replace(/\D/g, ''),
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      isAdmin: false
    };
  }
};
