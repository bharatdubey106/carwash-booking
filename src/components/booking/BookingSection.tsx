// components/booking/BookingSection.tsx
'use client';

import { BookingProvider } from '@/context/BookingContext';
import BookingWizard from './BookingWizard';

export default function BookingSection() {
  return (
    <section id="booking" className="scroll-mt-6 bg-slate-50 py-16">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Book Now</p>
        <h2 className="mt-2 text-2xl font-extrabold text-slate-900 sm:text-3xl">Reserve Your Slot</h2>
        <p className="mt-2 text-sm text-slate-500">Five quick steps — confirmed instantly over WhatsApp</p>
      </div>

      <BookingProvider>
        <BookingWizard />
      </BookingProvider>
    </section>
  );
}