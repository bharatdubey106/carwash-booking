'use client';

import { type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

type StepTransitionProps = {
  stepKey: string | number;
  direction: 'forward' | 'backward';
  children: ReactNode;
};

const buildVariants = (direction: 'forward' | 'backward') => {
  const offset = direction === 'forward' ? 32 : -32;
  return {
    initial: { opacity: 0, x: offset },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -offset },
  };
};

/**
 * Wraps each booking step's content so switching steps (service select ->
 * slot/pickup -> confirm) animates as a fluid layout shift instead of a hard
 * cut, while staying cheap enough for low-end mobile devices.
 */
export default function StepTransition({ stepKey, direction, children }: StepTransitionProps) {
  const prefersReducedMotion = useReducedMotion();
  const stepVariants = prefersReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : buildVariants(direction);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={stepKey}
        variants={stepVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: prefersReducedMotion ? 0.12 : 0.32, ease: EASE_OUT_EXPO }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
