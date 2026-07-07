'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function requireOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: 'Not authenticated.' } as const;

  const { data: profile } = (await supabase.from('profiles').select('role').eq('id', user.id).single()) as any;
  if (!profile || profile.role !== 'owner') return { supabase, user: null, error: 'Not authorized.' } as const;

  return { supabase, user, error: null } as const;
}

export async function getOwnerCenters() {
  const { supabase, user, error } = await requireOwner();
  if (error || !user) return { success: false as const, error: error ?? 'Not authorized.' };

  const { data, error: qError } = (await supabase
    .from('centers')
    .select('id, name, address, phone, is_active, supports_pickup, opens_at, closes_at')
    .eq('owner_id', user.id)
    .order('name')) as any;

  if (qError) return { success: false as const, error: 'Could not load your centers.' };
  return { success: true as const, data };
}

export interface OwnerBookingRow {
  id: string;
  booking_date: string;
  slot_time: string;
  booking_type: 'slot' | 'pickup';
  status: string;
  customer_name: string;
  customer_phone: string;
  pickup_address: string | null;
  price_at_booking: number;
  vehicle_plate: string | null;
  center_id: string;
  center_name: string;
  service_name: string;
}

export async function getOwnerBookings(filters?: { date?: string; search?: string; status?: string }) {
  const { supabase, user, error } = await requireOwner();
  if (error || !user) return { success: false as const, error: error ?? 'Not authorized.' };

  // No .eq('owner_id', ...) needed here — RLS's bookings_owner_select_own_center
  // policy already restricts rows to this owner's centers.
  let query = supabase
    .from('bookings')
    .select(
      'id, booking_date, slot_time, booking_type, status, customer_name, customer_phone, pickup_address, price_at_booking, vehicle_plate, center_id, centers(name), services(name)'
    )
    .order('booking_date', { ascending: false })
    .order('slot_time', { ascending: false });

  if (filters?.date) query = query.eq('booking_date', filters.date);
  if (filters?.status) query = query.eq('status', filters.status);

  const { data, error: qError } = (await query) as any;
  if (qError) return { success: false as const, error: 'Could not load bookings.' };

  let rows: OwnerBookingRow[] = (data ?? []).map((b: any) => ({
    id: b.id,
    booking_date: b.booking_date,
    slot_time: b.slot_time,
    booking_type: b.booking_type,
    status: b.status,
    customer_name: b.customer_name,
    customer_phone: b.customer_phone,
    pickup_address: b.pickup_address,
    price_at_booking: b.price_at_booking,
    vehicle_plate: b.vehicle_plate,
    center_id: b.center_id,
    center_name: b.centers?.name ?? '—',
    service_name: b.services?.name ?? '—',
  }));

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    rows = rows.filter((r) => r.customer_name.toLowerCase().includes(q) || r.customer_phone.includes(q));
  }

  return { success: true as const, data: rows };
}

export async function getOwnerMetrics() {
  const { supabase, user, error } = await requireOwner();
  if (error || !user) return { success: false as const, error: error ?? 'Not authorized.' };

  const today = new Date().toISOString().split('T')[0];
  const weekAhead = new Date();
  weekAhead.setDate(weekAhead.getDate() + 7);
  const weekAheadStr = weekAhead.toISOString().split('T')[0];

  const [{ count: pendingCount }, { count: todayCount }, { data: upcoming }] = (await Promise.all([
    supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('booking_date', today),
    supabase
      .from('bookings')
      .select('id, booking_date, slot_time, status, customer_name, price_at_booking, services(name), centers(name)')
      .gte('booking_date', today)
      .lte('booking_date', weekAheadStr)
      .neq('status', 'cancelled')
      .order('booking_date')
      .order('slot_time')
      .limit(20),
  ])) as any;

  const revenueThisWeek = (upcoming ?? []).reduce((sum: number, b: any) => sum + Number(b.price_at_booking), 0);

  return {
    success: true as const,
    data: {
      pendingCount: pendingCount ?? 0,
      todayCount: todayCount ?? 0,
      revenueThisWeek,
      upcoming: (upcoming ?? []).map((b: any) => ({
        id: b.id,
        date: b.booking_date,
        time: b.slot_time,
        status: b.status,
        customerName: b.customer_name,
        price: b.price_at_booking,
        serviceName: b.services?.name ?? '—',
        centerName: b.centers?.name ?? '—',
      })),
    },
  };
}

const statusUpdateSchema = z.object({
  bookingId: z.string().uuid(),
  status: z.enum(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']),
});

export async function updateBookingStatus(input: z.infer<typeof statusUpdateSchema>) {
  const parsed = statusUpdateSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: 'Invalid status update.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Not authenticated.' };

  const { data, error } = await (supabase.from('bookings') as any)
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.bookingId)
    .select('id')
    .single();

  if (error || !data) return { success: false as const, error: 'Could not update this booking — it may not be yours.' };

  revalidatePath('/owner/dashboard');
  revalidatePath('/admin/dashboard');
  return { success: true as const };
}