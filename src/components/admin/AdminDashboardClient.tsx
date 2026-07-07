// components/admin/AdminDashboardClient.tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import SortableTable, { type ColumnDef } from '@/components/dashboard/SortableTable';
import DashboardErrorBoundary from '@/components/dashboard/DashboardErrorBoundary';
import Modal from '@/components/dashboard/Modal';
import { signOut } from '@/lib/actions/auth';
import {
  type AdminBookingRow,
  type AdminServiceRow,
  type AdminCenterRow,
  type AdminOwnerRow,
  type AdminBlockedSlotRow,
  type PlatformSettings,
  getAllBookingsAdmin,
  createManualBooking,
  upsertService,
  upsertCenter,
  createOwnerAccount,
  createBlockedSlot,
  deleteBlockedSlot,
  updatePlatformSettings,
} from '@/lib/actions/admin';
import { updateBookingStatus } from '@/lib/actions/owner';

type Tab = 'dashboard' | 'bookings' | 'services' | 'centers' | 'owners' | 'blocks' | 'settings';

interface AdminMetrics {
  todayCount: number;
  pendingCount: number;
  activeCenters: number;
  activeOwners: number;
  todayBookings: Array<{ id: string; time: string; status: string; customerName: string; customerPhone: string; bookingType: string; serviceName: string; centerName: string }>;
}

