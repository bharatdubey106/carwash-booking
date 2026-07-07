'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// ============================================================
// READ: active services
// ============================================================
export async function getActiveServices(centerId?: string) {
  const supabase = await createClient();

  let query = supabase
    .from('services')
    .select('id, center_id, name, description, price, duration_minutes, category, image_url')
    .eq('is_active', true)
    .order('price', { ascending: true });

  if (centerId) query = query.eq('center_id', centerId);

  const { data, error } = (await query) as any;

  if (error) {
    return { success: false as const, error: 'Could not load services right now.' };
  }
  return { success: true as const, data };
}

// ============================================================
// READ: open centers
// ============================================================
export async function getOpenCenters() {
  const supabase = await createClient();

  const { data, error } = (await supabase
    .from('centers')
    .select(
      'id, name, slug, address, city, latitude, longitude, phone, cover_image_url, opens_at, closes_at, slot_duration_minutes, supports_pickup, pickup_radius_km'
    )
    .eq('is_active', true)
    .order('name', { ascending: true })) as any;

  if (error) {
    return { success: false as const, error: 'Could not load service centers right now.' };
  }
  return { success: true as const, data };
}

// ============================================================
// READ: real-time slot availability
// ============================================================
const availabilityInputSchema = z.object({
  centerId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD.'),
  serviceDurationMinutes: z.number().int().positive(),
});

export type SlotAvailability = { time: string; available: boolean };

function toMinutes(hhmmss: string): number {
  const [h, m] = hhmmss.split(':').map(Number);
  return h * 60 + m;
}

function toTimeString(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, '0');
  const m = (totalMinutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export async function getAvailableSlots(input: z.infer<typeof availabilityInputSchema>) {
  const parsed = availabilityInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }
  const { centerId, date, serviceDurationMinutes } = parsed.data;

  const supabase = await createClient();

  const { data: center, error: centerError } = (await supabase
    .from('centers')
    .select('opens_at, closes_at, slot_duration_minutes, is_active')
    .eq('id', centerId)
    .single()) as any;

  if (centerError || !center || !center.is_active) {
    return { success: false as const, error: 'This center is not currently accepting bookings.' };
  }

  const { data: blockedDay } = (await supabase
    .from('blocked_slots')
    .select('slot_time')
    .eq('center_id', centerId)
    .eq('blocked_date', date)
    .is('slot_time', null)
    .maybeSingle()) as any;

  if (blockedDay) {
    // Entire day is blocked (holiday, maintenance, etc.)
    return { success: true as const, data: [] as SlotAvailability[] };
  }

  const [{ data: bookings }, { data: blockedSlots }] = (await Promise.all([
    supabase
      .from('bookings')
      .select('slot_time, services(duration_minutes)')
      .eq('center_id', centerId)
      .eq('booking_date', date)
      .not('status', 'in', '("cancelled","no_show")'),
    supabase
      .from('blocked_slots')
      .select('slot_time')
      .eq('center_id', centerId)
      .eq('blocked_date', date)
      .not('slot_time', 'is', null),
  ])) as any;

  const grid = center.slot_duration_minutes;

  const busyIntervals: Array<[number, number]> = [];

  for (const booking of bookings ?? []) {
    const start = toMinutes(booking.slot_time);
    // services is joined as an object (single relation); fall back to grid size if missing.
    const duration =
      (booking as unknown as { services: { duration_minutes: number } | null }).services
        ?.duration_minutes ?? grid;
    busyIntervals.push([start, start + duration]);
  }

  for (const blocked of blockedSlots ?? []) {
    const start = toMinutes(blocked.slot_time as string);
    busyIntervals.push([start, start + grid]);
  }

  const opens = toMinutes(center.opens_at);
  const closes = toMinutes(center.closes_at);

  const now = new Date();
  const isToday = date === now.toISOString().split('T')[0];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const MIN_LEAD_TIME_MINUTES = 45; // buffer so a slot can't be booked seconds before it starts

  const slots: SlotAvailability[] = [];

  for (let start = opens; start + serviceDurationMinutes <= closes; start += grid) {
    const end = start + serviceDurationMinutes;

    const overlapsBusy = busyIntervals.some(([busyStart, busyEnd]) => start < busyEnd && end > busyStart);
    const tooSoon = isToday && start < nowMinutes + MIN_LEAD_TIME_MINUTES;

    slots.push({ time: toTimeString(start), available: !overlapsBusy && !tooSoon });
  }

  return { success: true as const, data: slots };
}

