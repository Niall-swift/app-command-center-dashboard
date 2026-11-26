import React from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  Bot,
  CreditCard,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  MessageSquare,
  Radio,
  Tag,
  User,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  CHAT_SIDEBAR_WIDGETS,
  type ChatSidebarWidgetId,
} from '@/hooks/useChatSidebarLayout';

const WIDGET_ICONS: Record<ChatSidebarWidgetId, React.ComponentType<{ className?: string }>> = {
  josue_ai: Bot,
  tags_csat: Tag,
  smartolt: Radio,
  ispfy_client: User,
  ispfy_contracts: FileText,
  ispfy_finance: CreditCard,
  attendant: UserCheck,
  quick_replies: MessageSquare,
};

interface SortableSidebarCardProps {
  id: ChatSidebarWidgetId;
  index: number;
  totalCount: number;
  isEditing: boolean;
  isHidden: boolean;
  onMove: (id: ChatSidebarWidgetId, direction: 'up' | 'down') => void;
  onToggleHidden: (id: ChatSidebarWidgetId) => void;
  children: React.ReactNode;
}

const SortableSidebarCardInner: React.FC<SortableSidebarCardProps> = ({
  id,
  index,
  totalCount,
  isEditing,
  isHidden,
  onMove,
  onToggleHidden,
  children,
}) => {
  const dragControls = useDragControls();
  const meta = CHAT_SIDEBAR_WIDGETS[id];
  const Icon = WIDGET_ICONS[id];

  // Quando não está em modo edição e o bloco está oculto, mantém montado oculto (zero re-fetch)
  if (!isEditing && isHidden) {
    return (
      <Reorder.Item
        value={id}
        dragListener={false}
        className="hidden"
        aria-hidden="true"
      >
        {children}
      </Reorder.Item>
    );
  }

  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={dragControls}
      layout="position"
      transition={{ type: 'spring', stiffness: 520, damping: 38 }}
      whileDrag={{
        scale: 1.02,
        zIndex: 40,
        boxShadow: '0 14px 34px -8px rgba(0, 0, 0, 0.35)',
      }}
      className="relative group/widget list-none select-none"
    >
      {isEditing ? (
        <div
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('button')) return;
            dragControls.start(e);
          }}
          className={`flex items-center gap-2 p-2.5 rounded-xl border transition-colors cursor-grab active:cursor-grabbing ${
            isHidden
              ? 'bg-muted/40 border-dashed border-border/70 opacity-60'
              : 'bg-card border-primary/35 shadow-sm hover:border-primary/60'
          }`}
        >
          <div
            className="text-muted-foreground hover:text-foreground shrink-0 touch-none"
            title="Arraste para reordenar"
          >
            <GripVertical className="w-4 h-4" />
          </div>

          <span
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${meta.accentClass}`}
          >
            <Icon className="w-3.5 h-3.5" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono font-bold text-muted-foreground">
                #{index + 1}
              </span>
              <p className="text-xs font-bold text-foreground truncate">{meta.label}</p>
            </div>
            <p className="text-[10px] text-muted-foreground truncate">{meta.description}</p>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={index === 0}
              onClick={() => onMove(id, 'up')}
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              title="Mover para cima"
            >
              <ArrowUp className="w-3 h-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={index === totalCount - 1}
              onClick={() => onMove(id, 'down')}
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              title="Mover para baixo"
            >
              <ArrowDown className="w-3 h-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onToggleHidden(id)}
              className={`h-6 w-6 ${
                isHidden
                  ? 'text-muted-foreground hover:text-foreground'
                  : 'text-primary hover:bg-primary/10'
              }`}
              title={isHidden ? 'Mostrar este bloco' : 'Ocultar este bloco'}
            >
              {isHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </Button>
          </div>
        </div>
      ) : (
        /* Alça discreta no topo para arrastar direto sem precisar entrar no modo Organizar */
        <button
          type="button"
          onPointerDown={(e) => dragControls.start(e)}
          title={`Arraste para mover "${meta.label}"`}
          className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 h-4 px-2 rounded-full bg-popover/95 border border-border shadow-sm text-muted-foreground hover:text-primary hover:border-primary/50 flex items-center justify-center opacity-0 group-hover/widget:opacity-100 focus:opacity-100 transition-opacity cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="w-3 h-3 rotate-90" />
        </button>
      )}

      {/* Mantém o conteúdo montado durante a edição para evitar re-consultas ao ISPFY/SmartOLT */}
      <div className={isEditing ? 'hidden' : 'select-text'}>{children}</div>
    </Reorder.Item>
  );
};

export const SortableSidebarCard = React.memo(SortableSidebarCardInner);
