// components/booking/BookingWizard.tsx
'use client';

import { useEffect, useRef, useState, type ComponentType } from 'react';
import { useBooking, type BookingStep } from '@/context/BookingContext';
import StepsBar from './StepsBar';
import StepTransition from '@/components/motion/StepTransition';
import ServiceSelectionStep from './ServiceSelectionStep';
import CenterSelectionStep from './CenterSelectionStep';
import DateTimeStep from './DateTimeStep';
import DetailsStep from './DetailsStep';
import ReviewStep from './ReviewStep';
import SuccessStep from './SuccessStep';
import CarSceneController from '@/components/3d/CarSceneController';

const STEP_ORDER: BookingStep[] = [
  'service-selection',
  'center-selection',
  'date-time',
  'details',
  'review',
  'success',
];

const STEP_COMPONENTS: Record<BookingStep, ComponentType> = {
  'service-selection': ServiceSelectionStep,
  'center-selection': CenterSelectionStep,
  'date-time': DateTimeStep,
  details: DetailsStep,
  review: ReviewStep,
  success: SuccessStep,
};

export default function BookingWizard() {
  const { state } = useBooking();
  const prevIndexRef = useRef(STEP_ORDER.indexOf(state.currentStep));
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  useEffect(() => {
    const idx = STEP_ORDER.indexOf(state.currentStep);
    setDirection(idx >= prevIndexRef.current ? 'forward' : 'backward');
    prevIndexRef.current = idx;
  }, [state.currentStep]);

  const StepComponent = STEP_COMPONENTS[state.currentStep];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      {state.currentStep !== 'success' && (
        <div className="mb-6 h-48 overflow-hidden rounded-2xl bg-gradient-to-b from-slate-50 to-white sm:h-64">
          <CarSceneController className="h-full w-full" />
        </div>
      )}

      {state.currentStep !== 'success' && <StepsBar />}

      <StepTransition stepKey={state.currentStep} direction={direction}>
        <StepComponent />
      </StepTransition>
    </div>
  );
}