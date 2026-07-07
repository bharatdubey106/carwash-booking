// app/admin/dashboard/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  getAdminMetrics,
  getAllBookingsAdmin,
  getAllServicesAdmin,
  getAllCentersAdmin,
  getAllOwnersAdmin,
  getBlockedSlotsAdmin,
  getPlatformSettings,
} from '@/lib/actions/admin';
import AdminDashboardClient from '@/components/admin/AdminDashboardClient';

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || (profile as any).role !== 'admin') redirect('/admin/login');

  const [metrics, bookings, services, centers, owners, blocked, settings] = await Promise.all([
    getAdminMetrics(),
    getAllBookingsAdmin(),
    getAllServicesAdmin(),
    getAllCentersAdmin(),
    getAllOwnersAdmin(),
    getBlockedSlotsAdmin(),
    getPlatformSettings(),
  ]);

  return (
    <AdminDashboardClient
      initialMetrics={metrics.success ? metrics.data : null}
      initialBookings={bookings.success ? bookings.data : []}
      initialServices={services.success ? services.data : []}
      initialCenters={centers.success ? centers.data : []}
      initialOwners={owners.success ? owners.data : []}
      initialBlockedSlots={blocked.success ? blocked.data : []}
      initialSettings={settings.success ? settings.data : null}
    />
  );
}