interface AdminDashboardClientProps {
  initialMetrics: AdminMetrics | null;
  initialBookings: AdminBookingRow[];
  initialServices: AdminServiceRow[];
  initialCenters: AdminCenterRow[];
  initialOwners: AdminOwnerRow[];
  initialBlockedSlots: AdminBlockedSlotRow[];
  initialSettings: PlatformSettings | null;
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
function downloadCSV(rows: AdminBookingRow[]) {
  const header = ['Date', 'Time', 'Customer', 'Phone', 'Service', 'Center', 'Type', 'Status', 'Price'];
  const lines = rows.map((r) =>
    [r.booking_date, r.slot_time, r.customer_name, r.customer_phone, r.service_name, r.center_name, r.booking_type, r.status, r.price_at_booking].join(',')
  );
  const csv = [header.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bookings-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminDashboardClient(props: AdminDashboardClientProps) {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [bookings, setBookings] = useState(props.initialBookings);
  const [services, setServices] = useState(props.initialServices);
  const [centers, setCenters] = useState(props.initialCenters);
  const [owners, setOwners] = useState(props.initialOwners);
  const [blockedSlots, setBlockedSlots] = useState(props.initialBlockedSlots);
  const [settings, setSettings] = useState(props.initialSettings);

  const [filterDate, setFilterDate] = useState('');
  const [filterService, setFilterService] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [serviceModal, setServiceModal] = useState<AdminServiceRow | 'new' | null>(null);
  const [centerModal, setCenterModal] = useState<AdminCenterRow | 'new' | null>(null);
  const [ownerModalOpen, setOwnerModalOpen] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);

  async function refreshBookings() {
    const result = await getAllBookingsAdmin({ date: filterDate || undefined, serviceId: filterService || undefined, search: filterSearch || undefined });
    if (result.success) setBookings(result.data);
  }

  async function handleStatusChange(bookingId: string, status: 'confirmed' | 'cancelled' | 'completed' | 'in_progress') {
    const previous = bookings;
    setBookings((rows) => rows.map((r) => (r.id === bookingId ? { ...r, status } : r)));
    const result = await updateBookingStatus({ bookingId, status });
    if (!result.success) setBookings(previous);
  }

  const bookingColumns: ColumnDef<AdminBookingRow>[] = [
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
    { key: 'center', label: 'Center', sortable: true, sortValue: (r) => r.center_name, render: (r) => <span>{r.center_name}</span> },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (
        <div className="flex items-center gap-2">
          <StatusBadge status={r.status} />
          {r.status === 'pending' && (
            <div className="flex gap-1">
              <button type="button" onClick={() => handleStatusChange(r.id, 'confirmed')} className="text-[10px] font-bold text-blue-600">
                Accept
              </button>
              <button type="button" onClick={() => handleStatusChange(r.id, 'cancelled')} className="text-[10px] font-bold text-red-500">
                Reject
              </button>
            </div>
          )}
        </div>
      ),
    },
  ];

  const serviceColumns: ColumnDef<AdminServiceRow>[] = [
    {
      key: 'name',
      label: 'Service',
      sortable: true,
      sortValue: (r) => r.name,
      render: (r) => (
        <div>
          <div className="font-semibold text-slate-900">{r.name}</div>
          <div className="text-[11px] text-slate-500">{r.category}</div>
        </div>
      ),
    },
    { key: 'center', label: 'Center', sortable: true, sortValue: (r) => r.center_name, render: (r) => <span>{r.center_name}</span> },
    { key: 'price', label: 'Price', sortable: true, sortValue: (r) => r.price, render: (r) => <span className="font-semibold">₹{r.price}</span> },
    { key: 'duration', label: 'Duration', sortable: true, sortValue: (r) => r.duration_minutes, render: (r) => <span>{r.duration_minutes} min</span> },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (
        <span className={['rounded-full px-2 py-0.5 text-[11px] font-semibold', r.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'].join(' ')}>
          {r.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    { key: 'edit', label: '', render: (r) => <button type="button" onClick={() => setServiceModal(r)} className="text-xs font-bold text-blue-600">Edit</button> },
  ];

  const centerColumns: ColumnDef<AdminCenterRow>[] = [
    {
      key: 'name',
      label: 'Center',
      sortable: true,
      sortValue: (r) => r.name,
      render: (r) => (
        <div>
          <div className="font-semibold text-slate-900">{r.name}</div>
          <div className="text-[11px] text-slate-500">{r.address}</div>
        </div>
      ),
    },
    { key: 'owner', label: 'Owner', sortable: true, sortValue: (r) => r.owner_name, render: (r) => <span>{r.owner_name}</span> },
    { key: 'phone', label: 'Phone', render: (r) => <span>{r.phone}</span> },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (
        <span className={['rounded-full px-2 py-0.5 text-[11px] font-semibold', r.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'].join(' ')}>
          {r.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    { key: 'edit', label: '', render: (r) => <button type="button" onClick={() => setCenterModal(r)} className="text-xs font-bold text-blue-600">Edit</button> },
  ];

  return (
    <div className="flex min-h-dvh bg-slate-50">
      <aside className="hidden w-56 flex-col border-r border-slate-200 bg-white p-4 sm:flex">
        <p className="mb-6 text-sm font-extrabold text-slate-900">🔐 Super Admin</p>
        <nav className="flex flex-1 flex-col gap-1">
          {(
            [
              ['dashboard', 'Dashboard'],
              ['bookings', 'Bookings'],
              ['services', 'Services'],
              ['centers', 'Centers'],
              ['owners', 'Owners'],
              ['blocks', 'Blocked'],
              ['settings', 'Settings'],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={['rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors', tab === key ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'].join(
                ' '
              )}
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
          {tab === 'dashboard' && props.initialMetrics && (
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">Dashboard</h1>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricCard label="Today's Bookings" value={props.initialMetrics.todayCount} accent="blue" />
                <MetricCard label="Pending" value={props.initialMetrics.pendingCount} accent="amber" />
                <MetricCard label="Active Centers" value={props.initialMetrics.activeCenters} accent="emerald" />
                <MetricCard label="Owners" value={props.initialMetrics.activeOwners} accent="purple" />
              </div>
              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-bold text-slate-900">Today&apos;s Bookings</h3>
                <div className="mt-3 divide-y divide-slate-100">
                  {props.initialMetrics.todayBookings.length === 0 && <p className="py-4 text-sm text-slate-400">Nothing today.</p>}
                  {props.initialMetrics.todayBookings.map((b) => (
                    <div key={b.id} className="flex items-center justify-between py-2.5 text-sm">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {formatTime12h(b.time)} · {b.customerName}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {b.serviceName} · {b.centerName}
                        </p>
                      </div>
                      <StatusBadge status={b.status} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'bookings' && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-xl font-extrabold text-slate-900">All Bookings</h1>
                <div className="flex gap-2">
                  <button type="button" onClick={() => downloadCSV(bookings)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
                    ⬇ Export
                  </button>
                  <button type="button" onClick={() => setManualModalOpen(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                    + Add
                  </button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} onBlur={refreshBookings} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <select
                  value={filterService}
                  onChange={(e) => {
                    setFilterService(e.target.value);
                    refreshBookings();
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">All Services</option>
                  {Array.from(new Map(services.map((s) => [s.id, s.name])).entries()).map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && refreshBookings()}
                  placeholder="Search…"
                  className="min-w-[160px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="mt-4">
                <SortableTable columns={bookingColumns} rows={bookings} emptyMessage="No bookings match your filters." />
              </div>
            </div>
          )}

          {tab === 'services' && (
            <div>
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-extrabold text-slate-900">Services</h1>
                <button type="button" onClick={() => setServiceModal('new')} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                  + Add Service
                </button>
              </div>
              <div className="mt-4">
                <SortableTable columns={serviceColumns} rows={services} emptyMessage="No services yet." />
              </div>
            </div>
          )}

          {tab === 'centers' && (
            <div>
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-extrabold text-slate-900">All Centers</h1>
                <button type="button" onClick={() => setCenterModal('new')} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                  + Add Center
                </button>
              </div>
              <div className="mt-4">
                <SortableTable columns={centerColumns} rows={centers} emptyMessage="No centers yet." />
              </div>
            </div>
          )}

          {tab === 'owners' && (
            <div>
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-extrabold text-slate-900">Business Owners</h1>
                <button type="button" onClick={() => setOwnerModalOpen(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                  + Add Owner
                </button>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {owners.map((o) => (
                  <div key={o.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="font-bold text-slate-900">{o.full_name}</p>
                    <p className="text-xs text-slate-500">☎ {o.phone ?? '—'}</p>
                    <p className="mt-1 text-xs font-semibold text-blue-600">
                      {o.centerCount} center{o.centerCount === 1 ? '' : 's'}
                    </p>
                  </div>
                ))}
                {owners.length === 0 && <p className="text-sm text-slate-400">No owners yet.</p>}
              </div>
            </div>
          )}

          {tab === 'blocks' && (
            <BlocksPanel
              blockedSlots={blockedSlots}
              onOpenModal={() => setBlockModalOpen(true)}
              onDelete={async (id) => {
                const previous = blockedSlots;
                setBlockedSlots((rows) => rows.filter((r) => r.id !== id));
                const result = await deleteBlockedSlot(id);
                if (!result.success) setBlockedSlots(previous);
              }}
            />
          )}

          {tab === 'settings' && settings && (
            <SettingsPanel
              settings={settings}
              onSave={async (next) => {
                const result = await updatePlatformSettings(next);
                if (result.success)
                  setSettings((prev) =>
                    prev
                      ? { ...prev, whatsapp_number: next.whatsappNumber, default_slot_interval_minutes: next.slotIntervalMinutes, max_advance_days: next.maxAdvanceDays }
                      : prev
                  );
                return result;
              }}
            />
          )}
        </DashboardErrorBoundary>
      </main>

      <Modal open={manualModalOpen} onClose={() => setManualModalOpen(false)} title="Manual Booking">
        <ManualBookingForm
          services={services}
          centers={centers}
          onSaved={async () => {
            setManualModalOpen(false);
            await refreshBookings();
          }}
        />
      </Modal>

      <Modal open={serviceModal !== null} onClose={() => setServiceModal(null)} title={serviceModal === 'new' ? 'Add Service' : 'Edit Service'}>
        {serviceModal && (
          <ServiceForm
            centers={centers}
            initial={serviceModal === 'new' ? null : serviceModal}
            onSaved={(updatedRow) => {
              setServices((rows) => {
                const exists = rows.some((r) => r.id === updatedRow.id);
                return exists ? rows.map((r) => (r.id === updatedRow.id ? updatedRow : r)) : [...rows, updatedRow];
              });
              setServiceModal(null);
            }}
          />
        )}
      </Modal>

      <Modal open={centerModal !== null} onClose={() => setCenterModal(null)} title={centerModal === 'new' ? 'Add Center' : 'Edit Center'}>
        {centerModal && (
          <CenterForm
            owners={owners}
            initial={centerModal === 'new' ? null : centerModal}
            onSaved={(updatedRow) => {
              setCenters((rows) => {
                const exists = rows.some((r) => r.id === updatedRow.id);
                return exists ? rows.map((r) => (r.id === updatedRow.id ? updatedRow : r)) : [...rows, updatedRow];
              });
              setCenterModal(null);
            }}
          />
        )}
      </Modal>

      <Modal open={ownerModalOpen} onClose={() => setOwnerModalOpen(false)} title="Add Business Owner">
        <OwnerForm
          onSaved={(newOwner) => {
            setOwners((rows) => [...rows, newOwner]);
            setOwnerModalOpen(false);
          }}
        />
      </Modal>

      <Modal open={blockModalOpen} onClose={() => setBlockModalOpen(false)} title="Block Date or Slot">
        <BlockForm
          centers={centers}
          onSaved={(newBlock) => {
            setBlockedSlots((rows) => [newBlock, ...rows]);
            setBlockModalOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: number; accent: 'amber' | 'blue' | 'emerald' | 'purple' }) {
  const accentClasses = {
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    purple: 'bg-purple-50 text-purple-700',
  }[accent];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={['mt-2 inline-block rounded-lg px-2 py-1 text-2xl font-extrabold', accentClasses].join(' ')}>{value}</p>
    </div>
  );
}

function ManualBookingForm({ services, centers, onSaved }: { services: AdminServiceRow[]; centers: AdminCenterRow[]; onSaved: () => void }) {
  const [centerId, setCenterId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [bookingType, setBookingType] = useState<'slot' | 'pickup'>('slot');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableServices = services.filter((s) => s.center_id === centerId);

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);
    const result = await createManualBooking({ centerId, serviceId, date, time, customerName: name, customerPhone: phone, vehiclePlate, bookingType });
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onSaved();
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <select
          value={centerId}
          onChange={(e) => {
            setCenterId(e.target.value);
            setServiceId('');
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Center</option>
          {centers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} disabled={!centerId} className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50">
          <option value="">Service</option>
          {availableServices.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer Name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
          placeholder="Phone"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input
          type="text"
          value={vehiclePlate}
          onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
          placeholder="Vehicle No."
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <select value={bookingType} onChange={(e) => setBookingType(e.target.value as 'slot' | 'pickup')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="slot">Book a Slot</option>
          <option value="pickup">Pickup & Drop</option>
        </select>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting || !centerId || !serviceId || !date || !time || !name || !phone}
        className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {isSubmitting ? 'Creating…' : 'Create Booking'}
      </button>
    </div>
  );
}

function ServiceForm({ centers, initial, onSaved }: { centers: AdminCenterRow[]; initial: AdminServiceRow | null; onSaved: (row: AdminServiceRow) => void }) {
  const [centerId, setCenterId] = useState(initial?.center_id ?? centers[0]?.id ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [price, setPrice] = useState(initial?.price ?? 0);
  const [duration, setDuration] = useState(initial?.duration_minutes ?? 30);
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);
    const result = await upsertService({ id: initial?.id, centerId, name, category, description, price, durationMinutes: duration, isActive });
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    const centerName = centers.find((c) => c.id === centerId)?.name ?? '—';
    onSaved({ id: initial?.id ?? crypto.randomUUID(), center_id: centerId, center_name: centerName, name, category, description, price, duration_minutes: duration, is_active: isActive });
  }

  return (
    <div className="space-y-3">
      <select value={centerId} onChange={(e) => setCenterId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
        {centers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Service Name" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <input
        type="text"
        value={category ?? ''}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="Subtitle / Category"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <textarea
        value={description ?? ''}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        rows={2}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <div className="grid grid-cols-2 gap-3">
        <input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} placeholder="Price" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input
          type="number"
          min={1}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          placeholder="Duration (min)"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Active
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting || !centerId || !name}
        className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {isSubmitting ? 'Saving…' : 'Save Service'}
      </button>
    </div>
  );
}

function CenterForm({ owners, initial, onSaved }: { owners: AdminOwnerRow[]; initial: AdminCenterRow | null; onSaved: (row: AdminCenterRow) => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [ownerId, setOwnerId] = useState(initial?.owner_id ?? owners[0]?.id ?? '');
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [supportsPickup, setSupportsPickup] = useState(initial?.supports_pickup ?? false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);
    const result = await upsertCenter({ id: initial?.id, name, address, city: 'Pune', phone, ownerId, isActive, supportsPickup });
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    const ownerName = owners.find((o) => o.id === ownerId)?.full_name ?? '—';
    onSaved({ id: initial?.id ?? crypto.randomUUID(), name, address, phone, owner_id: ownerId, owner_name: ownerName, is_active: isActive, supports_pickup: supportsPickup });
  }

  return (
    <div className="space-y-3">
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Center Name" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <option value="">Assign to Owner</option>
        {owners.map((o) => (
          <option key={o.id} value={o.id}>
            {o.full_name}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="WhatsApp Number e.g. 919407822022"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={supportsPickup} onChange={(e) => setSupportsPickup(e.target.checked)} /> Pickup & Drop
        </label>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting || !name || !address || !ownerId}
        className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {isSubmitting ? 'Saving…' : 'Save Center'}
      </button>
    </div>
  );
}

function OwnerForm({ onSaved }: { onSaved: (row: AdminOwnerRow) => void }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);
    const result = await createOwnerAccount({ fullName, email, password, phone });
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onSaved({ id: result.data.id, full_name: fullName, phone, centerCount: 0 });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full Name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
          placeholder="WhatsApp"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Login Email" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <input
        type="text"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Temporary Password (min 8 chars)"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting || !fullName || !email || password.length < 8 || phone.length !== 10}
        className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {isSubmitting ? 'Creating…' : 'Save Owner'}
      </button>
    </div>
  );
}

function BlockForm({ centers, onSaved }: { centers: AdminCenterRow[]; onSaved: (row: AdminBlockedSlotRow) => void }) {
  const [centerId, setCenterId] = useState(centers[0]?.id ?? '');
  const [date, setDate] = useState('');
  const [fullDay, setFullDay] = useState(true);
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);
    const result = await createBlockedSlot({ centerId, date, time: fullDay ? undefined : time, reason });
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    const centerName = centers.find((c) => c.id === centerId)?.name ?? '—';
    onSaved({ id: crypto.randomUUID(), center_id: centerId, center_name: centerName, blocked_date: date, slot_time: fullDay ? null : `${time}:00`, reason });
  }

  return (
    <div className="space-y-3">
      <select value={centerId} onChange={(e) => setCenterId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
        {centers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input type="checkbox" checked={fullDay} onChange={(e) => setFullDay(e.target.checked)} /> Block the entire day
      </label>
      {!fullDay && <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />}
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting || !centerId || !date || (!fullDay && !time)}
        className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {isSubmitting ? 'Blocking…' : 'Block'}
      </button>
    </div>
  );
}

function BlocksPanel({ blockedSlots, onOpenModal, onDelete }: { blockedSlots: AdminBlockedSlotRow[]; onOpenModal: () => void; onDelete: (id: string) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-slate-900">Blocked Slots</h1>
        <button type="button" onClick={onOpenModal} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
          + Block
        </button>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2">
        {blockedSlots.length === 0 && <p className="text-sm text-slate-400">No blocks configured.</p>}
        {blockedSlots.map((b) => (
          <motion.div layout key={b.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <p className="font-semibold text-slate-900">
                {b.center_name} · {new Date(`${b.blocked_date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
              <p className="text-xs text-slate-500">
                {b.slot_time ? `Blocked at ${b.slot_time.slice(0, 5)}` : 'Entire day blocked'}
                {b.reason ? ` · ${b.reason}` : ''}
              </p>
            </div>
            <button type="button" onClick={() => onDelete(b.id)} className="text-xs font-bold text-red-500">
              Remove
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function SettingsPanel({
  settings,
  onSave,
}: {
  settings: PlatformSettings;
  onSave: (input: { whatsappNumber: string; slotIntervalMinutes: number; maxAdvanceDays: number }) => Promise<{ success: boolean; error?: string }>;
}) {
  const [whatsappNumber, setWhatsappNumber] = useState(settings.whatsapp_number);
  const [slotIntervalMinutes, setSlotIntervalMinutes] = useState(settings.default_slot_interval_minutes);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(settings.max_advance_days);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave() {
    setIsSaving(true);
    setMessage(null);
    const result = await onSave({ whatsappNumber, slotIntervalMinutes, maxAdvanceDays });
    setIsSaving(false);
    setMessage(result.success ? 'Settings saved.' : result.error ?? 'Could not save settings.');
  }

  return (
    <div>
      <h1 className="text-xl font-extrabold text-slate-900">Settings</h1>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-bold text-slate-900">Platform Config</h3>
        <div className="mt-3 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Platform WhatsApp Number</label>
            <input type="text" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Slot Interval (min)</label>
              <select
                value={slotIntervalMinutes}
                onChange={(e) => setSlotIntervalMinutes(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value={15}>15</option>
                <option value={30}>30</option>
                <option value={60}>60</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Max Advance (days)</label>
              <input
                type="number"
                min={1}
                value={maxAdvanceDays}
                onChange={(e) => setMaxAdvanceDays(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      </div>
      {message && <p className="mt-3 text-sm font-medium text-slate-600">{message}</p>}
      <button type="button" onClick={handleSave} disabled={isSaving} className="mt-4 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {isSaving ? 'Saving…' : 'Save Settings'}
      </button>
    </div>
  );
}