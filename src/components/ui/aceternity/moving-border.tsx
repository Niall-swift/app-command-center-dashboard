import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface MovingBorderButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  tone?: 'primary' | 'emerald' | 'amber' | 'violet';
  size?: 'sm' | 'md';
}

const CONIC_GRADIENTS: Record<NonNullable<MovingBorderButtonProps['tone']>, string> = {
  primary: 'conic-gradient(from 90deg at 50% 50%, #3b82f6 0%, #8b5cf6 50%, #3b82f6 100%)',
  emerald: 'conic-gradient(from 90deg at 50% 50%, #10b981 0%, #06b6d4 50%, #10b981 100%)',
  amber: 'conic-gradient(from 90deg at 50% 50%, #f59e0b 0%, #ef4444 50%, #f59e0b 100%)',
  violet: 'conic-gradient(from 90deg at 50% 50%, #8b5cf6 0%, #ec4899 50%, #8b5cf6 100%)',
};

/**
 * Aceternity Moving Border Button — crisp spinning conic halo around a clean high-contrast inner surface.
 */
export const MovingBorderButton = React.forwardRef<
  HTMLButtonElement,
  MovingBorderButtonProps
>(
  (
    {
      children,
      className,
      loading = false,
      disabled,
      tone = 'primary',
      size = 'md',
      type = 'button',
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          'relative inline-flex overflow-hidden rounded-xl p-[1.5px] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-55 disabled:pointer-events-none group transition-transform active:scale-[0.98]',
          size === 'sm' ? 'h-9' : 'h-10',
          className
        )}
        {...props}
      >
        <span
          aria-hidden="true"
          className="absolute inset-[-1000%] animate-[spin_4s_linear_infinite]"
          style={{ background: CONIC_GRADIENTS[tone] }}
        />
        <span
          className={cn(
            'relative inline-flex h-full w-full items-center justify-center gap-2 rounded-[10.5px] bg-slate-950 text-white dark:bg-slate-950 font-semibold backdrop-blur-3xl transition-colors group-hover:bg-slate-900',
            size === 'sm' ? 'px-3.5 text-xs' : 'px-4 text-xs sm:text-sm'
          )}
        >
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />}
          {children}
        </span>
      </button>
    );
  }
);

MovingBorderButton.displayName = 'MovingBorderButton';

export interface ShimmerBadgeProps {
  children: React.ReactNode;
  pulse?: boolean;
  tone?: 'primary' | 'emerald' | 'amber' | 'rose' | 'violet';
  className?: string;
}

const BADGE_TONES: Record<NonNullable<ShimmerBadgeProps['tone']>, string> = {
  primary: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  rose: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  violet: 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300',
};

const DOT_TONES: Record<NonNullable<ShimmerBadgeProps['tone']>, string> = {
  primary: 'bg-blue-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  violet: 'bg-violet-500',
};

export const ShimmerBadge: React.FC<ShimmerBadgeProps> = ({
  children,
  pulse = false,
  tone = 'primary',
  className,
}) => {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide',
        BADGE_TONES[tone],
        className
      )}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
              DOT_TONES[tone]
            )}
          />
          <span className={cn('relative inline-flex h-2 w-2 rounded-full', DOT_TONES[tone])} />
        </span>
      )}
      {children}
    </span>
  );
};
