import React, { useCallback } from 'react';
import { motion, useMotionTemplate, useMotionValue } from 'framer-motion';
import { cn } from '@/lib/utils';

export type SpotlightTone = 'primary' | 'blue' | 'emerald' | 'amber' | 'violet' | 'rose' | 'cyan';

const TONE_RGB: Record<SpotlightTone, string> = {
  primary: '59, 130, 246',
  blue: '37, 99, 235',
  emerald: '16, 185, 129',
  amber: '245, 158, 11',
  violet: '139, 92, 246',
  rose: '244, 63, 94',
  cyan: '6, 182, 212',
};

const TOP_BEAM_CLASS: Record<SpotlightTone, string> = {
  primary: 'via-blue-500/60',
  blue: 'via-blue-500/60',
  emerald: 'via-emerald-500/60',
  amber: 'via-amber-500/60',
  violet: 'via-violet-500/60',
  rose: 'via-rose-500/60',
  cyan: 'via-cyan-500/60',
};

export interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: SpotlightTone;
  radius?: number;
  showTopBeam?: boolean;
  interactive?: boolean;
}

/**
 * Aceternity-inspired SpotlightCard using Framer Motion values (zero re-renders on hover).
 * Harmonious across Light & Dark themes with crisp borders and subtle radial illumination.
 */
export const SpotlightCard = React.forwardRef<HTMLDivElement, SpotlightCardProps>(
  (
    {
      children,
      className,
      tone = 'primary',
      radius = 320,
      showTopBeam = false,
      interactive = true,
      onMouseMove,
      ...props
    },
    ref
  ) => {
    const mouseX = useMotionValue(-radius);
    const mouseY = useMotionValue(-radius);

    const handleMouseMove = useCallback(
      (event: React.MouseEvent<HTMLDivElement>) => {
        if (interactive) {
          const rect = event.currentTarget.getBoundingClientRect();
          mouseX.set(event.clientX - rect.left);
          mouseY.set(event.clientY - rect.top);
        }
        onMouseMove?.(event);
      },
      [interactive, mouseX, mouseY, onMouseMove]
    );

    const rgb = TONE_RGB[tone];
    const background = useMotionTemplate`radial-gradient(${radius}px circle at ${mouseX}px ${mouseY}px, rgba(${rgb}, 0.13), transparent 72%)`;

    return (
      <div
        ref={ref}
        onMouseMove={handleMouseMove}
        className={cn(
          'group/spotlight relative overflow-hidden rounded-2xl border border-border/80 bg-card text-card-foreground',
          'shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-14px_rgba(15,23,42,0.12)]',
          'dark:shadow-[0_1px_2px_rgba(0,0,0,0.45),0_12px_32px_-16px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.06)]',
          'transition-[border-color,box-shadow,transform] duration-200',
          interactive && 'hover:border-primary/35',
          className
        )}
        {...props}
      >
        {showTopBeam && (
          <div
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent to-transparent opacity-80',
              TOP_BEAM_CLASS[tone]
            )}
          />
        )}

        {interactive && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-300 group-hover/spotlight:opacity-100"
            style={{ background }}
          />
        )}

        <div className="relative z-10 h-full">{children}</div>
      </div>
    );
  }
);

SpotlightCard.displayName = 'SpotlightCard';
