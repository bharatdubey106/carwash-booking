'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: 'Not authenticated.' } as const;

  const { data: profile } = (await supabase.from('profiles').select('role').eq('id', user.id).single()) as any;
  if (!profile || profile.role !== 'admin') return { supabase, user: null, error: 'Not authorized.' } as const;

  return { supabase, user, error: null } as const;
}

// ============================================================
// METRICS
// ============================================================
export async function getAdminMetrics() {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { success: false as const, error: error ?? 'Not authorized.' };

  const today = new Date().toISOString().split('T')[0];

  const [{ count: todayCount }, { count: pendingCount }, { count: centerCount }, { count: ownerCount }, { data: todayBookings }] =
    (await Promise.all([
      supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('booking_date', today),
      supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('centers').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'owner'),
      supabase
        .from('bookings')
        .select('id, slot_time, status, customer_name, customer_phone, booking_type, services(name), centers(name)')
        .eq('booking_date', today)
        .order('slot_time'),
    ])) as any;

  return {
    success: true as const,
    data: {
      todayCount: todayCount ?? 0,
      pendingCount: pendingCount ?? 0,
      activeCenters: centerCount ?? 0,
      activeOwners: ownerCount ?? 0,
      todayBookings: (todayBookings ?? []).map((b: any) => ({
        id: b.id,
        time: b.slot_time,
        status: b.status,
        customerName: b.customer_name,
        customerPhone: b.customer_phone,
        bookingType: b.booking_type,
        serviceName: b.services?.name ?? '—',
        centerName: b.centers?.name ?? '—',
      })),
    },
  };
}

// ============================================================
// BOOKINGS
// ============================================================
export interface AdminBookingRow {
  id: string;
  booking_date: string;
  slot_time: string;
  booking_type: 'slot' | 'pickup';
  status: string;
  customer_name: string;
  customer_phone: string;
  price_at_booking: number;
  center_id: string;
  center_name: string;
  service_id: string;
  service_name: string;
}

export async function getAllBookingsAdmin(filters?: { date?: string; serviceId?: string; search?: string }) {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { success: false as const, error: error ?? 'Not authorized.' };

  let query = supabase
    .from('bookings')
    .select(
      'id, booking_date, slot_time, booking_type, status, customer_name, customer_phone, price_at_booking, center_id, service_id, centers(name), services(name)'
    )
    .order('booking_date', { ascending: false })
    .order('slot_time', { ascending: false });

  if (filters?.date) query = query.eq('booking_date', filters.date);
  if (filters?.serviceId) query = query.eq('service_id', filters.serviceId);

  const { data, error: qError } = (await query) as any;
  if (qError) return { success: false as const, error: 'Could not load bookings.' };

  let rows: AdminBookingRow[] = (data ?? []).map((b: any) => ({
    id: b.id,
    booking_date: b.booking_date,
    slot_time: b.slot_time,
    booking_type: b.booking_type,
    status: b.status,
    customer_name: b.customer_name,
    customer_phone: b.customer_phone,
    price_at_booking: b.price_at_booking,
    center_id: b.center_id,
    center_name: b.centers?.name ?? '—',
    service_id: b.service_id,
    service_name: b.services?.name ?? '—',
  }));

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    rows = rows.filter((r) => r.customer_name.toLowerCase().includes(q) || r.customer_phone.includes(q));
  }

  return { success: true as const, data: rows };
}

const manualBookingSchema = z.object({
  centerId: z.string().uuid(),
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  customerName: z.string().trim().min(2),
  customerPhone: z.string().trim().regex(/^\d{10}$/),
  vehiclePlate: z.string().trim().optional().default(''),
  bookingType: z.enum(['slot', 'pickup']).default('slot'),
});

export async function createManualBooking(input: z.infer<typeof manualBookingSchema>) {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { success: false as const, error: error ?? 'Not authorized.' };

  const parsed = manualBookingSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  const data = parsed.data;

  const { data: service, error: serviceError } = (await supabase
    .from('services')
    .select('id, price, center_id')
    .eq('id', data.serviceId)
    .single()) as any;

  if (serviceError || !service || service.center_id !== data.centerId) {
    return { success: false as const, error: 'Service not found for this center.' };
  }

  const { data: inserted, error: insertError } = await (supabase.from('bookings') as any)
    .insert({
      client_id: null,
      center_id: data.centerId,
      service_id: data.serviceId,
      booking_type: data.bookingType,
      status: 'confirmed',
      booking_date: data.date,
      slot_time: `${data.time}:00`,
      customer_name: data.customerName,
      customer_phone: data.customerPhone,
      vehicle_plate: data.vehiclePlate || null,
      price_at_booking: service.price,
      booking_source: 'manual',
    })
    .select('id')
    .single();

  if (insertError) {
    if (insertError.code === '23505') return { success: false as const, error: 'That slot is already booked.' };
    return { success: false as const, error: 'Could not create the booking.' };
  }

  revalidatePath('/admin/dashboard');
  return { success: true as const, data: inserted };
}