// ============================================================
// WRITE: create booking
// ============================================================
const createBookingSchema = z
  .object({
    centerId: z.string().uuid(),
    serviceId: z.string().uuid(),
    bookingType: z.enum(['slot', 'pickup']),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/),
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().regex(/^\d{10}$/, 'Enter a 10-digit phone number.'),
    vehicleMake: z.string().trim().max(40).optional().default(''),
    vehicleModel: z.string().trim().max(40).optional().default(''),
    vehiclePlate: z.string().trim().max(20).optional().default(''),
    notes: z.string().trim().max(300).optional().default(''),
    pickupAddress: z.string().trim().max(300).optional().default(''),
    pickupLatitude: z.number().nullable().optional(),
    pickupLongitude: z.number().nullable().optional(),
  })
  .refine((val) => val.bookingType !== 'pickup' || val.pickupAddress.length > 0, {
    message: 'Pickup address is required for pickup bookings.',
    path: ['pickupAddress'],
  });

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export async function createBooking(input: CreateBookingInput) {
  const parsed = createBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid booking details.' };
  }
  const data = parsed.data;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false as const, error: 'Please sign in to complete your booking.' };
  }

  // Price and duration are always re-derived from the database — never trust
  // client-submitted price/duration values.
  const { data: service, error: serviceError } = (await supabase
    .from('services')
    .select('id, center_id, price, duration_minutes, is_active')
    .eq('id', data.serviceId)
    .single()) as any;

  if (serviceError || !service || !service.is_active || service.center_id !== data.centerId) {
    return { success: false as const, error: 'This service is no longer available.' };
  }

  const { data: center, error: centerError } = (await supabase
    .from('centers')
    .select('id, is_active, supports_pickup')
    .eq('id', data.centerId)
    .single()) as any;

  if (centerError || !center || !center.is_active) {
    return { success: false as const, error: 'This center is no longer accepting bookings.' };
  }

  if (data.bookingType === 'pickup' && !center.supports_pickup) {
    return { success: false as const, error: 'This center does not support pickup & drop.' };
  }

  // Defense-in-depth: re-check the slot is still open right before writing.
  // The DB unique index (center_id, booking_date, slot_time) is the final
  // authority and will reject a race-condition double-book at insert time.
  const availability = await getAvailableSlots({
    centerId: data.centerId,
    date: data.date,
    serviceDurationMinutes: service.duration_minutes,
  });

  if (!availability.success) {
    return { success: false as const, error: availability.error };
  }
  const requestedSlot = availability.data.find((s) => s.time === data.time);
  if (!requestedSlot || !requestedSlot.available) {
    return { success: false as const, error: 'This slot was just taken. Please pick another time.' };
  }

  const { data: inserted, error: insertError } = (await (supabase.from('bookings') as any)
    .insert({
      client_id: user.id,
      center_id: data.centerId,
      service_id: data.serviceId,
      booking_type: data.bookingType,
      status: 'pending',
      booking_date: data.date,
      slot_time: `${data.time}:00`,
      customer_name: data.name,
      customer_phone: data.phone,
      pickup_address: data.bookingType === 'pickup' ? data.pickupAddress : null,
      pickup_latitude: data.bookingType === 'pickup' ? data.pickupLatitude ?? null : null,
      pickup_longitude: data.bookingType === 'pickup' ? data.pickupLongitude ?? null : null,
      vehicle_make: data.vehicleMake || null,
      vehicle_model: data.vehicleModel || null,
      vehicle_plate: data.vehiclePlate || null,
      notes: data.notes || null,
      price_at_booking: service.price,
    })
    .select(
      'id, booking_date, slot_time, booking_type, status, pickup_address, price_at_booking, created_at, center_id, service_id'
    )
    .single()) as any;

  if (insertError) {
    // Postgres unique_violation — someone else grabbed this exact slot
    // between our availability check and this insert.
    if (insertError.code === '23505') {
      return { success: false as const, error: 'This slot was just booked by someone else. Please pick another time.' };
    }
    return { success: false as const, error: 'Could not create the booking. Please try again.' };
  }

  revalidatePath(`/booking/${data.centerId}`);

  return { success: true as const, data: inserted };
}