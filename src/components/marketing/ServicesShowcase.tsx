import Link from 'next/link';
import { getActiveServices } from '@/lib/actions/bookings';

function iconFor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('deep')) return '✨';
  if (n.includes('premium')) return '💎';
  if (n.includes('standard')) return '🧼';
  if (n.includes('interior')) return '🛋️';
  return '💧';
}

export default async function ServicesShowcase() {
  const result = await getActiveServices();
  const services = result.success ? result.data : [];
  const catalog = Array.from(new Map(services.map((s: any) => [s.name, s])).values());

  return (
    <section className="relative overflow-hidden bg-slate-50 px-6 py-24 sm:py-32">
      <div className="absolute -top-24 left-1/2 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-blue-100/40 opacity-50 blur-[100px] pointer-events-none" />
      <div className="relative mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">Signature Car Care.</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-500">Precision cleaning, advanced protection, and interior restoration.</p>
        </div>
        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {catalog.map((service: any) => (
            <Link key={service.name} href="#booking" className="group relative flex flex-col justify-between overflow-hidden rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-slate-200 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl">
              <div className="relative z-10">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-2xl">{iconFor(service.name)}</div>
                <h3 className="mt-6 text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{service.name}</h3>
                <p className="mt-4 text-sm text-slate-500 line-clamp-3">{service.description}</p>
              </div>
              <div className="mt-8 pt-6 border-t border-slate-100 font-bold text-slate-900">₹{service.price}</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}