// ============================================================
// SERVICES
// ============================================================
export interface AdminServiceRow {
  id: string;
  center_id: string;
  center_name: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  category: string | null;
  is_active: boolean;
}

export async function getAllServicesAdmin() {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { success: false as const, error: error ?? 'Not authorized.' };

  const { data, error: qError } = (await supabase
    .from('services')
    .select('id, center_id, name, description, price, duration_minutes, category, is_active, centers(name)')
    .order('name')) as any;

  if (qError) return { success: false as const, error: 'Could not load services.' };

  const rows: AdminServiceRow[] = (data ?? []).map((s: any) => ({
    id: s.id,
    center_id: s.center_id,
    center_name: s.centers?.name ?? '—',
    name: s.name,
    description: s.description,
    price: s.price,
    duration_minutes: s.duration_minutes,
    category: s.category,
    is_active: s.is_active,
  }));

  return { success: true as const, data: rows };
}

const serviceUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  centerId: z.string().uuid(),
  name: z.string().trim().min(2),
  category: z.string().trim().optional().default(''),
  description: z.string().trim().optional().default(''),
  price: z.number().nonnegative(),
  durationMinutes: z.number().int().positive(),
  isActive: z.boolean().default(true),
});

export async function upsertService(input: z.infer<typeof serviceUpsertSchema>) {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { success: false as const, error: error ?? 'Not authorized.' };

  const parsed = serviceUpsertSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  const data = parsed.data;

  const payload = {
    center_id: data.centerId,
    name: data.name,
    category: data.category || null,
    description: data.description || null,
    price: data.price,
    duration_minutes: data.durationMinutes,
    is_active: data.isActive,
  };

  const { error: writeError } = data.id
    ? await (supabase.from('services') as any).update(payload).eq('id', data.id)
    : await (supabase.from('services') as any).insert(payload);

  if (writeError) return { success: false as const, error: 'Could not save the service.' };

  revalidatePath('/admin/dashboard');
  return { success: true as const };
}

// ============================================================
// CENTERS
// ============================================================
export interface AdminCenterRow {
  id: string;
  name: string;
  address: string;
  phone: string;
  owner_id: string;
  owner_name: string;
  is_active: boolean;
  supports_pickup: boolean;
}

export async function getAllCentersAdmin() {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { success: false as const, error: error ?? 'Not authorized.' };

  const { data, error: qError } = (await supabase
    .from('centers')
    .select('id, name, address, phone, owner_id, is_active, supports_pickup, profiles(full_name)')
    .order('name')) as any;

  if (qError) return { success: false as const, error: 'Could not load centers.' };

  const rows: AdminCenterRow[] = (data ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    address: c.address,
    phone: c.phone,
    owner_id: c.owner_id,
    owner_name: c.profiles?.full_name ?? '—',
    is_active: c.is_active,
    supports_pickup: c.supports_pickup,
  }));

  return { success: true as const, data: rows };
}

const centerUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2),
  address: z.string().trim().min(4),
  city: z.string().trim().default('Pune'),
  phone: z.string().trim().min(8),
  ownerId: z.string().uuid(),
  isActive: z.boolean().default(true),
  supportsPickup: z.boolean().default(false),
});

export async function upsertCenter(input: z.infer<typeof centerUpsertSchema>) {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { success: false as const, error: error ?? 'Not authorized.' };

  const parsed = centerUpsertSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  const data = parsed.data;

  const payload = {
    name: data.name,
    address: data.address,
    city: data.city,
    phone: data.phone,
    owner_id: data.ownerId,
    is_active: data.isActive,
    supports_pickup: data.supportsPickup,
    ...(data.id ? {} : { slug: `${data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}` }),
  };

  const { error: writeError } = data.id
    ? await (supabase.from('centers') as any).update(payload).eq('id', data.id)
    : await (supabase.from('centers') as any).insert(payload);

  if (writeError) return { success: false as const, error: 'Could not save the center.' };

  revalidatePath('/admin/dashboard');
  return { success: true as const };
}

// ============================================================
// OWNERS
// ============================================================
export interface AdminOwnerRow {
  id: string;
  full_name: string;
  phone: string | null;
  centerCount: number;
}

export async function getAllOwnersAdmin() {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { success: false as const, error: error ?? 'Not authorized.' };

  const { data: owners, error: qError } = (await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .eq('role', 'owner')
    .order('full_name')) as any;
  if (qError) return { success: false as const, error: 'Could not load owners.' };

  const { data: centers } = (await supabase.from('centers').select('owner_id')) as any;
  const centerCounts = new Map<string, number>();
  for (const c of centers ?? []) centerCounts.set(c.owner_id, (centerCounts.get(c.owner_id) ?? 0) + 1);

  const rows: AdminOwnerRow[] = (owners ?? []).map((o: any) => ({
    id: o.id,
    full_name: o.full_name,
    phone: o.phone,
    centerCount: centerCounts.get(o.id) ?? 0,
  }));

  return { success: true as const, data: rows };
}

