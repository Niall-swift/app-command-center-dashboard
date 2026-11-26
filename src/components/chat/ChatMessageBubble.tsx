import React from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Message } from '@/types/dashboard';
import { ChatMessageContent } from './ChatMessageContent';

interface ChatMessageBubbleProps {
  message: Message;
  showDayDivider: boolean;
  isGroupedWithPrev: boolean;
  isHighlighted: boolean;
  highlightQuery?: string;
  onExpandImage: (url: string) => void;
  onRetryMessage: (message: Message) => void;
  onReactMessage: (message: Message, emoji: string) => void;
  onReplyMessage: (message: Message) => void;
  onEditMessage: (message: Message, newText: string) => Promise<boolean>;
  onDeleteForEveryone: (message: Message) => Promise<boolean>;
  onScrollToMessage: (messageId: string) => void;
}

function formatDaySeparator(date: Date): string {
  if (isToday(date)) return 'Hoje';
  if (isYesterday(date)) return 'Ontem';
  return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

const ChatMessageBubbleInner: React.FC<ChatMessageBubbleProps> = ({
  message,
  showDayDivider,
  isGroupedWithPrev,
  isHighlighted,
  highlightQuery,
  onExpandImage,
  onRetryMessage,
  onReactMessage,
  onReplyMessage,
  onEditMessage,
  onDeleteForEveryone,
  onScrollToMessage,
}) => {
  return (
    <div style={{ contentVisibility: 'auto', containIntrinsicSize: '72px' }}>
      {showDayDivider && (
        <div className="flex justify-center my-3">
          <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-card/95 border border-border/70 text-muted-foreground shadow-sm">
            {formatDaySeparator(message.timestamp)}
          </span>
        </div>
      )}

      <div
        data-msg-id={message.id}
        className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'} ${
          message.isPrivate ? 'my-2.5' : isGroupedWithPrev ? 'mt-1' : 'mt-3'
        } ${message.reaction ? 'mb-4' : ''}`}
      >
        <div
          className={`max-w-[84%] sm:max-w-[74%] rounded-2xl px-3.5 py-2.5 shadow-sm relative transition-shadow duration-150 ${
            isHighlighted ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-background' : ''
          } ${
            message.isPrivate
              ? 'bg-amber-500/15 border-2 border-amber-500/30 text-amber-600 dark:text-amber-200 rounded-xl mx-auto w-full max-w-[90%] shadow-md'
              : message.fromMe
              ? `bg-primary text-primary-foreground shadow-md shadow-primary/20 ${
                  isGroupedWithPrev ? 'rounded-2xl' : 'rounded-tr-none'
                }`
              : `bg-card text-card-foreground border border-border/80 ${
                  isGroupedWithPrev ? 'rounded-2xl' : 'rounded-tl-none'
                }`
          }`}
        >
          <ChatMessageContent
            message={message}
            highlightQuery={highlightQuery}
            onExpandImage={onExpandImage}
            onRetryMessage={onRetryMessage}
            onReactMessage={onReactMessage}
            onReplyMessage={onReplyMessage}
            onEditMessage={onEditMessage}
            onDeleteForEveryone={onDeleteForEveryone}
            onScrollToMessage={onScrollToMessage}
          />
        </div>
      </div>
    </div>
  );
};

export const ChatMessageBubble = React.memo(
  ChatMessageBubbleInner,
  (prev, next) =>
    prev.message === next.message &&
    prev.showDayDivider === next.showDayDivider &&
    prev.isGroupedWithPrev === next.isGroupedWithPrev &&
    prev.isHighlighted === next.isHighlighted &&
    prev.highlightQuery === next.highlightQuery &&
    prev.onExpandImage === next.onExpandImage &&
    prev.onRetryMessage === next.onRetryMessage &&
    prev.onReactMessage === next.onReactMessage &&
    prev.onReplyMessage === next.onReplyMessage &&
    prev.onEditMessage === next.onEditMessage &&
    prev.onDeleteForEveryone === next.onDeleteForEveryone &&
    prev.onScrollToMessage === next.onScrollToMessage
);
