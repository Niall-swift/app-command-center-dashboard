import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';

interface PageTransitionProps {
  children: React.ReactNode;
}

const pageVariants = {
  initial: {
    opacity: 0,
    y: 6,
  },
  in: {
    opacity: 1,
    y: 0,
  },
};

const pageTransition = {
  duration: 0.16,
  ease: [0.22, 1, 0.36, 1] as const,
};

const PageTransition = forwardRef<HTMLDivElement, PageTransitionProps>(
  ({ children }, ref) => {
    return (
      <motion.div
        ref={ref}
        initial="initial"
        animate="in"
        variants={pageVariants}
        transition={pageTransition}
        className="w-full h-full"
      >
        {children}
      </motion.div>
    );
  }
);

PageTransition.displayName = 'PageTransition';

export default PageTransition;
