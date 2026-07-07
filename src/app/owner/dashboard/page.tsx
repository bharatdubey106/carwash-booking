// app/owner/dashboard/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getOwnerCenters, getOwnerMetrics, getOwnerBookings } from '@/lib/actions/owner';
import OwnerDashboardClient from '@/components/owner/OwnerDashboardClient';

export default async function OwnerDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/owner/login');

  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single();
  if (!profile || (profile as any).role !== 'owner') redirect('/owner/login');

  const [centersResult, metricsResult, bookingsResult] = await Promise.all([
    getOwnerCenters(),
    getOwnerMetrics(),
    getOwnerBookings(),
  ]);

  return (
    <OwnerDashboardClient
      ownerName={(profile as any).full_name}
      initialCenters={centersResult.success ? centersResult.data : []}
      initialMetrics={metricsResult.success ? metricsResult.data : null}
      initialBookings={bookingsResult.success ? bookingsResult.data : []}
    />
  );
}