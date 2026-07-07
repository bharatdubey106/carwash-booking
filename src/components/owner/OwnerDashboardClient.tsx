// components/owner/OwnerDashboardClient.tsx
'use client';

import { useMemo, useState, useTransition } from 'react';
import { motion } from 'framer-motion';
import { updateBookingStatus, getOwnerBookings, type OwnerBookingRow } from '@/lib/actions/owner';
import { signOut } from '@/lib/actions/auth';
import SortableTable, { type ColumnDef } from '@/components/dashboard/SortableTable';
import DashboardErrorBoundary from '@/components/dashboard/DashboardErrorBoundary';

type Tab = 'dashboard' | 'requests' | 'bookings' | 'centers';

interface OwnerCenter {
  id: string;
  name: string;
  address: string;
  phone: string;
  is_active: boolean;
  supports_pickup: boolean;
  opens_at: string;
  closes_at: string;
}
interface OwnerMetrics {
  pendingCount: number;
  todayCount: number;
  revenueThisWeek: number;
  upcoming: Array<{ id: string; date: string; time: string; status: string; customerName: string; price: number; serviceName: string; centerName: string }>;
}

interface OwnerDashboardClientProps {
  ownerName: string;
  initialCenters: OwnerCenter[];
  initialMetrics: OwnerMetrics | null;
  initialBookings: OwnerBookingRow[];
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-purple-100 text-purple-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-slate-200 text-slate-600',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={['rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize', STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-600'].join(' ')}>
      {status.replace('_', ' ')}
    </span>
  );
}