const createOwnerSchema = z.object({
  fullName: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
  phone: z.string().trim().regex(/^\d{10}$/),
});

export async function createOwnerAccount(input: z.infer<typeof createOwnerSchema>) {
  const { user, error } = await requireAdmin();
  if (error || !user) return { success: false as const, error: error ?? 'Not authorized.' };

  const parsed = createOwnerSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  const data = parsed.data;

  const adminClient = createAdminClient();

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: { full_name: data.fullName },
  });

  if (createError || !created.user) {
    return {
      success: false as const,
      error: createError?.message.includes('already') ? 'An account with this email already exists.' : 'Could not create the owner account.',
    };
  }

  const { error: profileError } = await (adminClient.from('profiles') as any)
    .update({ role: 'owner', full_name: data.fullName, phone: data.phone })
    .eq('id', created.user.id);

  if (profileError) {
    return { success: false as const, error: 'Account created but could not be promoted to owner — check the profiles table.' };
  }

  revalidatePath('/admin/dashboard');
  return { success: true as const, data: { id: created.user.id } };
}

// ============================================================
// BLOCKED SLOTS
// ============================================================
export interface AdminBlockedSlotRow {
  id: string;
  center_id: string;
  center_name: string;
  blocked_date: string;
  slot_time: string | null;
  reason: string | null;
}

export async function getBlockedSlotsAdmin() {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { success: false as const, error: error ?? 'Not authorized.' };

  const { data, error: qError } = (await supabase
    .from('blocked_slots')
    .select('id, center_id, blocked_date, slot_time, reason, centers(name)')
    .order('blocked_date', { ascending: false })) as any;

  if (qError) return { success: false as const, error: 'Could not load blocked slots.' };

  const rows: AdminBlockedSlotRow[] = (data ?? []).map((b: any) => ({
    id: b.id,
    center_id: b.center_id,
    center_name: b.centers?.name ?? '—',
    blocked_date: b.blocked_date,
    slot_time: b.slot_time,
    reason: b.reason,
  }));

  return { success: true as const, data: rows };
}

const blockSlotSchema = z.object({
  centerId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  reason: z.string().trim().optional().default(''),
});

export async function createBlockedSlot(input: z.infer<typeof blockSlotSchema>) {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { success: false as const, error: error ?? 'Not authorized.' };

  const parsed = blockSlotSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  const data = parsed.data;

  const { error: insertError } = await (supabase.from('blocked_slots') as any).insert({
    center_id: data.centerId,
    blocked_date: data.date,
    slot_time: data.time ? `${data.time}:00` : null,
    reason: data.reason || null,
    created_by: user.id,
  });

  if (insertError) return { success: false as const, error: 'Could not create the block.' };

  revalidatePath('/admin/dashboard');
  return { success: true as const };
}

export async function deleteBlockedSlot(id: string) {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { success: false as const, error: error ?? 'Not authorized.' };

  const { error: deleteError } = await (supabase.from('blocked_slots') as any).delete().eq('id', id);
  if (deleteError) return { success: false as const, error: 'Could not remove the block.' };

  revalidatePath('/admin/dashboard');
  return { success: true as const };
}

// ============================================================
// PLATFORM SETTINGS
// ============================================================
export interface PlatformSettings {
  whatsapp_number: string;
  default_slot_interval_minutes: number;
  max_advance_days: number;
}

export async function getPlatformSettings() {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { success: false as const, error: error ?? 'Not authorized.' };

  const { data, error: qError } = (await supabase
    .from('platform_settings')
    .select('whatsapp_number, default_slot_interval_minutes, max_advance_days')
    .eq('id', true)
    .single()) as any;

  if (qError || !data) return { success: false as const, error: 'Could not load settings.' };
  return { success: true as const, data };
}

const settingsSchema = z.object({
  whatsappNumber: z.string().trim().min(8),
  slotIntervalMinutes: z.number().int().positive(),
  maxAdvanceDays: z.number().int().positive(),
});

export async function updatePlatformSettings(input: z.infer<typeof settingsSchema>) {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { success: false as const, error: error ?? 'Not authorized.' };

  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  const data = parsed.data;

  const { error: updateError } = await (supabase.from('platform_settings') as any)
    .update({
      whatsapp_number: data.whatsappNumber,
      default_slot_interval_minutes: data.slotIntervalMinutes,
      max_advance_days: data.maxAdvanceDays,
      updated_at: new Date().toISOString(),
    })
    .eq('id', true);

  if (updateError) return { success: false as const, error: 'Could not save settings.' };

  revalidatePath('/admin/dashboard');
  return { success: true as const };
}