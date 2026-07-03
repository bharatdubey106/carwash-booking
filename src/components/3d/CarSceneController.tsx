// components/3d/CarSceneController.tsx
'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { useBooking } from '@/context/BookingContext';
import CarModel from './CarModel';
import { CarCanvasSkeleton } from './CarCanvas';

const CarCanvas = dynamic(() => import('./CarCanvas'), {
  ssr: false,
  loading: () => <CarCanvasSkeleton />,
});

// Mirrors the restricted azimuth range configured in CarCanvas's default
// OrbitControls props, so the model never rotates past what the camera can
// actually orbit to.
const AZIMUTH_RANGE = Math.PI / 2.5;
const SERVICE_ROTATION_ORDER = ['Regular Wash', 'Standard Wash', 'Premium Wash', 'Deep Cleaning'];

function computeTargetRotation(serviceName: string | undefined): number {
  if (!serviceName) return 0;
  const idx = SERVICE_ROTATION_ORDER.indexOf(serviceName);
  const position = idx === -1 ? 0 : idx;
  const steps = SERVICE_ROTATION_ORDER.length - 1;
  const t = steps === 0 ? 0 : position / steps;
  return -AZIMUTH_RANGE + t * (AZIMUTH_RANGE * 2);
}

export default function CarSceneController({ className }: { className?: string }) {
  const { state } = useBooking();
  const targetRotationY = useMemo(() => computeTargetRotation(state.service?.name), [state.service?.name]);
  const lifted = state.serviceType === 'pickup';

  return (
    <CarCanvas className={className} autoRotate={false}>
      <CarModel targetRotationY={targetRotationY} lifted={lifted} />
    </CarCanvas>
  );
}