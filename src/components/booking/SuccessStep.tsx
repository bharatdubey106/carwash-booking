// components/booking/SuccessStep.tsx
'use client';

import { useBooking } from '@/context/BookingContext';

export default function SuccessStep() {
  const { state, reset } = useBooking();

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-3xl">✅</div>
      <h2 className="mt-3 text-lg font-extrabold text-slate-900">Booking Submitted!</h2>
      <p className="mt-1 text-xs text-slate-500">WhatsApp is open — send the message so the owner can confirm your slot.</p>

      <div className="mt-4 rounded-xl bg-slate-50 p-4 text-left text-sm">
        <div className="flex justify-between py-1">
          <span className="text-slate-500">Booking ID</span>
          <span className="font-bold text-blue-600">#{state.createdBookingId?.replace(/-/g, '').slice(0, 8).toUpperCase()}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-slate-500">Center</span>
          <span className="font-semibold text-slate-900">{state.center?.name}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-slate-500">Date & Time</span>
          <span className="font-semibold text-slate-900">{state.date} · {state.time}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-slate-500">Status</span>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Awaiting Acceptance</span>
        </div>
      </div>

      <button type="button" onClick={reset} className="mt-5 w-full rounded-full bg-blue-600 py-2.5 text-sm font-semibold text-white">
        Book Another Slot
      </button>
    </div>
  );
}