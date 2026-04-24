import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';

interface PageTransitionProps {
  children: React.ReactNode;
}

const pageVariants = {
  initial: {
    opacity: 0,
    y: 12,
    scale: 0.985,
    filter: 'blur(4px)',
  },
  in: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
  },
  out: {
    opacity: 0,
    y: -8,
    scale: 1.01,
    filter: 'blur(4px)',
  },
};

const pageTransition = {
  type: 'spring',
  stiffness: 320,
  damping: 32,
  mass: 0.8,
};

const exitTransition = {
  type: 'tween',
  ease: 'easeIn',
  duration: 0.18,
};

const PageTransition = forwardRef<HTMLDivElement, PageTransitionProps>(
  ({ children }, ref) => {
    return (
      <motion.div
        ref={ref}
        initial="initial"
        animate="in"
        exit="out"
        variants={pageVariants}
        transition={pageTransition}
        className="w-full h-full"
        style={{ willChange: 'transform, opacity, filter' }}
      >
        {children}
      </motion.div>
    );
  }
);

PageTransition.displayName = 'PageTransition';

export default PageTransition;
