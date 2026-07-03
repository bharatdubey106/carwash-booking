// components/booking/StepsBar.tsx
'use client';

import { motion } from 'framer-motion';
import { useBooking, type BookingStep } from '@/context/BookingContext';

const STEPS: { key: BookingStep; label: string }[] = [
  { key: 'service-selection', label: 'Service' },
  { key: 'center-selection', label: 'Center' },
  { key: 'date-time', label: 'Date & Time' },
  { key: 'details', label: 'Details' },
  { key: 'review', label: 'Review' },
];

export default function StepsBar() {
  const { state, goToStep } = useBooking();
  const currentIndex = STEPS.findIndex((s) => s.key === state.currentStep);

  return (
    <div className="mb-6 flex items-center justify-between">
      {STEPS.map((step, index) => {
        const isActive = step.key === state.currentStep;
        const isUnlocked = index <= state.furthestStepIndex;
        const isComplete = index < currentIndex;

        return (
          <div key={step.key} className="flex flex-1 items-center last:flex-none">
            <button
              type="button"
              disabled={!isUnlocked}
              onClick={() => goToStep(step.key)}
              className="group relative flex flex-col items-center gap-1.5 disabled:cursor-not-allowed"
            >
              <span
                className={[
                  'relative flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors',
                  isComplete
                    ? 'bg-blue-600 text-white'
                    : isActive
                      ? 'text-blue-600'
                      : isUnlocked
                        ? 'text-slate-600'
                        : 'text-slate-300',
                ].join(' ')}
              >
                {isActive && (
                  <motion.span
                    layoutId="step-indicator"
                    className="absolute inset-0 rounded-full bg-blue-600/10 ring-2 ring-blue-600"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                <span className="relative z-10">{isComplete ? '✓' : index + 1}</span>
              </span>
              <span
                className={[
                  'text-[11px] font-medium',
                  isActive ? 'text-blue-600' : 'text-slate-500',
                ].join(' ')}
              >
                {step.label}
              </span>
            </button>

            {index < STEPS.length - 1 && (
              <div className="mx-2 h-px flex-1 bg-slate-200">
                <motion.div
                  className="h-px bg-blue-600"
                  initial={false}
                  animate={{ width: index < currentIndex ? '100%' : '0%' }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}