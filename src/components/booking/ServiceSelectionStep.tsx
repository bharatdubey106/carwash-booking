// components/booking/ServiceSelectionStep.tsx
'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getActiveServices } from '@/lib/actions/bookings';
import { useBooking } from '@/context/BookingContext';

interface ServiceRow {
  id: string;
  center_id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  category: string | null;
  image_url: string | null;
}

function iconFor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('deep')) return '🧹';
  if (n.includes('premium')) return '💎';
  if (n.includes('standard')) return '♨️';
  return '🚿';
}

export default function ServiceSelectionStep() {
  const { state, selectService, nextStep, prevStep, canProceed } = useBooking();
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const result = await getActiveServices();
      if (!active) return;
      if (result.success) setServices(result.data);
      else setError(result.error);
      setIsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // De-duplicate by name for display — the same wash can be offered at
  // several centers with different prices; Step 2 resolves the exact row.
  const catalog = Array.from(new Map(services.map((s) => [s.name, s])).values());

  function handleSelect(service: ServiceRow) {
    selectService({
      id: service.id,
      name: service.name,
      category: service.category,
      price: service.price,
      durationMinutes: service.duration_minutes,
    });
  }

  return (
    <div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-extrabold text-slate-900">Choose a Service</h2>
        <p className="mt-1 text-xs text-slate-500">Tap to select — highlighted once chosen</p>

        {isLoading && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        )}

        {error && !isLoading && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {!isLoading && !error && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {catalog.map((service) => {
              const isSelected = state.service?.name === service.name;
              return (
                <motion.button
                  key={service.name}
                  type="button"
                  onClick={() => handleSelect(service)}
                  whileTap={{ scale: 0.97 }}
                  className={[
                    'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors',
                    isSelected
                      ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                      : 'border-slate-200 hover:border-slate-300',
                  ].join(' ')}
                >
                  <span className="text-2xl">{iconFor(service.name)}</span>
                  <span className="text-sm font-bold text-slate-900">{service.name}</span>
                  {service.category && <span className="text-[11px] text-slate-500">{service.category}</span>}
                  <span className="mt-1 line-clamp-2 text-xs text-slate-600">{service.description}</span>
                  <span className="mt-auto pt-2 text-sm font-bold text-blue-600">From ₹{service.price}</span>
                </motion.button>
              );
            })}
            {catalog.length === 0 && (
              <p className="col-span-full text-sm text-slate-500">No services available right now.</p>
            )}
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