import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface HoverEffectItem {
  id: string;
  content: React.ReactNode;
  onClick?: () => void;
}

export interface HoverEffectGridProps {
  items: HoverEffectItem[];
  layoutId: string;
  className?: string;
  itemClassName?: string;
}

/**
 * Aceternity Card Hover Effect: smooth floating backdrop pill gliding between items on hover.
 */
export const HoverEffectGrid: React.FC<HoverEffectGridProps> = ({
  items,
  layoutId,
  className,
  itemClassName,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div
      className={cn(
        'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2',
        className
      )}
    >
      {items.map((item, idx) => (
        <div
          key={item.id}
          className={cn('relative block p-1', itemClassName)}
          onMouseEnter={() => setHoveredIndex(idx)}
          onMouseLeave={() => setHoveredIndex(null)}
          onClick={item.onClick}
        >
          <AnimatePresence>
            {hoveredIndex === idx && (
              <motion.span
                className="pointer-events-none absolute inset-0 block rounded-2xl bg-primary/[0.08] dark:bg-primary/[0.14] border border-primary/20"
                layoutId={layoutId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.16 } }}
                exit={{ opacity: 0, transition: { duration: 0.14, delay: 0.08 } }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
          </AnimatePresence>
          <div className="relative z-10 h-full">{item.content}</div>
        </div>
      ))}
    </div>
  );
};
