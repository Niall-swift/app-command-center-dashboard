import React from 'react';
import { cn } from '@/lib/utils';
import { SpotlightCard, type SpotlightTone } from './spotlight-card';

export interface BentoGridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: 2 | 3 | 4;
}

export const BentoGrid: React.FC<BentoGridProps> = ({
  children,
  className,
  cols = 4,
  ...props
}) => {
  const colsClass =
    cols === 2
      ? 'grid-cols-1 md:grid-cols-2'
      : cols === 3
      ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
      : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4';

  return (
    <div className={cn('grid gap-4', colsClass, className)} {...props}>
      {children}
    </div>
  );
};

export interface BentoMetricCardProps {
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  tone?: SpotlightTone;
  className?: string;
  onClick?: () => void;
  footer?: React.ReactNode;
}

const ICON_SURFACE: Record<SpotlightTone, string> = {
  primary: 'bg-blue-500/12 text-blue-600 dark:text-blue-400 ring-blue-500/20',
  blue: 'bg-blue-500/12 text-blue-600 dark:text-blue-400 ring-blue-500/20',
  emerald: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20',
  amber: 'bg-amber-500/12 text-amber-600 dark:text-amber-400 ring-amber-500/20',
  violet: 'bg-violet-500/12 text-violet-600 dark:text-violet-400 ring-violet-500/20',
  rose: 'bg-rose-500/12 text-rose-600 dark:text-rose-400 ring-rose-500/20',
  cyan: 'bg-cyan-500/12 text-cyan-600 dark:text-cyan-400 ring-cyan-500/20',
};

export const BentoMetricCard: React.FC<BentoMetricCardProps> = ({
  label,
  value,
  sublabel,
  icon,
  badge,
  tone = 'blue',
  className,
  onClick,
  footer,
}) => {
  return (
    <SpotlightCard
      tone={tone}
      showTopBeam
      onClick={onClick}
      className={cn(
        'p-5',
        onClick && 'cursor-pointer hover:-translate-y-0.5 active:translate-y-0',
        className
      )}
    >
      <div className="flex h-full flex-col justify-between gap-3">
        <div className="flex items-start justify-between gap-3">
          {icon ? (
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1',
                ICON_SURFACE[tone]
              )}
            >
              {icon}
            </div>
          ) : (
            <span />
          )}
          {badge && <div className="shrink-0">{badge}</div>}
        </div>

        <div className="space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <div className="text-2xl font-black tracking-tight text-foreground tabular-nums leading-tight">
            {value}
          </div>
          {sublabel && (
            <div className="text-xs font-medium text-muted-foreground leading-snug">
              {sublabel}
            </div>
          )}
        </div>

        {footer && (
          <div className="pt-2 border-t border-border/60 text-xs text-muted-foreground">
            {footer}
          </div>
        )}
      </div>
    </SpotlightCard>
  );
};
