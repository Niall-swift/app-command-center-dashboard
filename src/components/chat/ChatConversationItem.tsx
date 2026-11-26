import React from 'react';
import { format } from 'date-fns';
import { Bot } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { Client } from '@/types/dashboard';

interface ChatConversationItemProps {
  client: Client;
  isSelected: boolean;
  onSelect: (client: Client) => void;
}

function isAvatarImageUrl(avatar?: string): boolean {
  return Boolean(avatar && /^https?:\/\//i.test(avatar.trim()));
}

const ChatConversationItemInner: React.FC<ChatConversationItemProps> = ({
  client,
  isSelected,
  onSelect,
}) => {
  return (
    <div
      onClick={() => onSelect(client)}
      style={{ contentVisibility: 'auto', containIntrinsicSize: '74px' }}
      className={`p-3 rounded-xl cursor-pointer transition-colors relative overflow-hidden ${
        isSelected
          ? 'bg-primary/12 border border-primary/35 shadow-sm'
          : 'hover:bg-secondary/60 border border-transparent'
      }`}
    >
      {isSelected && (
        <span className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full bg-primary" />
      )}
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <Avatar className="h-11 w-11 border-2 border-border shadow-sm">
            {isAvatarImageUrl(client.avatar) && (
              <AvatarImage
                src={client.avatar}
                alt={client.name}
                loading="lazy"
                decoding="async"
              />
            )}
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
              {client.name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {client.isOnline && (
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-card rounded-full" />
          )}
          {client.aiEnabled && (
            <div
              className="absolute -top-1 -right-1 bg-indigo-600 text-white p-0.5 rounded-full border border-card shadow-sm"
              title="IA Ativa"
            >
              <Bot className="w-2.5 h-2.5" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5 gap-1">
            <h4 className="font-bold text-sm text-foreground truncate flex items-center gap-1.5">
              {client.name}
              {client.source === 'whatsapp' && (
                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-none text-[9px] h-3.5 px-1 font-bold">
                  WA
                </Badge>
              )}
            </h4>
            <span
              className={`text-[10px] shrink-0 font-mono ${
                client.unreadCount > 0
                  ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                  : 'text-muted-foreground'
              }`}
            >
              {format(client.lastMessageTime, 'HH:mm')}
            </span>
          </div>
          <p
            className={`text-xs truncate leading-relaxed ${
              client.unreadCount > 0
                ? 'text-foreground font-medium'
                : 'text-muted-foreground'
            }`}
          >
            {client.lastMessage}
          </p>
          {client.tags && client.tags.length > 0 && (
            <div className="flex gap-1 mt-1.5">
              {client.tags.map((tagId) => (
                <div
                  key={tagId}
                  className={`w-1.5 h-1.5 rounded-full ${
                    tagId === 'suporte'
                      ? 'bg-blue-400'
                      : tagId === 'financeiro'
                      ? 'bg-amber-400'
                      : tagId === 'vendas'
                      ? 'bg-emerald-400'
                      : tagId === 'urgente'
                      ? 'bg-rose-500'
                      : 'bg-muted-foreground'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {client.unreadCount > 0 && (
          <Badge className="bg-emerald-600 text-white border-none h-5 min-w-[20px] justify-center px-1.5 text-[10px] font-bold shadow-sm">
            {client.unreadCount > 99 ? '99+' : client.unreadCount}
          </Badge>
        )}
      </div>
    </div>
  );
};

export const ChatConversationItem = React.memo(
  ChatConversationItemInner,
  (prev, next) =>
    prev.isSelected === next.isSelected &&
    prev.onSelect === next.onSelect &&
    prev.client.id === next.client.id &&
    prev.client.name === next.client.name &&
    prev.client.avatar === next.client.avatar &&
    prev.client.lastMessage === next.client.lastMessage &&
    prev.client.lastMessageTime.getTime() === next.client.lastMessageTime.getTime() &&
    prev.client.unreadCount === next.client.unreadCount &&
    prev.client.isOnline === next.client.isOnline &&
    prev.client.aiEnabled === next.client.aiEnabled &&
    prev.client.source === next.client.source &&
    (prev.client.tags?.join(',') || '') === (next.client.tags?.join(',') || '')
);
