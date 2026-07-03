// components/booking/DetailsStep.tsx
'use client';

import { useState } from 'react';
import { useBooking, type VehicleType } from '@/context/BookingContext';

const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
  { value: 'hatchback', label: 'Hatchback' },
  { value: 'sedan', label: 'Sedan' },
  { value: 'suv', label: 'SUV' },
  { value: 'muv_van', label: 'MUV / Van' },
  { value: 'truck_commercial', label: 'Truck / Commercial' },
  { value: 'two_wheeler', label: 'Two Wheeler' },
];

export default function DetailsStep() {
  const { state, updateDetails, setServiceType, nextStep, prevStep } = useBooking();
  const [attempted, setAttempted] = useState(false);

  const { details, serviceType } = state;

  const errors = {
    name: details.name.trim().length === 0,
    phone: !/^\d{10}$/.test(details.phone.trim()),
    vehicleType: details.vehicleType === '',
    pickupAddress: serviceType === 'pickup' && details.pickupAddress.trim().length === 0,
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const showError = (key: keyof typeof errors) => attempted && errors[key];

  function handleContinue() {
    setAttempted(true);
    if (!hasErrors) nextStep();
  }

  return (
    <div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-extrabold text-slate-900">Your Details</h2>

        <div className="mt-4">
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            How do you want your car serviced? <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setServiceType('slot')}
              className={[
                'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors',
                serviceType === 'slot' ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-slate-200',
              ].join(' ')}
            >
              <span className="text-xl">📍</span>
              <span className="text-sm font-bold text-slate-900">Book a Slot</span>
              <span className="text-[11px] text-slate-500">Visit the center yourself</span>
            </button>
            <button
              type="button"
              disabled={!state.center?.supportsPickup}
              onClick={() => setServiceType('pickup')}
              className={[
                'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                serviceType === 'pickup' ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-slate-200',
              ].join(' ')}
            >
              <span className="text-xl">🚗</span>
              <span className="text-sm font-bold text-slate-900">Pickup & Drop</span>
              <span className="text-[11px] text-slate-500">We collect & deliver</span>
            </button>
          </div>

          {serviceType === 'pickup' && (
            <div className="mt-3">
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Pickup Address <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={2}
                value={details.pickupAddress}
                onChange={(e) => updateDetails({ pickupAddress: e.target.value })}
                placeholder="Enter your full address for pickup & drop…"
                className={[
                  'w-full rounded-lg border px-3 py-2 text-sm',
                  showError('pickupAddress') ? 'border-red-500' : 'border-slate-300',
                ].join(' ')}
              />
              {showError('pickupAddress') && <p className="mt-1 text-xs text-red-600">Please enter your pickup address</p>}
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={details.name}
              onChange={(e) => updateDetails({ name: e.target.value })}
              placeholder="e.g. John Doe"
              className={['w-full rounded-lg border px-3 py-2 text-sm', showError('name') ? 'border-red-500' : 'border-slate-300'].join(' ')}
            />
            {showError('name') && <p className="mt-1 text-xs text-red-600">Please enter your full name</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Mobile Number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={details.phone}
              onChange={(e) => updateDetails({ phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              placeholder="e.g. 9876543210"
              className={['w-full rounded-lg border px-3 py-2 text-sm', showError('phone') ? 'border-red-500' : 'border-slate-300'].join(' ')}
            />
            {showError('phone') && <p className="mt-1 text-xs text-red-600">Enter a valid 10-digit number</p>}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Vehicle Number <span className="font-medium text-slate-400">(optional)</span>
            </label>
            <input
              type="text"
              value={details.vehiclePlate}
              onChange={(e) => updateDetails({ vehiclePlate: e.target.value.toUpperCase() })}
              placeholder="e.g. MH12AB1234"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Vehicle Type <span className="text-red-500">*</span>
            </label>
            <select
              value={details.vehicleType}
              onChange={(e) => updateDetails({ vehicleType: e.target.value as VehicleType | '' })}
              className={['w-full rounded-lg border bg-white px-3 py-2 text-sm', showError('vehicleType') ? 'border-red-500' : 'border-slate-300'].join(' ')}
            >
              <option value="">Select type</option>
              {VEHICLE_TYPES.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
            {showError('vehicleType') && <p className="mt-1 text-xs text-red-600">Please select vehicle type</p>}
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Special Requests <span className="font-medium text-slate-400">(optional)</span>
          </label>
          <textarea
            rows={2}
            value={details.notes}
            onChange={(e) => updateDetails({ notes: e.target.value })}
            placeholder="Any special instructions…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={prevStep} className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700">
          ← Back
        </button>
        <button type="button" onClick={handleContinue} className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white">
          Review →
        </button>
      </div>
    </div>
  );
}