function formatTime12h(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

export default function OwnerDashboardClient({ ownerName, initialCenters, initialMetrics, initialBookings }: OwnerDashboardClientProps) {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [bookings, setBookings] = useState<OwnerBookingRow[]>(initialBookings);
  const [metrics] = useState(initialMetrics);
  const [filterDate, setFilterDate] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [isPending, startTransition] = useTransition();
  const [actioningId, setActioningId] = useState<string | null>(null);

  const pendingBookings = useMemo(() => bookings.filter((b) => b.status === 'pending'), [bookings]);

  async function refreshBookings() {
    const result = await getOwnerBookings({ date: filterDate || undefined, search: filterSearch || undefined });
    if (result.success) setBookings(result.data);
  }

  async function handleStatusChange(bookingId: string, status: 'confirmed' | 'cancelled' | 'completed' | 'in_progress') {
    setActioningId(bookingId);
    const previous = bookings;
    setBookings((rows) => rows.map((r) => (r.id === bookingId ? { ...r, status } : r)));

    const result = await updateBookingStatus({ bookingId, status });
    if (!result.success) setBookings(previous);
    setActioningId(null);
  }

  const bookingColumns: ColumnDef<OwnerBookingRow>[] = [
    {
      key: 'date',
      label: 'Date & Time',
      sortable: true,
      sortValue: (r) => `${r.booking_date}${r.slot_time}`,
      render: (r) => (
        <div>
          <div className="font-semibold text-slate-900">
            {new Date(`${r.booking_date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </div>
          <div className="text-[11px] text-slate-500">{formatTime12h(r.slot_time)}</div>
        </div>
      ),
    },
    {
      key: 'customer',
      label: 'Customer',
      sortable: true,
      sortValue: (r) => r.customer_name,
      render: (r) => (
        <div>
          <div className="font-semibold text-slate-900">{r.customer_name}</div>
          <div className="text-[11px] text-slate-500">{r.customer_phone}</div>
        </div>
      ),
    },
    { key: 'service', label: 'Service', sortable: true, sortValue: (r) => r.service_name, render: (r) => <span>{r.service_name}</span> },
    {
      key: 'type',
      label: 'Type',
      render: (r) => (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold">{r.booking_type === 'pickup' ? '🚗 Pickup' : '📍 Slot'}</span>
      ),
    },
    { key: 'center', label: 'Center', sortable: true, sortValue: (r) => r.center_name, render: (r) => <span>{r.center_name}</span> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="flex min-h-dvh bg-slate-50">
      <aside className="hidden w-56 flex-col border-r border-slate-200 bg-white p-4 sm:flex">
        <div className="mb-6">
          <p className="text-xs font-bold text-slate-400">🏢 OWNER PORTAL</p>
          <p className="mt-0.5 truncate text-sm font-extrabold text-slate-900">{ownerName}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {(
            [
              ['dashboard', 'Dashboard'],
              ['requests', `Requests${pendingBookings.length ? ` (${pendingBookings.length})` : ''}`],
              ['bookings', 'All Bookings'],
              ['centers', 'My Centers'],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={[
                'rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors',
                tab === key ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </nav>
        <form action={signOut}>
          <button type="submit" className="rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-500 hover:bg-red-50">
            Logout
          </button>
        </form>
      </aside>

      <main className="flex-1 p-4 sm:p-8">
        <DashboardErrorBoundary>
          {tab === 'dashboard' && (
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">My Dashboard</h1>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <MetricCard label="Pending Requests" value={metrics?.pendingCount ?? 0} accent="amber" />
                <MetricCard label="Today's Bookings" value={metrics?.todayCount ?? 0} accent="blue" />
                <MetricCard label="Revenue (7 days)" value={`₹${metrics?.revenueThisWeek ?? 0}`} accent="emerald" />
              </div>
              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-bold text-slate-900">Upcoming (Next 7 Days)</h3>
                <div className="mt-3 divide-y divide-slate-100">
                  {(metrics?.upcoming ?? []).length === 0 && <p className="py-4 text-sm text-slate-400">Nothing scheduled.</p>}
                  {(metrics?.upcoming ?? []).map((b) => (
                    <div key={b.id} className="flex items-center justify-between py-2.5 text-sm">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {b.customerName} · {b.serviceName}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          📅 {b.date} · ⏰ {formatTime12h(b.time)} · {b.centerName}
                        </p>
                      </div>
                      <StatusBadge status={b.status} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'requests' && (
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">New Requests</h1>
              <div className="mt-4 grid grid-cols-1 gap-3">
                {pendingBookings.length === 0 && <p className="text-sm text-slate-400">No pending requests right now.</p>}
                {pendingBookings.map((b) => (
                  <motion.div
                    layout
                    key={b.id}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        {b.customer_name} <span className="font-normal text-slate-400">· {b.customer_phone}</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        {b.service_name} · {b.center_name}
                      </p>
                      <p className="text-xs text-slate-500">
                        📅 {b.booking_date} · ⏰ {formatTime12h(b.slot_time)} · {b.booking_type === 'pickup' ? '🚗 Pickup' : '📍 Slot'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={actioningId === b.id}
                        onClick={() => handleStatusChange(b.id, 'cancelled')}
                        className="rounded-full border border-red-200 px-4 py-1.5 text-xs font-bold text-red-600 disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        disabled={actioningId === b.id}
                        onClick={() => handleStatusChange(b.id, 'confirmed')}
                        className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                      >
                        Accept
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {tab === 'bookings' && (
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">All My Bookings</h1>
              <div className="mt-4 flex flex-wrap gap-2">
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  onBlur={refreshBookings}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && refreshBookings()}
                  placeholder="Search customer…"
                  className="min-w-[160px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => startTransition(refreshBookings)}
                  disabled={isPending}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {isPending ? 'Loading…' : 'Search'}
                </button>
              </div>
              <div className="mt-4">
                <SortableTable columns={bookingColumns} rows={bookings} emptyMessage="No bookings match your filters." />
              </div>
            </div>
          )}

          {tab === 'centers' && (
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">My Centers</h1>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {initialCenters.map((c) => (
                  <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-slate-900">{c.name}</p>
                      <span
                        className={['rounded-full px-2 py-0.5 text-[10px] font-semibold', c.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'].join(
                          ' '
                        )}
                      >
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">📍 {c.address}</p>
                    <p className="mt-1 text-xs text-slate-500">☎ {c.phone}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      🕐 {c.opens_at.slice(0, 5)} – {c.closes_at.slice(0, 5)}
                    </p>
                    {c.supports_pickup && (
                      <p className="mt-2 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Pickup & Drop enabled</p>
                    )}
                  </div>
                ))}
                {initialCenters.length === 0 && <p className="text-sm text-slate-400">No centers assigned to your account yet — contact the platform admin.</p>}
              </div>
            </div>
          )}
        </DashboardErrorBoundary>
      </main>
    </div>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: string | number; accent: 'amber' | 'blue' | 'emerald' }) {
  const accentClasses = { amber: 'bg-amber-50 text-amber-700', blue: 'bg-blue-50 text-blue-700', emerald: 'bg-emerald-50 text-emerald-700' }[accent];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={['mt-2 inline-block rounded-lg px-2 py-1 text-2xl font-extrabold', accentClasses].join(' ')}>{value}</p>
    </div>
  );
}