import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface AnimatedTabOption<T extends string = string> {
  readonly id: T;
  label: string;
  icon?: React.ReactNode;
  badge?: number | string;
  badgeTone?: 'default' | 'danger' | 'success' | 'warning';
}

export interface AnimatedTabsProps<T extends string> {
  tabs: ReadonlyArray<AnimatedTabOption<NoInfer<T>>>;
  activeTab: T;
  onChange: (id: NoInfer<T>) => void;
  layoutId: string;
  className?: string;
  size?: 'sm' | 'md';
}

const BADGE_CLASSES: Record<NonNullable<AnimatedTabOption['badgeTone']>, string> = {
  default: 'bg-primary/12 text-primary',
  danger: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
};

/**
 * Aceternity-style spring-animated Tabs using Framer Motion layoutId.
 */
export function AnimatedTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
  layoutId,
  className,
  size = 'md',
}: AnimatedTabsProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border border-border/75 bg-muted/60 p-1 backdrop-blur-md no-scrollbar',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        const showBadge =
          tab.badge !== undefined && tab.badge !== null && tab.badge !== '' && tab.badge !== 0;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative inline-flex shrink-0 items-center gap-2 rounded-xl font-semibold transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-xs sm:text-sm',
              isActive
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground/90'
            )}
          >
            {isActive && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: 'spring', bounce: 0.2, duration: 0.42 }}
                className="absolute inset-0 rounded-xl bg-background border border-border/80 shadow-[0_1px_3px_rgba(15,23,42,0.08)] dark:bg-card dark:border-white/10 dark:shadow-[0_2px_10px_rgba(0,0,0,0.45)]"
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-2">
              {tab.icon}
              <span>{tab.label}</span>
              {showBadge && (
                <span
                  className={cn(
                    'inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none tabular-nums',
                    BADGE_CLASSES[tab.badgeTone || 'default']
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
