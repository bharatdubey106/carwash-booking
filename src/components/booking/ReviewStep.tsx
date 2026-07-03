// components/booking/ReviewStep.tsx
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createBooking } from '@/lib/actions/bookings';
import { openWhatsAppConfirmation } from '@/lib/utils/whatsapp';
import { useBooking } from '@/context/BookingContext';
import ClientAuthModal from './ClientAuthModal';

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  hatchback: 'Hatchback',
  sedan: 'Sedan',
  suv: 'SUV',
  muv_van: 'MUV / Van',
  truck_commercial: 'Truck / Commercial',
  two_wheeler: 'Two Wheeler',
};

function formatDateLong(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
function formatTime12h(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

export default function ReviewStep() {
  const { state, goToStep, prevStep, submitStart, submitSuccess, submitError } = useBooking();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const { service, center, date, time, details, serviceType, isSubmitting, submitError: errorMessage } = state;

  if (!service || !center || !date || !time) {
    return <p className="text-sm text-slate-500">Something&apos;s missing — please go back and complete every step.</p>;
  }

  async function submitBooking() {
    submitStart();
    const result = await createBooking({
      centerId: center!.id,
      serviceId: service!.id,
      bookingType: serviceType,
      date: date!,
      time: time!,
      name: details.name,
      phone: details.phone,
      vehicleMake: details.vehicleMake,
      vehicleModel: details.vehicleModel,
      vehiclePlate: details.vehiclePlate,
      notes: details.notes,
      pickupAddress: details.pickupAddress,
      pickupLatitude: details.pickupLatitude,
      pickupLongitude: details.pickupLongitude,
    });

    if (!result.success) {
      submitError(result.error);
      return;
    }

    submitSuccess(result.data.id);
    openWhatsAppConfirmation({
      bookingId: result.data.id,
      bookingType: result.data.booking_type,
      customerName: details.name,
      customerPhone: details.phone,
      serviceName: service!.name,
      serviceCategory: service!.category,
      centerName: center!.name,
      centerPhone: center!.phone.replace(/\D/g, ''),
      date: result.data.booking_date,
      time: result.data.slot_time,
      durationMinutes: service!.durationMinutes,
      vehicleMake: details.vehicleMake,
      vehicleModel: details.vehicleModel,
      vehiclePlate: details.vehiclePlate,
      pickupAddress: result.data.pickup_address,
      notes: details.notes,
    });
  }

  async function handleConfirmClick() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    await submitBooking();
  }

  return (
    <div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-extrabold text-slate-900">Confirm Your Booking</h2>
        <p className="mt-1 text-xs text-slate-500">Review before confirming</p>

        <div className="mt-4 divide-y divide-slate-100 text-sm">
          <SummaryRow label="Service Type" value={serviceType === 'pickup' ? 'Pickup & Drop' : 'Book a Slot'} />
          {serviceType === 'pickup' && <SummaryRow label="Pickup Address" value={details.pickupAddress || '—'} />}
          <SummaryRow label="Center" value={center.name} />
          <SummaryRow label="Date" value={formatDateLong(date)} />
          <SummaryRow label="Time" value={formatTime12h(time)} />
          <SummaryRow label="Duration" value={`${service.durationMinutes} minutes`} />
          <SummaryRow label="Name" value={details.name} />
          <SummaryRow label="Phone" value={details.phone} />
          <SummaryRow label="Vehicle" value={details.vehiclePlate || '—'} />
          <SummaryRow label="Vehicle Type" value={VEHICLE_TYPE_LABELS[details.vehicleType] ?? '—'} />
          <SummaryRow label="Notes" value={details.notes || '—'} />
        </div>

        <hr className="my-4 border-slate-100" />
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
          Tapping &quot;Confirm&quot; saves your slot and opens WhatsApp with a pre-filled message to the center owner.
        </p>

        {errorMessage && <p className="mt-3 text-sm font-medium text-red-600">{errorMessage}</p>}

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => goToStep('details')} className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700">
            ✏️ Edit
          </button>
          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={isSubmitting}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isSubmitting ? 'Confirming…' : 'Confirm Booking'}
          </button>
        </div>
      </div>

      <div className="mt-4">
        <button type="button" onClick={prevStep} className="text-xs font-semibold text-slate-500">
          ← Back to Details
        </button>
      </div>

      <ClientAuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthenticated={async () => {
          setAuthModalOpen(false);
          await submitBooking();
        }}
      />
    </div>
  );
}