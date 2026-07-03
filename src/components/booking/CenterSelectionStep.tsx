// components/booking/CenterSelectionStep.tsx
'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getActiveServices, getOpenCenters } from '@/lib/actions/bookings';
import { useBooking, type SelectedCenter } from '@/context/BookingContext';

interface CenterOption {
  id: string;
  name: string;
  address: string;
  phone: string;
  supportsPickup: boolean;
  serviceId: string;
  price: number;
  durationMinutes: number;
}

export default function CenterSelectionStep() {
  const { state, selectCenter, selectService, nextStep, prevStep, canProceed } = useBooking();
  const [options, setOptions] = useState<CenterOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!state.service) return;
    let active = true;

    (async () => {
      setIsLoading(true);
      const [servicesResult, centersResult] = await Promise.all([getActiveServices(), getOpenCenters()]);
      if (!active) return;

      if (!servicesResult.success) {
        setError(servicesResult.error);
        setIsLoading(false);
        return;
      }
      if (!centersResult.success) {
        setError(centersResult.error);
        setIsLoading(false);
        return;
      }

      const centerById = new Map(centersResult.data.map((c) => [c.id, c]));
      const matches: CenterOption[] = servicesResult.data
        .filter((s) => s.name === state.service?.name)
        .map((s) => {
          const center = centerById.get(s.center_id);
          if (!center) return null;
          return {
            id: center.id,
            name: center.name,
            address: center.address,
            phone: center.phone,
            supportsPickup: center.supports_pickup,
            serviceId: s.id,
            price: s.price,
            durationMinutes: s.duration_minutes,
          };
        })
        .filter((x): x is CenterOption => x !== null);

      setOptions(matches);
      setError(null);
      setIsLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [state.service]);

  function handleSelect(option: CenterOption) {
    // Re-pin the exact service row this center offers — price/duration can
    // differ from what was shown in the aggregated Step 1 card.
    selectService({
      id: option.serviceId,
      name: state.service!.name,
      category: state.service!.category,
      price: option.price,
      durationMinutes: option.durationMinutes,
    });
    const center: SelectedCenter = {
      id: option.id,
      name: option.name,
      address: option.address,
      phone: option.phone,
      supportsPickup: option.supportsPickup,
    };
    selectCenter(center);
  }

  return (
    <div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-extrabold text-slate-900">Choose a Center</h2>
        <p className="mt-1 text-xs text-slate-500">
          {state.service ? `Centers offering "${state.service.name}" — pick your nearest` : 'Select a service first'}
        </p>

        {isLoading && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        )}

        {error && !isLoading && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {!isLoading && !error && options.length === 0 && (
          <div className="mt-6 flex flex-col items-center gap-2 py-6 text-center">
            <span className="text-3xl">🏢</span>
            <p className="text-sm text-slate-500">No centers currently offer this service.</p>
          </div>
        )}

        {!isLoading && !error && options.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {options.map((option) => {
              const isSelected = state.center?.id === option.id;
              return (
                <motion.button
                  key={option.id}
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelect(option)}
                  className={[
                    'flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-colors',
                    isSelected
                      ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                      : 'border-slate-200 hover:border-slate-300',
                  ].join(' ')}
                >
                  <span className="text-sm font-bold text-slate-900">{option.name}</span>
                  <span className="text-xs text-slate-500">📍 {option.address}</span>
                  <span className="mt-1 text-xs font-semibold text-blue-600">
                    ₹{option.price} · {option.durationMinutes} min
                  </span>
                  {option.supportsPickup && (
                    <span className="mt-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      Pickup & Drop available
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={prevStep}
          className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700"
        >
          ← Back
        </button>
        <button
          type="button"
          disabled={!canProceed}
          onClick={nextStep}
          className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}