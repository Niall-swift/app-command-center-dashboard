import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface AceternityPageHeaderProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Cohesive Aceternity-styled hero header with subtle radial beam + dot texture,
 * crisp hierarchy, and responsive action slot.
 */
export const AceternityPageHeader: React.FC<AceternityPageHeaderProps> = ({
  eyebrow,
  title,
  subtitle,
  icon,
  badge,
  actions,
  className,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border/80 bg-card/90 p-5 md:p-6 backdrop-blur-xl',
        'shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.12)]',
        'dark:shadow-[0_1px_2px_rgba(0,0,0,0.45),0_16px_36px_-18px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.06)]',
        className
      )}
    >
      {/* Subtle Aceternity radial light beam & dot matrix */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70 dark:opacity-100"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 65% 90% at 15% -20%, rgba(59,130,246,0.14), transparent 65%), radial-gradient(ellipse 45% 75% at 88% -25%, rgba(139,92,246,0.12), transparent 60%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-primary/50 to-transparent"
      />

      <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3.5 min-w-0">
          {icon && (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-blue-600/25 ring-1 ring-white/20">
              {icon}
            </div>
          )}
          <div className="min-w-0 space-y-1">
            {(eyebrow || badge) && (
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {eyebrow}
                {badge}
              </div>
            )}
            <h1 className="text-xl sm:text-2xl md:text-[26px] font-black tracking-tight text-foreground leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
    </motion.div>
  );
};

export interface AceternityEmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export const AceternityEmptyState: React.FC<AceternityEmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-dashed border-border/90 bg-card/60 px-6 py-12 text-center',
        className
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.08),transparent_65%)]"
      />
      <div className="relative z-10 mx-auto flex max-w-md flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
          {icon}
        </div>
        <h3 className="text-base font-bold text-foreground">{title}</h3>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{description}</p>
        {action && <div className="pt-2">{action}</div>}
      </div>
    </div>
  );
};
