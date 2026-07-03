// lib/utils/whatsapp.ts

export interface WhatsAppBookingPayload {
  bookingId: string; // UUID from the bookings table
  bookingType: 'slot' | 'pickup';
  customerName: string;
  customerPhone: string; // 10-digit, no country code
  serviceName: string;
  serviceCategory?: string | null;
  centerName: string;
  centerPhone: string; // digits only, e.g. '919407822022'
  date: string; // 'YYYY-MM-DD'
  time: string; // 'HH:mm' or 'HH:mm:ss'
  durationMinutes: number;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehiclePlate?: string | null;
  pickupAddress?: string | null;
  notes?: string | null;
}

const FALLBACK_PLATFORM_NUMBER = '919407822022';

/** Turns the first 8 hex chars of a booking UUID into a short, human-readable
 *  reference, e.g. '3F0A1C9B' -> '#3F0A1C9B'. If you add a `booking_number`
 *  bigserial column later, swap this for `#${String(n).padStart(4, '0')}`
 *  to exactly match the original prototype's sequential IDs. */
function formatBookingRef(bookingId: string): string {
  return `#${bookingId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

function formatDateLong(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime12h(timeStr: string): string {
  const [hStr, mStr] = timeStr.split(':');
  const h = Number(hStr);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${mStr} ${period}`;
}

export function buildWhatsAppConfirmationLink(booking: WhatsAppBookingPayload): string {
  const ref = formatBookingRef(booking.bookingId);
  const serviceTypeLabel = booking.bookingType === 'pickup' ? 'Pickup & Drop' : 'Book a Slot';
  const serviceLabel = booking.serviceCategory
    ? `${booking.serviceName} (${booking.serviceCategory})`
    : booking.serviceName;
  const vehicleLabel = [booking.vehicleMake, booking.vehicleModel].filter(Boolean).join(' ') || 'N/A';

  const lines = [
    `🔔 NEW BOOKING — ${ref}`,
    '',
    `Customer: ${booking.customerName}`,
    `Phone: +91${booking.customerPhone}`,
    `Service Type: ${serviceTypeLabel}`,
    ...(booking.bookingType === 'pickup' ? [`Pickup Address: ${booking.pickupAddress || '—'}`] : []),
    `Service: ${serviceLabel}`,
    `Center: ${booking.centerName}`,
    `Date: ${formatDateLong(booking.date)}`,
    `Time: ${formatTime12h(booking.time)}`,
    `Duration: ${booking.durationMinutes} min`,
    `Vehicle: ${vehicleLabel}${booking.vehiclePlate ? ` (${booking.vehiclePlate})` : ''}`,
    ...(booking.notes ? [`Notes: ${booking.notes}`] : []),
    '',
    'Status: Pending — please accept or reject.',
  ];

  const message = encodeURIComponent(lines.join('\n'));
  const targetNumber = booking.centerPhone || FALLBACK_PLATFORM_NUMBER;

  return `https://wa.me/${targetNumber}?text=${message}`;
}

/** Opens the WhatsApp confirmation link in a new tab. Client-side only —
 *  call this from a client component event handler after createBooking()
 *  resolves successfully. */
export function openWhatsAppConfirmation(booking: WhatsAppBookingPayload): void {
  if (typeof window === 'undefined') return;
  window.open(buildWhatsAppConfirmationLink(booking), '_blank', 'noopener,noreferrer');
}