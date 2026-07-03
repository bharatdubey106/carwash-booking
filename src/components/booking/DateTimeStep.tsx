// components/booking/DateTimeStep.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { getAvailableSlots, type SlotAvailability } from '@/lib/actions/bookings';
import { useBooking } from '@/context/BookingContext';

const ADVANCE_DAYS = 14;
const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatTime12h(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

export default function DateTimeStep() {
  const { state, setDateTime, nextStep, prevStep, canProceed } = useBooking();

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const maxDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + ADVANCE_DAYS);
    return d;
  }, [today]);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  // Kept local until a slot is actually tapped — prevents the step from
  // becoming "valid" the instant a date is picked but no time yet.
  const [pendingDate, setPendingDate] = useState<string | null>(state.date);
  const [slots, setSlots] = useState<SlotAvailability[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingDate || !state.center || !state.service) return;
    let active = true;

    (async () => {
      setIsLoadingSlots(true);
      setSlotsError(null);
      const result = await getAvailableSlots({
        centerId: state.center!.id,
        date: pendingDate,
        serviceDurationMinutes: state.service!.durationMinutes,
      });
      if (!active) return;
      if (result.success) setSlots(result.data);
      else setSlotsError(result.error);
      setIsLoadingSlots(false);
    })();

    return () => {
      active = false;
    };
  }, [pendingDate, state.center, state.service]);

  function goPrevMonth() {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }
  function goNextMonth() {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }

  const calendarCells = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const lastOfMonth = new Date(viewYear, viewMonth + 1, 0);
    const cells: Array<{ date: Date; dateStr: string; disabled: boolean } | null> = [];

    for (let i = 0; i < firstOfMonth.getDay(); i++) cells.push(null);
    for (let day = 1; day <= lastOfMonth.getDate(); day++) {
      const date = new Date(viewYear, viewMonth, day);
      const dateStr = toDateStr(date);
      cells.push({ date, dateStr, disabled: date < today || date > maxDate });
    }
    return cells;
  }, [viewYear, viewMonth, today, maxDate]);

  function handleSelectSlot(time: string) {
    if (pendingDate) setDateTime(pendingDate, time);
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={goPrevMonth} className="rounded-full px-2 py-1 text-lg text-slate-500 hover:bg-slate-100">‹</button>
            <span className="text-sm font-bold text-slate-900">{MONTH_LABELS[viewMonth]} {viewYear}</span>
            <button type="button" onClick={goNextMonth} className="rounded-full px-2 py-1 text-lg text-slate-500 hover:bg-slate-100">›</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-400">
            {WEEKDAY_LABELS.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {calendarCells.map((cell, i) => {
              if (!cell) return <div key={`blank-${i}`} />;
              const isSelected = pendingDate === cell.dateStr;
              const isToday = toDateStr(today) === cell.dateStr;
              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  disabled={cell.disabled}
                  onClick={() => setPendingDate(cell.dateStr)}
                  className={[
                    'flex h-9 items-center justify-center rounded-lg text-xs font-semibold transition-colors',
                    cell.disabled ? 'text-slate-300' : 'text-slate-700 hover:bg-slate-100',
                    isSelected ? 'bg-blue-600 text-white hover:bg-blue-600' : '',
                    isToday && !isSelected ? 'ring-1 ring-blue-400' : '',
                  ].join(' ')}
                >
                  {cell.date.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">{pendingDate ? 'Available Slots' : 'Pick a date first'}</h3>
          {pendingDate && <p className="mb-2 text-[11px] text-slate-500">{state.service?.durationMinutes} min service</p>}

          {isLoadingSlots && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-9 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          )}

          {slotsError && !isLoadingSlots && <p className="mt-2 text-xs text-red-600">{slotsError}</p>}

          {!isLoadingSlots && !slotsError && pendingDate && slots.length === 0 && (
            <p className="mt-2 text-xs text-slate-500">This center is closed or fully booked on the selected date.</p>
          )}

          {!isLoadingSlots && !slotsError && slots.length > 0 && (
            <motion.div layout className="mt-2 grid grid-cols-3 gap-2">
              {slots.map((slot) => {
                const isSelected = state.date === pendingDate && state.time === slot.time;
                return (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={!slot.available}
                    onClick={() => handleSelectSlot(slot.time)}
                    className={[
                      'flex flex-col items-center justify-center rounded-lg border py-2 text-[11px] font-semibold transition-colors',
                      !slot.available
                        ? 'cursor-not-allowed border-slate-100 text-slate-300'
                        : 'border-slate-200 text-slate-700 hover:border-blue-400',
                      isSelected ? 'border-blue-600 bg-blue-600 text-white' : '',
                    ].join(' ')}
                  >
                    {formatTime12h(slot.time)}
                    {!slot.available && <span className="text-[9px]">Full</span>}
                  </button>
                );
              })}
            </motion.div>
          )}
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={prevStep} className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700">
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