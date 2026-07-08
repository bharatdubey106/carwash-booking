// app/page.tsx
import Hero from '@/components/marketing/Hero';
import ServicesShowcase from '@/components/marketing/ServicesShowcase';
import BookingSection from '@/components/booking/BookingSection';
import { getPublicSettings } from '@/lib/actions/public';

export default async function LandingPage() {
  const settings = await getPublicSettings();

  return (
    <main className="min-h-dvh bg-white">
      <Hero whatsappNumber={settings.whatsapp_number} />
      <ServicesShowcase />
      <BookingSection />
    </main>
  );
}